import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mock, test } from 'node:test';
import { periodEnd, planAmount, discountedAmount, refundEligibility, publicPayment, REFUND_WINDOW_MS } from '../src/services/billingPolicy.js';

let payments, subscriptions, refunds, attempts, events, gatewayCalls, gatewayResult, refundResult, gatewayFailure, enabled, providerPayments, providerRefunds, couponValue, redemptions, providerOrders, refundRace;
const plan = { id: 'plan-pro', key: 'pro', name: 'Pro', is_active: true, price_monthly: 10000, price_yearly: 100000, currency: 'INR' };
const created = () => new Date(Date.now() - 60000);
const paymentFixture = extra => ({ id: 'payment-1', user_id: 'alice', plan_id: plan.id, amount: 10000, refunded_amount: 0, currency: 'INR', status: 'CAPTURED', gateway: 'razorpay', gateway_order_id: 'order_1', gateway_payment_id: 'pay_1', billing_cycle: 'MONTHLY', created_at: created(), subscription_id: 'sub-1', metadata: {}, plan, ...extra });
const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
  if (key === 'OR') return value.some(part => matches(row, part));
  if (key === 'payments') return payments.some(p => p.subscription_id === row.id && matches(p, value.some));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('in' in value) return value.in.includes(row[key]);
    if ('gt' in value) return row[key] > value.gt;
    if ('not' in value) return row[key] !== value.not;
  }
  return row[key] === value;
});
const table = getter => ({
  findUnique: async ({ where }) => getter().find(row => matches(row, where)) || null,
  findFirst: async ({ where }) => [...getter()].reverse().find(row => matches(row, where)) || null,
  findMany: async ({ where = {} } = {}) => getter().filter(row => matches(row, where)),
  count: async ({ where = {} } = {}) => getter().filter(row => matches(row, where)).length,
  create: async ({ data }) => { const row = { id: crypto.randomUUID(), created_at: new Date(), updated_at: new Date(), metadata: {}, refunded_amount: 0, status: 'REQUESTED', gateway_refund_id: null, payment_id: null, ...data }; getter().push(row); return row; },
  update: async ({ where, data }) => { const row = getter().find(row => matches(row, where)); assert.ok(row, 'row to update exists'); Object.assign(row, data); return row; },
  updateMany: async ({ where, data }) => { const rows = getter().filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
  upsert: async ({ where, update, create }) => { const row = getter().find(row => matches(row, where)); if (row) { Object.assign(row, update); return row; } const fresh = { id: crypto.randomUUID(), created_at: new Date(), metadata: {}, refunded_amount: 0, subscription_id: null, ...create }; getter().push(fresh); return fresh; },
});
let queue = Promise.resolve();
const db = {
  payment: table(() => payments), subscription: table(() => subscriptions), billingRefund: table(() => refunds), billingCheckout: table(() => attempts), webhookEvent: table(() => events),
  billingProfile: { findUnique: async () => null },
  user: { findUnique: async () => ({ id: 'alice' }) },
  plan: { findUnique: async () => plan },
  coupon: { findUnique: async () => couponValue, update: async () => { couponValue.times_redeemed++; return couponValue; } },
  couponRedemption: table(() => redemptions),
  $queryRaw: async () => [],
  $executeRaw: async () => 1,
  $transaction: fn => { const result = queue.then(() => fn(db)); queue = result.catch(() => {}); return result; },
};
const originalFindCheckout = db.billingCheckout.findUnique;
const createCheckout = db.billingCheckout.create;
db.billingCheckout.create = ({ data }) => createCheckout({ data: { status: 'CREATING', ...data } });
db.billingCheckout.findUnique = args => args.where.user_id_request_key ? originalFindCheckout({ where: args.where.user_id_request_key }) : originalFindCheckout(args);
const findRedemption = db.couponRedemption.findUnique;
db.couponRedemption.findUnique = args => findRedemption({ where: args.where.coupon_id_user_id });
mock.module('../src/config/prismaClient.js', { defaultExport: db });
mock.module('../src/config/config.js', { namedExports: { config: { razorpay: { keySecret: 'test-only-secret', webhookSecret: 'webhook-test-secret' } } } });
mock.module('../src/services/planLimitService.js', { namedExports: { invalidateSubscriptionCache: async () => {} } });
mock.module('../src/services/billingGateway.js', { namedExports: {
  gatewayConfigured: () => enabled,
  gatewayPublicKey: () => 'test-only-key',
  createGatewayOrder: async input => { gatewayCalls.push({ operation: 'order', input }); if (gatewayFailure) throw gatewayFailure; return { id: 'order_new', amount: input.amount, currency: input.currency }; },
  fetchGatewayOrder: async id => providerOrders.find(order => order.id === id),
  fetchOrdersByReceipt: async () => ({ items: providerOrders }),
  fetchGatewayPayment: async () => { gatewayCalls.push({ operation: 'fetch-payment' }); return gatewayResult; },
  fetchOrderPayments: async () => ({ items: providerPayments }),
  createGatewayRefund: async (...args) => { gatewayCalls.push({ operation: 'refund', args }); if (refundRace) await refundRace(); if (gatewayFailure) throw gatewayFailure; return refundResult; },
  fetchGatewayRefund: async () => refundResult,
  fetchProcessedRefunds: async () => providerRefunds,
} });
const billing = await import('../src/services/billing.service.js');
const reset = () => {
  payments = [paymentFixture()]; subscriptions = [{ id: 'sub-1', user_id: 'alice', plan_id: plan.id, plan, status: 'ACTIVE', current_period_end: new Date(Date.now() + 86400000), started_at: created(), payments: [] }];
  refunds = []; attempts = []; events = []; gatewayCalls = []; enabled = true; gatewayFailure = null;
  couponValue = null; redemptions = []; refundRace = null;
  providerOrders = [];
  gatewayResult = { id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 10000, currency: 'INR' };
  refundResult = { id: 'rfnd_1', payment_id: 'pay_1', amount: 10000, status: 'pending' }; providerRefunds = []; providerPayments = [];
};
const refundInput = { paymentId: 'payment-1', reason: 'Purchased the wrong plan', note: '', acceptedTerms: true };
const orderInput = { planKey: 'pro', billingCycle: 'MONTHLY', requestKey: 'test-checkout-key-123456', expectedPurchaseId: 'payment-1' };
const verification = () => ({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: crypto.createHmac('sha256', 'test-only-secret').update('order_1|pay_1').digest('hex') });

test('billing dates clamp month ends, leap days, and preserve UTC time', () => {
  assert.equal(periodEnd('2026-01-31T12:30:00Z', 'MONTHLY').toISOString(), '2026-02-28T12:30:00.000Z');
  assert.equal(periodEnd('2024-02-29T08:00:00Z', 'YEARLY').toISOString(), '2025-02-28T08:00:00.000Z');
  assert.equal(periodEnd('2026-11-30T00:00:00Z', 'QUARTERLY').toISOString(), '2027-02-28T00:00:00.000Z');
});
test('prices use integer minor units, explicit zero, safe discounts, and cycle validation', () => {
  assert.equal(planAmount({ ...plan, price_yearly: 0 }, 'YEARLY'), 0);
  assert.equal(planAmount(plan, 'QUARTERLY'), 30000);
  assert.equal(discountedAmount(101, { discount_type: 'PERCENT', discount_value: 50 }), 50);
  assert.equal(discountedAmount(100, { discount_type: 'FLAT', discount_value: 200 }), 0);
  assert.throws(() => planAmount(plan, 'WEEKLY'));
  assert.throws(() => discountedAmount(100, { discount_type: 'PERCENT', discount_value: 101 }));
});
test('refund deadline is exclusive, remaining balance accounts for partial refunds', () => {
  const p = paymentFixture({ created_at: new Date('2026-01-01T00:00:00Z'), refunded_amount: 2500 });
  assert.equal(refundEligibility(p, null, new Date(p.created_at.getTime() + REFUND_WINDOW_MS - 1)).amount, 7500);
  assert.equal(refundEligibility(p, null, new Date(p.created_at.getTime() + REFUND_WINDOW_MS)).eligible, false);
  assert.equal(refundEligibility({ ...p, amount: 0 }, null, p.created_at).eligible, false);
  assert.equal(refundEligibility({ ...p, gateway: 'mock_payment' }, null, p.created_at).eligible, false);
});
test('public payment data excludes signatures, internal metadata, and unrelated user data', () => {
  const view = publicPayment(paymentFixture({ gateway_signature: 'secret', metadata: { private: 'secret' }, user: { passwordHash: 'secret' } }));
  assert.equal(JSON.stringify(view).includes('secret'), false);
});
test('missing provider configuration fails closed without creating a payment or granting access', async () => {
  reset(); enabled = false;
  await assert.rejects(billing.createBillingOrder('alice', orderInput), error => error.errorCode === 'PAYMENTS_UNAVAILABLE');
  assert.equal(attempts.length, 0); assert.equal(payments.length, 1);
});
test('order retries reuse a durable checkout and do not create a second provider charge', async () => {
  reset();
  const first = await billing.createBillingOrder('alice', orderInput);
  const again = await billing.createBillingOrder('alice', orderInput);
  assert.equal(first.orderId, again.orderId);
  assert.equal(gatewayCalls.filter(c => c.operation === 'order').length, 1);
});
test('uncertain order creation blocks another charge with a new request key', async () => {
  reset(); gatewayFailure = Object.assign(new Error('Provider timeout'), { errorCode: 'PAYMENT_UNCERTAIN' });
  await assert.rejects(billing.createBillingOrder('alice', orderInput));
  assert.equal(attempts[0].status, 'UNKNOWN'); gatewayFailure = null;
  await assert.rejects(billing.createBillingOrder('alice', { ...orderInput, requestKey: 'another-request-key-123' }), error => error.statusCode === 409);
  assert.equal(gatewayCalls.length, 1);
});
test('verification checks ownership before calling the provider and rejects bad signatures', async () => {
  reset();
  await assert.rejects(billing.verifyBillingPayment('mallory', verification()), error => error.statusCode === 404);
  await assert.rejects(billing.verifyBillingPayment('alice', { ...verification(), razorpay_signature: '0'.repeat(64) }), error => error.statusCode === 400);
  assert.equal(gatewayCalls.length, 0);
});
test('authorized payments do not activate access; wrong currency or amount is rejected', async () => {
  reset(); payments[0].status = 'CREATED'; payments[0].subscription_id = null; subscriptions = [];
  gatewayResult.status = 'authorized';
  const result = await billing.verifyBillingPayment('alice', verification());
  assert.equal(result.status, 'AUTHORIZED'); assert.equal(subscriptions.length, 0);
  await assert.rejects(billing.settlePayment({ ...gatewayResult, currency: 'USD' }));
  await assert.rejects(billing.settlePayment({ ...gatewayResult, amount: 1 }));
});
test('concurrent capture delivery activates once and delayed failure cannot erase paid access', async () => {
  reset(); payments[0].status = 'CREATED'; payments[0].subscription_id = null; subscriptions = [];
  await Promise.all([billing.settlePayment(gatewayResult), billing.settlePayment(gatewayResult)]);
  assert.equal(subscriptions.length, 1); assert.equal(payments[0].status, 'CAPTURED');
  await billing.settlePayment({ ...gatewayResult, status: 'failed' });
  assert.equal(payments[0].status, 'CAPTURED'); assert.equal(subscriptions[0].status, 'ACTIVE');
});
test('a captured webhook after a refund cannot reactivate a refunded subscription', async () => {
  reset(); payments[0].status = 'REFUNDED'; subscriptions[0].status = 'CANCELED';
  await billing.settlePayment(gatewayResult);
  assert.equal(payments[0].status, 'REFUNDED'); assert.equal(subscriptions[0].status, 'CANCELED');
});
test('refund ownership, consent, note limits, and window are enforced server-side', async () => {
  reset();
  await assert.rejects(billing.requestBillingRefund('mallory', refundInput), error => error.statusCode === 404);
  await assert.rejects(billing.requestBillingRefund('alice', { ...refundInput, acceptedTerms: false }));
  await assert.rejects(billing.requestBillingRefund('alice', { ...refundInput, note: 'a'.repeat(1001) }));
  payments[0].created_at = new Date(Date.now() - REFUND_WINDOW_MS - 1);
  await assert.rejects(billing.requestBillingRefund('alice', refundInput));
  assert.equal(gatewayCalls.length, 0);
});
test('concurrent duplicate refunds create one durable request and do not mark pending money as returned', async () => {
  reset();
  await Promise.all([billing.requestBillingRefund('alice', refundInput), billing.requestBillingRefund('alice', refundInput)]);
  assert.equal(refunds.length, 1); assert.equal(gatewayCalls.filter(c => c.operation === 'refund').length, 1);
  assert.equal(refunds[0].status, 'PENDING'); assert.equal(payments[0].refunded_amount, 0); assert.equal(subscriptions[0].status, 'ACTIVE');
});
test('refund timeout preserves paid access and a retry reuses the identical provider idempotency key', async () => {
  reset(); gatewayFailure = Object.assign(new Error('Timed out'), { errorCode: 'PAYMENT_UNCERTAIN' });
  await assert.rejects(billing.requestBillingRefund('alice', refundInput));
  assert.equal(refunds[0].status, 'UNKNOWN'); assert.equal(payments[0].status, 'CAPTURED');
  gatewayFailure = null;
  await billing.syncBillingRefund('alice', 'payment-1');
  assert.deepEqual(gatewayCalls[0].args, gatewayCalls[1].args);
});
test('definitive gateway rejection never records a completed refund or cancels a plan', async () => {
  reset(); gatewayFailure = Object.assign(new Error('Rejected'), { errorCode: 'PAYMENT_REJECTED' });
  await assert.rejects(billing.requestBillingRefund('alice', refundInput));
  assert.equal(refunds[0].status, 'FAILED'); assert.equal(payments[0].refunded_amount, 0); assert.equal(subscriptions[0].status, 'ACTIVE');
});
test('duplicate refund events reconcile cumulative totals once and preserve a newer purchase', async () => {
  reset(); subscriptions[0].status = 'CANCELED'; subscriptions.push({ id: 'sub-newer', user_id: 'alice', status: 'ACTIVE' });
  providerRefunds = [{ id: 'rfnd_1', amount: 10000, status: 'processed' }];
  await billing.reconcileRefundBalance(payments[0]); await billing.reconcileRefundBalance(payments[0]);
  assert.equal(payments[0].refunded_amount, 10000); assert.equal(payments[0].status, 'REFUNDED');
  assert.equal(subscriptions[1].status, 'ACTIVE');
});
test('partial refunds do not cancel access and stale provider snapshots never reduce returned money', async () => {
  reset(); providerRefunds = [{ id: 'partial', amount: 2000 }];
  await billing.reconcileRefundBalance(payments[0]); providerRefunds = [];
  await billing.reconcileRefundBalance(payments[0]);
  assert.equal(payments[0].refunded_amount, 2000); assert.equal(payments[0].status, 'PARTIALLY_REFUNDED'); assert.equal(subscriptions[0].status, 'ACTIVE');
});
test('processed refund is completed only after reconciling the provider balance', async () => {
  reset(); refundResult.status = 'processed'; providerRefunds = [{ id: 'rfnd_1', amount: 10000 }];
  await billing.requestBillingRefund('alice', refundInput);
  assert.equal(refunds[0].status, 'PROCESSED'); assert.equal(payments[0].status, 'REFUNDED'); assert.equal(subscriptions[0].status, 'CANCELED');
});

test('a zero-charge coupon activates atomically without an unconfigured gateway or refundable fake charge', async () => {
  reset(); enabled = false;
  couponValue = { id: 'coupon-1', code: 'FREE100', is_active: true, valid_from: created(), valid_until: null, max_redemptions: 1, times_redeemed: 0, applicable_plans: ['pro'], discount_type: 'PERCENT', discount_value: 100 };
  const order = await billing.createBillingOrder('alice', { ...orderInput, couponCode: 'FREE100' });
  assert.equal(order.zeroCharge, true); assert.equal(gatewayCalls.length, 0);
  assert.equal(couponValue.times_redeemed, 1); assert.equal(redemptions.length, 1);
  const freeCharge = payments.find(p => p.id === order.paymentId);
  assert.equal(freeCharge.gateway, 'coupon_bypass'); assert.equal(refundEligibility(freeCharge, null).eligible, false);
});
test('limited coupons account for reserved checkouts as well as completed redemptions', async () => {
  reset();
  couponValue = { id: 'coupon-1', is_active: true, valid_from: created(), max_redemptions: 1, times_redeemed: 0, applicable_plans: [], discount_type: 'PERCENT', discount_value: 10 };
  attempts.push({ id: 'other-user-attempt', user_id: 'bob', coupon_id: 'coupon-1', status: 'READY', payment_id: 'other-payment' });
  await assert.rejects(billing.createBillingOrder('alice', { ...orderInput, couponCode: 'SAVE10' }), /fully reserved/);
  assert.equal(gatewayCalls.length, 0);
});
test('same-plan renewal extends existing time and an old delayed payment never replaces newer access', async () => {
  reset(); payments[0].status = 'CREATED'; payments[0].subscription_id = null;
  const end = subscriptions[0].current_period_end;
  await billing.settlePayment(gatewayResult);
  assert.equal(subscriptions[1].current_period_end.toISOString(), periodEnd(end,'MONTHLY').toISOString());
  reset(); payments[0].status = 'CREATED'; payments[0].subscription_id = null;
  subscriptions[0].payments = [{ created_at: new Date() }];
  await billing.settlePayment(gatewayResult);
  assert.equal(payments[0].metadata.fulfillmentStatus, 'REVIEW_REQUIRED'); assert.equal(subscriptions.length, 1);
});
test('the refund window starts from the provider payment timestamp rather than an abandoned old order', () => {
  const p = paymentFixture({ created_at: new Date(Date.now() - 30 * 86400000), metadata: { paidAt: new Date().toISOString() } });
  assert.equal(refundEligibility(p, null).eligible, true);
});
test('webhook replay is idempotent and re-fetches the current provider state for delayed events', async () => {
  reset(); payments[0].status = 'CREATED'; payments[0].subscription_id = null; subscriptions = [];
  const payload = { payload: { payment: { entity: { id: 'pay_1', status: 'failed' } } } };
  await billing.processBillingWebhook('event-1', 'payment.failed', payload);
  await billing.processBillingWebhook('event-1', 'payment.failed', payload);
  assert.equal(subscriptions.length, 1); assert.equal(payments[0].status, 'CAPTURED');
  assert.equal(gatewayCalls.filter(c => c.operation === 'fetch-payment').length, 1);
});
test('malformed and mismatched webhook signatures fail safely', () => {
  const signature = crypto.createHmac('sha256','test').update('body').digest('hex');
  assert.equal(billing.validSignature(signature,signature),true);
  assert.equal(billing.validSignature('not-hex',signature),false);
  assert.equal(billing.validSignature('0'.repeat(64),signature),false);
  assert.equal(billing.validSignature(null,signature),false);
});
test('administrative full-balance refunds share reliable processing and cannot pretend to perform partial refunds', async () => {
  reset(); payments[0].created_at = new Date(Date.now()-30*86400000);
  await assert.rejects(billing.requestAdministrativeRefund('payment-1', 10, 'Billing review'), /full remaining balance/);
  const result = await billing.requestAdministrativeRefund('payment-1', 100, 'Billing review');
  assert.equal(result.status,'PENDING'); assert.equal(payments[0].refunded_amount,0);
});
test('an uncertain order can be recovered by its exact provider receipt without a second order', async () => {
  reset(); gatewayFailure = Object.assign(new Error('Timed out'), { errorCode: 'PAYMENT_UNCERTAIN' });
  await assert.rejects(billing.createBillingOrder('alice', orderInput));
  const attempt = attempts[0]; gatewayFailure = null;
  providerOrders = [{ id: 'order_recovered', amount: 10000, currency: 'INR', receipt: attempt.id, notes: { checkoutId: attempt.id } }];
  const payment = await billing.syncBillingCheckout('alice', attempt.id);
  assert.equal(payment.gateway_order_id, 'order_recovered');
  assert.equal((await billing.createBillingOrder('alice', orderInput)).orderId, 'order_recovered');
  assert.equal(gatewayCalls.filter(c=>c.operation==='order').length,1);
  await assert.rejects(billing.syncBillingCheckout('mallory', attempt.id), error=>error.statusCode===404);
});
test('a provider-confirmed absent order can release an old uncharged reservation', async () => {
  reset(); attempts.push({ id:'never-created',user_id:'alice',amount:10000,status:'UNKNOWN',created_at:new Date(Date.now()-120000) });
  assert.equal((await billing.syncBillingCheckout('alice','never-created')).status,'NOT_CREATED');
  assert.equal(attempts[0].status,'FAILED'); assert.equal(payments.length,1);
});

test('fresh keys and stale tabs cannot silently purchase another renewal after capture', async () => {
  reset();
  const order = await billing.createBillingOrder('alice', orderInput);
  await billing.settlePayment({ id: 'pay_new', order_id: order.orderId, amount: 10000, currency: 'INR', status: 'captured' });
  await assert.rejects(billing.createBillingOrder('alice', { ...orderInput, requestKey: crypto.randomUUID() }), error => error.errorCode === 'PURCHASE_CHANGED');
  assert.equal(gatewayCalls.filter(call => call.operation === 'order').length, 1);
});

test('old READY and failed attempts with an existing order remain reusable across devices', async () => {
  reset();
  const first = await billing.createBillingOrder('alice', orderInput);
  attempts[0].created_at = new Date(Date.now() - 86400000);
  const second = await billing.createBillingOrder('alice', { ...orderInput, requestKey: crypto.randomUUID() });
  assert.equal(second.paymentId, first.paymentId);
  attempts[0].status = 'FAILED';
  const third = await billing.createBillingOrder('alice', { ...orderInput, requestKey: crypto.randomUUID() });
  assert.equal(third.paymentId, first.paymentId);
  assert.equal(gatewayCalls.filter(call => call.operation === 'order').length, 1);
});

test('multiple captured provider attempts are retained for review without granting twice', async () => {
  reset();
  providerPayments = [gatewayResult, { ...gatewayResult, id: 'pay_excess' }];
  const result = await billing.syncBillingPayment('alice', 'payment-1');
  assert.equal(result.fulfillmentStatus, 'REVIEW_REQUIRED');
  assert.deepEqual(payments[0].metadata.duplicateCharges, ['pay_excess']);
  assert.equal(subscriptions.length, 1);
});

test('signed webhook is durably acknowledged without calling the payment provider', async () => {
  reset();
  const { handleWebhook } = await import('../src/controllers/payments.controller.js');
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: gatewayResult } } }));
  let acknowledged = false;
  await handleWebhook({ body, headers: { 'x-razorpay-event-id': 'evt_durable', 'x-razorpay-signature': crypto.createHmac('sha256', 'webhook-test-secret').update(body).digest('hex') } }, { json: () => { acknowledged = true; } }, error => { throw error; });
  assert.equal(acknowledged, true);
  assert.equal(events.length, 1);
  assert.notEqual(events[0].processed, true);
  assert.equal(gatewayCalls.length, 0);
});

