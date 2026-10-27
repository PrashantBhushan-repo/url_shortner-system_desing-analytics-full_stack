import crypto from 'node:crypto';
import prisma from '../config/prismaClient.js';
import { config } from '../config/config.js';
import { AppError } from '../utils/AppError.js';
import { invalidateSubscriptionCache } from './planLimitService.js';
import { CYCLES, planAmount, discountedAmount, periodEnd, refundEligibility, publicPayment, currencyMinorFactor } from './billingPolicy.js';
import * as gateway from './billingGateway.js';

const locked = async (userId, fn) => prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text`;
  return fn(tx);
}, { timeout: 20000 });

export function validSignature(value, expected) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
    && crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex'));
}

export async function validateBillingCoupon(db, code, planKey, userId) {
  if (typeof code !== 'string' || !code.trim() || code.length > 64) throw new AppError('Enter a valid coupon code.', 400);
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!coupon || !coupon.is_active || coupon.valid_from > now || (coupon.valid_until && coupon.valid_until <= now)) throw new AppError('This coupon is invalid or expired.', 400);
  if (coupon.max_redemptions != null && coupon.times_redeemed >= coupon.max_redemptions) throw new AppError('This coupon has reached its redemption limit.', 409);
  if (coupon.applicable_plans?.length && !coupon.applicable_plans.includes(planKey)) throw new AppError('This coupon does not apply to the selected plan.', 400);
  if (userId && await db.couponRedemption.findUnique({ where: { coupon_id_user_id: { coupon_id: coupon.id, user_id: userId } } })) throw new AppError('You have already used this coupon.', 409);
  return coupon;
}

async function activate(tx, payment) {
  if (payment.subscription_id) return payment;
  const now = new Date();
  const active = await tx.subscription.findFirst({ where: { user_id: payment.user_id, status: 'ACTIVE' }, orderBy: { started_at: 'desc' }, include: { plan: true, payments: { orderBy: { created_at: 'desc' }, take: 1 } } });
  // A delayed old capture must not replace a newer paid purchase.
  if (active?.payments?.[0] && active.payments[0].created_at > payment.created_at) {
    return tx.payment.update({ where: { id: payment.id }, data: { metadata: { ...payment.metadata, fulfillmentStatus: 'REVIEW_REQUIRED' } } });
  }
  const samePlan = active?.plan_id === payment.plan_id && active.current_period_end > now;
  const start = samePlan ? active.current_period_end : now;
  await tx.subscription.updateMany({ where: { user_id: payment.user_id, status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] } }, data: { status: 'CANCELED', canceled_at: now } });
  const sub = await tx.subscription.create({ data: { user_id: payment.user_id, plan_id: payment.plan_id, billing_cycle: payment.billing_cycle, status: 'ACTIVE', started_at: now, current_period_end: periodEnd(start, payment.billing_cycle), external_subscription_id: payment.gateway_order_id } });
  const couponId = payment.metadata?.couponId;
  if (couponId) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-coupon:${couponId}`}, 0))::text`;
    const existing = await tx.couponRedemption.findUnique({ where: { coupon_id_user_id: { coupon_id: couponId, user_id: payment.user_id } } });
    if (!existing) {
      await tx.couponRedemption.create({ data: { coupon_id: couponId, user_id: payment.user_id, payment_id: payment.id } });
      await tx.coupon.update({ where: { id: couponId }, data: { times_redeemed: { increment: 1 } } });
    }
  }
  return tx.payment.update({ where: { id: payment.id }, data: { subscription_id: sub.id, metadata: { ...payment.metadata, fulfillmentStatus: 'ACTIVE', previousSubscriptionId: active?.id || null } } });
}

async function checkoutResponse(attempt) {
  const payment = attempt.payment_id && await prisma.payment.findUnique({ where: { id: attempt.payment_id } });
  if (!payment) throw new AppError('The checkout result is not confirmed. Refresh billing before creating another payment.', 409, { checkoutId: attempt.id }, 'PAYMENT_UNCERTAIN');
  return { checkoutId: attempt.id, orderId: payment.gateway_order_id, amount: payment.amount, currency: payment.currency, keyId: gateway.gatewayPublicKey(), paymentId: payment.id, zeroCharge: payment.amount === 0 && payment.status === 'CAPTURED', status: payment.status, fulfillmentStatus: payment.metadata?.fulfillmentStatus };
}

export async function createBillingOrder(userId, input = {}) {
  const { planKey, billingCycle, couponCode = '', requestKey } = input;
  if (typeof planKey !== 'string' || !Object.hasOwn(CYCLES, billingCycle) || typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey) || typeof couponCode !== 'string' || couponCode.length > 64) throw new AppError('A valid plan, billing cycle, and checkout request key are required.', 400);
  const fingerprint = JSON.stringify([planKey, billingCycle, couponCode.trim().toUpperCase()]);
  const reservation = await locked(userId, async tx => {
    const previous = await tx.billingCheckout.findUnique({ where: { user_id_request_key: { user_id: userId, request_key: requestKey } } });
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new AppError('This checkout key belongs to a different purchase.', 409);
      if (previous.status === 'FAILED' && !previous.payment_id) throw new AppError('This checkout was rejected. Start a new checkout.', 409, null, 'CHECKOUT_REJECTED');
      return { attempt: previous, existing: true };
    }
    const latestPurchase = await tx.payment.findFirst({ where: { user_id: userId, subscription_id: { not: null } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
    if ((input.expectedPurchaseId ?? null) !== (latestPurchase?.id ?? null)) throw new AppError('Your billing changed. Refresh and review the purchase before continuing.', 409, null, 'PURCHASE_CHANGED');
    const pendingRefund = await tx.billingRefund.findFirst({ where: { user_id: userId, status: { in: ['REQUESTED', 'PROCESSING', 'PENDING', 'UNKNOWN'] } } });
    if (pendingRefund) throw new AppError('Wait for your pending refund to be resolved before purchasing another plan.', 409);
    const open = await tx.billingCheckout.findFirst({ where: { user_id: userId, OR: [ { status: { in: ['CREATING', 'UNKNOWN', 'AUTHORIZED', 'READY', 'CREATED'] } }, { status: 'FAILED', payment_id: { not: null } } ] }, orderBy: { created_at: 'desc' } });
    if (open) {
      if (open.fingerprint === fingerprint && open.payment_id) return { attempt: open, existing: true };
      throw new AppError('A checkout is already open. Check its status or finish it before starting a different purchase.', 409, { checkoutId: open.id }, 'CHECKOUT_IN_PROGRESS');
    }
    const plan = await tx.plan.findUnique({ where: { key: planKey } });
    if (!plan?.is_active || plan.key === 'free') throw new AppError('Select an available paid plan.', 400);
    const coupon = couponCode.trim() ? await validateBillingCoupon(tx, couponCode, planKey, userId) : null;
    if (coupon) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-coupon:${coupon.id}`}, 0))::text`;
      const fresh = await validateBillingCoupon(tx, couponCode, planKey, userId);
      if (fresh.max_redemptions != null) {
        const reserved = await tx.billingCheckout.count({ where: { coupon_id: coupon.id, OR: [
          { status: { in: ['CREATING', 'UNKNOWN', 'READY', 'CREATED', 'AUTHORIZED'] } },
          { status: 'FAILED', payment_id: { not: null } },
        ] } });
        if (fresh.times_redeemed + reserved >= fresh.max_redemptions) throw new AppError('This coupon is fully reserved by existing checkouts. Try another code.', 409);
      }
    }
    const amount = discountedAmount(planAmount(plan, billingCycle), coupon);
    if (amount > 0 && !gateway.gatewayConfigured()) throw new AppError('Checkout is currently unavailable. Contact billing support.', 409, null, 'PAYMENTS_UNAVAILABLE');
    const attempt = await tx.billingCheckout.create({ data: { user_id: userId, request_key: requestKey, fingerprint, plan_id: plan.id, billing_cycle: billingCycle, amount, currency: plan.currency, coupon_id: coupon?.id || null } });
    return { attempt, existing: false };
  });
  if (reservation.existing) return checkoutResponse(reservation.attempt);
  const attempt = reservation.attempt;
  const profile = await prisma.billingProfile.findUnique({ where: { user_id: userId } });
  let order;
  try {
    order = attempt.amount === 0 ? { id: `free_${attempt.id}`, amount: 0, currency: attempt.currency } : await gateway.createGatewayOrder({ amount: attempt.amount, currency: attempt.currency, receipt: attempt.id, notes: { checkoutId: attempt.id, userId } });
  } catch (error) {
    await prisma.billingCheckout.updateMany({ where: { id: attempt.id, status: 'CREATING', payment_id: null }, data: { status: error.errorCode === 'PAYMENT_REJECTED' ? 'FAILED' : 'UNKNOWN' } });
    throw error;
  }
  const payment = await locked(userId, async tx => {
    const saved = await tx.payment.upsert({ where: { gateway_order_id: order.id }, update: {}, create: { user_id: userId, plan_id: attempt.plan_id, billing_cycle: attempt.billing_cycle, amount: attempt.amount, currency: attempt.currency, status: attempt.amount === 0 ? 'CAPTURED' : 'CREATED', gateway: attempt.amount === 0 ? 'coupon_bypass' : 'razorpay', gateway_order_id: order.id, metadata: { couponId: attempt.coupon_id, checkoutId: attempt.id, billingProfile: profile ? { name: profile.name, email: profile.email, company: profile.company, address: profile.address, city: profile.city, region: profile.region, postal_code: profile.postal_code, country: profile.country, tax_id: profile.tax_id } : null } } });
    await tx.billingCheckout.update({ where: { id: attempt.id }, data: { status: saved.status === 'CREATED' ? 'READY' : saved.status, payment_id: saved.id } });
    return attempt.amount === 0 ? activate(tx, saved) : saved;
  });
  if (!attempt.amount) await invalidateSubscriptionCache(userId);
  return checkoutResponse({ ...attempt, payment_id: payment.id });
}

async function recoverPayment(orderId) {
  let payment = await prisma.payment.findUnique({ where: { gateway_order_id: orderId }, include: { plan: true } });
  if (payment) return payment;
  const order = await gateway.fetchGatewayOrder(orderId);
  const attempt = order.notes?.checkoutId && await prisma.billingCheckout.findUnique({ where: { id: order.notes.checkoutId } });
  if (!attempt || order.amount !== attempt.amount || order.currency !== attempt.currency) throw new AppError('Unknown payment order. Billing support must review this transaction.', 409);
  payment = await locked(attempt.user_id, async tx => {
    const saved = await tx.payment.upsert({ where: { gateway_order_id: orderId }, update: {}, create: { user_id: attempt.user_id, plan_id: attempt.plan_id, billing_cycle: attempt.billing_cycle, amount: attempt.amount, currency: attempt.currency, gateway_order_id: orderId, metadata: { checkoutId: attempt.id, couponId: attempt.coupon_id } } });
    await tx.billingCheckout.update({ where: { id: attempt.id }, data: { payment_id: saved.id, status: saved.status === 'CREATED' ? 'READY' : saved.status } });
    return saved;
  });
  return payment;
}

export async function syncBillingCheckout(userId, checkoutId) {
  const attempt = await prisma.billingCheckout.findUnique({ where: { id: checkoutId } });
  if (!attempt || attempt.user_id !== userId) throw new AppError('Checkout not found.', 404);
  if (attempt.payment_id) return syncBillingPayment(userId, attempt.payment_id);
  if (attempt.amount === 0) {
    const payment = await locked(userId, async tx => {
      const saved = await tx.payment.upsert({ where: { gateway_order_id: `free_${attempt.id}` }, update: {}, create: { user_id: userId, plan_id: attempt.plan_id, billing_cycle: attempt.billing_cycle, amount: 0, currency: attempt.currency, gateway: 'coupon_bypass', gateway_order_id: `free_${attempt.id}`, status: 'CAPTURED', metadata: { couponId: attempt.coupon_id, checkoutId: attempt.id } } });
      const activated = await activate(tx, saved);
      await tx.billingCheckout.update({ where: { id: attempt.id }, data: { payment_id: saved.id, status: 'CAPTURED' } });
      return activated;
    });
    await invalidateSubscriptionCache(userId);
    return publicPayment(payment);
  }
  const response = await gateway.fetchOrdersByReceipt(attempt.id);
  if (!Array.isArray(response.items)) throw new AppError('The provider checkout lookup is unavailable.', 409);
  const orders = response.items.filter(order => order.receipt === attempt.id && order.notes?.checkoutId === attempt.id);
  if (!orders.length && new Date(attempt.created_at).getTime() < Date.now() - 60000) {
    // No order ID was ever exposed to checkout. After the request timeout, an
    // authoritative empty provider lookup can release this uncharged reservation.
    const racedPaymentId = await locked(userId, async tx => {
      const fresh = await tx.billingCheckout.findUnique({ where: { id: attempt.id } });
      if (!fresh.payment_id) await tx.billingCheckout.update({ where: { id: attempt.id }, data: { status: 'FAILED' } });
      return fresh.payment_id;
    });
    if (racedPaymentId) return syncBillingPayment(userId, racedPaymentId);
    return { status: 'NOT_CREATED', checkoutId: attempt.id };
  }
  if (orders.length !== 1) throw new AppError(orders.length ? 'Multiple provider orders need a billing review. Contact support with your checkout reference.' : 'No provider order has been confirmed yet. Try checking again shortly or contact billing support.', 409, null, 'PAYMENT_UNCERTAIN');
  const payment = await recoverPayment(orders[0].id);
  return syncBillingPayment(userId, payment.id);
}

export async function settlePayment(entity) {
  if (!entity?.order_id || !entity?.id) throw new AppError('Invalid provider payment.', 400);
  const original = await recoverPayment(entity.order_id);
  if (entity.amount !== original.amount || entity.currency !== original.currency) throw new AppError('Provider payment amount or currency does not match the order.', 409);
  const result = await locked(original.user_id, async tx => {
    let payment = await tx.payment.findUnique({ where: { id: original.id } });
    if (['CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
      if (entity.status === 'captured' && payment.gateway_payment_id !== entity.id) {
        // Preserve every excess charge reference for support; never grant twice.
        const duplicateCharges = [...new Set([...(payment.metadata?.duplicateCharges || []), entity.id])];
        return tx.payment.update({ where: { id: payment.id }, data: { metadata: { ...payment.metadata, duplicateCharges, fulfillmentStatus: 'REVIEW_REQUIRED' } } });
      }
      return payment;
    }
    if (entity.status === 'captured') {
      const providerDate = Number.isFinite(entity.created_at) && entity.created_at > 0 ? new Date(entity.created_at * 1000) : new Date();
      const paidAt = providerDate > new Date() ? new Date() : providerDate;
      payment = await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED', gateway_payment_id: entity.id, failure_reason: null, metadata: { ...payment.metadata, paidAt: paidAt.toISOString() } } });
      payment = await activate(tx, payment);
    } else if (entity.status === 'authorized') {
      payment = await tx.payment.update({ where: { id: payment.id }, data: { status: 'AUTHORIZED', gateway_payment_id: entity.id } });
    } else if (entity.status === 'failed' && payment.status !== 'AUTHORIZED') {
      payment = await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failure_reason: 'The payment was declined or could not be completed.' } });
    }
    if (payment.metadata?.checkoutId) await tx.billingCheckout.update({ where: { id: payment.metadata.checkoutId }, data: { status: payment.status } });
    return payment;
  });
  await invalidateSubscriptionCache(original.user_id);
  return result;
}

export async function verifyBillingPayment(userId, input = {}) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = input;
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || !gateway.gatewayConfigured()) throw new AppError('Invalid payment verification request.', 400);
  const payment = await prisma.payment.findUnique({ where: { gateway_order_id: orderId } });
  if (!payment || payment.user_id !== userId || payment.gateway !== 'razorpay') throw new AppError('Payment not found.', 404);
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${payment.gateway_order_id}|${paymentId}`).digest('hex');
  if (!validSignature(signature, expected)) throw new AppError('Payment signature verification failed.', 400);
  const entity = await gateway.fetchGatewayPayment(paymentId);
  if (entity.order_id !== payment.gateway_order_id) throw new AppError('Payment does not belong to this order.', 400);
  return settlePayment(entity);
}

