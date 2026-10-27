import { AppError } from '../utils/AppError.js';

export const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const CYCLES = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };
export const currencyMinorFactor = currency => 10 ** new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;

export function periodEnd(start, cycle) {
  if (!Object.hasOwn(CYCLES, cycle)) throw new AppError('Invalid billing cycle.', 400);
  const date = new Date(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + CYCLES[cycle]);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}

export function planAmount(plan, cycle) {
  if (!Object.hasOwn(CYCLES, cycle)) throw new AppError('Choose monthly, quarterly, or yearly billing.', 400);
  const amount = cycle === 'MONTHLY' ? plan.price_monthly : cycle === 'QUARTERLY'
    ? (plan.price_quarterly ?? plan.price_monthly * 3) : (plan.price_yearly ?? plan.price_monthly * 12);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new AppError('This plan has an invalid price. Contact billing support.', 409);
  return amount;
}

export function discountedAmount(amount, coupon) {
  if (!coupon) return amount;
  const value = coupon.discount_value;
  if (!Number.isSafeInteger(value) || value < 0 || (coupon.discount_type === 'PERCENT' && value > 100)) {
    throw new AppError('This discount is not configured correctly.', 409);
  }
  return Math.max(0, amount - (coupon.discount_type === 'PERCENT' ? Math.round(amount * value / 100) : value));
}

export function refundEligibility(payment, refund, now = new Date()) {
  const paidAt = new Date(payment.metadata?.paidAt || payment.created_at);
  const deadline = new Date(paidAt.getTime() + REFUND_WINDOW_MS);
  const remaining = Math.max(0, payment.amount - payment.refunded_amount);
  let reason = '';
  if (refund) reason = refund.status === 'PROCESSED' ? 'Refund already processed.' : 'A refund request already exists. Check its status.';
  else if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status)) reason = 'Only captured payments can be refunded.';
  else if (!remaining) reason = 'There is no refundable balance.';
  else if (payment.gateway !== 'razorpay' || !payment.gateway_payment_id) reason = 'No refundable gateway charge. Contact support for a billing review.';
  else if (!Number.isFinite(deadline.getTime()) || paidAt > now || now >= deadline) reason = 'The 14-day self-service refund window has ended.';
  return { eligible: !reason, reason, amount: remaining, deadline: Number.isFinite(deadline.getTime()) ? deadline.toISOString() : null };
}

export function publicPayment(payment, refund = null) {
  return {
    id: payment.id, subscription_id: payment.subscription_id, amount: payment.amount,
    currency: payment.currency, billing_cycle: payment.billing_cycle, status: payment.status,
    gateway: payment.gateway, gateway_order_id: payment.gateway_order_id,
    gateway_payment_id: payment.gateway_payment_id, refunded_amount: payment.refunded_amount,
    created_at: payment.created_at, paidAt: payment.metadata?.paidAt || null, failure_reason: payment.failure_reason,
    plan: payment.plan && { key: payment.plan.key, name: payment.plan.name },
    fulfillmentStatus: payment.metadata?.fulfillmentStatus || null,
    billingProfile: payment.metadata?.billingProfile || null,
    refund: refund && { id: refund.id, status: refund.status, amount: refund.amount, reason: refund.reason,
      gateway_refund_id: refund.gateway_refund_id, failure_reason: refund.failure_reason, created_at: refund.created_at, updated_at: refund.updated_at },
    refundEligibility: refundEligibility(payment, refund),
  };
}