test('background recovery activates a captured purchase when callback and webhook never arrived', async () => {
  reset();
  const order = await billing.createBillingOrder('alice', orderInput);
  providerPayments = [{ ...gatewayResult, id: 'pay_recovered', order_id: order.orderId }];
  const { runBillingRecoveryJob } = await import('../src/services/billingRecovery.js');
  await runBillingRecoveryJob({ id: 'checkout:' + order.checkoutId, kind: 'CHECKOUT', resource_id: order.checkoutId, user_id: 'alice', failures: 0, lease_token: 'test' });
  const payment = payments.find(item => item.id === order.paymentId);
  assert.equal(payment.status, 'CAPTURED');
  assert.ok(payment.subscription_id);
  assert.equal(gatewayCalls.filter(call => call.operation === 'order').length, 1);
});

test('a stale refund timeout cannot overwrite a refund confirmed by another worker', async () => {
  reset();
  refundRace = async () => { refunds[0].status = 'PROCESSED'; refunds[0].gateway_refund_id = 'rfnd_confirmed'; };
  gatewayFailure = Object.assign(new Error('Lost response'), { errorCode: 'PAYMENT_UNCERTAIN' });
  await assert.rejects(billing.requestBillingRefund('alice', refundInput));
  assert.equal(refunds[0].status, 'PROCESSED');
  assert.equal(refunds[0].gateway_refund_id, 'rfnd_confirmed');
});