export async function syncBillingPayment(userId, paymentId) {
  let payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });
  if (!payment || payment.user_id !== userId) throw new AppError('Payment not found.', 404);
  if (payment.gateway === 'razorpay') {
    const result = await gateway.fetchOrderPayments(payment.gateway_order_id);
    if (!Array.isArray(result.items)) throw new AppError('Invalid provider payment history.', 409);
    const items = result.items;
    const entity = items.find(item => item.status === 'captured') || items.find(item => item.status === 'authorized') || items.find(item => item.status === 'failed');
    if (entity) await settlePayment(entity);
    for (const extra of items.filter(item => item.status === 'captured' && item.id !== entity?.id)) await settlePayment(extra);
    payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });
    const refund = await prisma.billingRefund.findUnique({ where: { payment_id: paymentId } });
    if (refund && refund.status !== 'PROCESSED') await syncBillingRefund(userId, paymentId);
    else if (payment.gateway_payment_id && ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status)) await reconcileRefundBalance(payment);
  }
  payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { plan: true } });
  const refund = await prisma.billingRefund.findUnique({ where: { payment_id: paymentId } });
  return publicPayment(payment, refund);
}

export async function reconcileRefundBalance(payment, expectedRefundId = null) {
  const refunds = await gateway.fetchProcessedRefunds(payment.gateway_payment_id);
  if (expectedRefundId && !refunds.some(refund => refund.id === expectedRefundId)) throw new AppError('The processed refund is not yet reflected in provider totals. Refresh its status shortly.', 409);
  const total = refunds.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > payment.amount) throw new AppError('Refund totals need a billing review.', 409);
  await locked(payment.user_id, async tx => {
    const fresh = await tx.payment.findUnique({ where: { id: payment.id } });
    // A delayed notification must never decrease the recorded refunded amount.
    const amount = Math.max(total, fresh.refunded_amount);
    if (!amount) return;
    await tx.payment.update({ where: { id: payment.id }, data: { refunded_amount: amount, status: amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
    if (amount === payment.amount && payment.subscription_id) {
      // Cancel only the subscription paid by this transaction; a newer purchase is untouched.
      const linked = await tx.subscription.findFirst({ where: { id: payment.subscription_id, user_id: payment.user_id, status: 'ACTIVE' } });
      await tx.subscription.updateMany({ where: { id: payment.subscription_id, user_id: payment.user_id }, data: { status: 'CANCELED', canceled_at: new Date(), current_period_end: new Date() } });
      if (linked && payment.metadata?.previousSubscriptionId) {
        const previous = await tx.subscription.findFirst({ where: { id: payment.metadata.previousSubscriptionId, user_id: payment.user_id, current_period_end: { gt: new Date() }, payments: { some: { status: 'CAPTURED' } } } });
        if (previous) await tx.subscription.update({ where: { id: previous.id }, data: { status: 'ACTIVE', canceled_at: null } });
      }
    }
  });
  await invalidateSubscriptionCache(payment.user_id);
}

async function saveRefundResult(payment, refund, entity) {
  if (!entity?.id || entity.payment_id !== payment.gateway_payment_id || entity.amount !== refund.amount) throw new AppError('The provider refund response needs review.', 409);
  const status = entity.status === 'processed' ? 'PROCESSED' : entity.status === 'failed' ? 'FAILED' : 'PENDING';
  // Persist a pending record before reconciliation so a temporary fetch failure can be retried.
  const current = await locked(payment.user_id, async tx => {
    const fresh = await tx.billingRefund.findUnique({ where: { id: refund.id } });
    if (fresh.status === 'PROCESSED') return fresh;
    if (fresh.gateway_refund_id && fresh.gateway_refund_id !== entity.id) throw new AppError('Refund reference mismatch requires billing review.', 409);
    return tx.billingRefund.update({ where: { id: refund.id }, data: { gateway_refund_id: entity.id, status: status === 'PROCESSED' ? 'PENDING' : status, failure_reason: status === 'FAILED' ? 'The payment provider could not complete the refund. Contact billing support.' : null } });
  });
  if (current.status === 'PROCESSED') return current;
  if (status === 'PROCESSED') {
    await reconcileRefundBalance(payment, entity.id);
    await prisma.billingRefund.update({ where: { id: refund.id }, data: { status: 'PROCESSED' } });
  }
  return prisma.billingRefund.findUnique({ where: { id: refund.id } });
}

export async function requestBillingRefund(userId, input = {}, options = {}) {
  const { paymentId, reason, note = '', acceptedTerms } = input;
  if (typeof paymentId !== 'string' || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 200 || typeof note !== 'string' || note.length > 1000 || acceptedTerms !== true) throw new AppError('Choose a reason and acknowledge the refund terms. Notes may contain up to 1,000 characters.', 400);
  if (!gateway.gatewayConfigured()) throw new AppError('Refund processing is unavailable. Contact billing support.', 409);
  const reserved = await locked(userId, async tx => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.user_id !== userId) throw new AppError('Payment not found.', 404);
    const existing = await tx.billingRefund.findUnique({ where: { payment_id: paymentId } });
    if (existing) return { payment, refund: existing, existing: true };
    const eligibility = refundEligibility(payment, null);
    const administratorEligible = options.administrator === true && ['CAPTURED','PARTIALLY_REFUNDED'].includes(payment.status) && eligibility.amount > 0 && payment.gateway === 'razorpay' && payment.gateway_payment_id;
    if (!eligibility.eligible && !administratorEligible) throw new AppError(eligibility.reason, 409);
    const refund = await tx.billingRefund.create({ data: { payment_id: paymentId, user_id: userId, amount: eligibility.amount, reason: reason.trim(), note: note.trim() } });
    return { payment, refund, existing: false };
  });
  if (reserved.existing) return reserved.refund;
  return submitRefund(reserved.payment, reserved.refund);
}

// Administration uses the same durable refund and provider reconciliation as self-service.
export async function requestAdministrativeRefund(paymentId, amountInMajorUnits, reason) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const remaining = payment.amount - payment.refunded_amount;
  const requested = amountInMajorUnits == null ? remaining : Math.round(Number(amountInMajorUnits) * currencyMinorFactor(payment.currency));
  if (!Number.isSafeInteger(requested) || requested <= 0 || requested !== remaining) throw new AppError('Only the full remaining balance can be refunded here. Issue partial refunds in the provider dashboard, then reconcile payment status.', 400);
  return requestBillingRefund(payment.user_id, { paymentId, reason: reason || 'Administrative billing review', acceptedTerms: true }, { administrator: true });
}

async function submitRefund(payment, refund) {
  // The same durable key AND payload survive timeouts and process restarts.
  const fresh = await prisma.billingRefund.findUnique({ where: { id: refund.id } });
  if (['PROCESSED', 'FAILED'].includes(fresh.status)) return fresh;
  if (fresh.gateway_refund_id) return saveRefundResult(payment, fresh, await gateway.fetchGatewayRefund(fresh.gateway_refund_id));
  await prisma.billingRefund.updateMany({ where: { id: refund.id, status: { in: ['REQUESTED', 'UNKNOWN', 'PROCESSING'] }, gateway_refund_id: null }, data: { status: 'PROCESSING' } });
  let entity;
  try {
    entity = await gateway.createGatewayRefund(payment.gateway_payment_id, refund.amount, refund.id);
  } catch (error) {
    await prisma.billingRefund.updateMany({ where: { id: refund.id, status: 'PROCESSING', gateway_refund_id: null }, data: { status: error.errorCode === 'PAYMENT_REJECTED' ? 'FAILED' : 'UNKNOWN', failure_reason: error.message } });
    throw error;
  }
  return saveRefundResult(payment, refund, entity);
}

export async function syncBillingRefund(userId, paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.user_id !== userId) throw new AppError('Payment not found.', 404);
  const refund = await prisma.billingRefund.findUnique({ where: { payment_id: paymentId } });
  if (!refund) throw new AppError('Refund request not found.', 404);
  if (refund.status === 'PROCESSED' || refund.status === 'FAILED') return refund;
  if (refund.gateway_refund_id) return saveRefundResult(payment, refund, await gateway.fetchGatewayRefund(refund.gateway_refund_id));
  return submitRefund(payment, refund);
}

export async function processBillingWebhook(eventId, eventType, payload) {
  const existing = await prisma.webhookEvent.findUnique({ where: { event_id: eventId } });
  if (existing?.processed) return;
  const event = await prisma.webhookEvent.upsert({ where: { event_id: eventId }, update: {}, create: { event_id: eventId, event_type: eventType, payload } });
  try {
    if (['payment.captured', 'payment.authorized', 'payment.failed'].includes(eventType)) {
      const hinted = payload.payload?.payment?.entity;
      if (!hinted?.id) throw new AppError('Invalid payment webhook.', 400);
      // Fetch the current provider state: webhooks can arrive out of order.
      await settlePayment(await gateway.fetchGatewayPayment(hinted.id));
    } else if (['refund.processed', 'refund.failed', 'refund.created'].includes(eventType)) {
      const hinted = payload.payload?.refund?.entity;
      if (!hinted?.payment_id) throw new AppError('Invalid refund webhook.', 400);
      const payment = await prisma.payment.findUnique({ where: { gateway_payment_id: hinted.payment_id } });
      if (!payment) throw new AppError('Payment for refund not found.', 409);
      const refund = await prisma.billingRefund.findUnique({ where: { payment_id: payment.id } });
      if (refund && (refund.gateway_refund_id === hinted.id || (!refund.gateway_refund_id && refund.amount === hinted.amount))) {
        await saveRefundResult(payment, refund, await gateway.fetchGatewayRefund(hinted.id));
      } else await reconcileRefundBalance(payment, eventType === 'refund.processed' ? hinted.id : null);
    }
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true, processed_at: new Date(), processing_error: null } });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processing_error: error.message } });
    throw error;
  }
}
