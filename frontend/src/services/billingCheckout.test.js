import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
let calls, outcome, verifyStatus, failVerify, token, stored, openCount;
const api = { post: async (path, body) => {
  calls.push({ path, body });
  if (path.endsWith('create-order')) return { data: { zeroCharge: outcome === 'zero', data: { paymentId: 'payment-1', orderId: 'order-1', amount: outcome === 'zero' ? 0 : 19900, currency: 'INR', status: outcome === 'zero' ? 'CAPTURED' : outcome === 'authorized-order' ? 'AUTHORIZED' : 'CREATED', keyId: 'test-only-key' } } };
  if (failVerify) throw new Error('Provider result unknown');
  return { data: { data: { status: verifyStatus, fulfillmentStatus: outcome === 'review' ? 'REVIEW_REQUIRED' : 'ACTIVE' } } };
} };
mock.module('./urlApi.js', { defaultExport: api, namedExports: { getAccessToken: () => token } });
const { startBillingCheckout, loadCheckoutScript } = await import('./billingCheckout.js');
function reset() {
  calls = []; outcome = 'captured'; verifyStatus = 'CAPTURED'; failVerify = false; token = 'alice-token'; stored = new Map(); openCount = 0;
  globalThis.sessionStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  globalThis.window = { Razorpay: class {
    constructor(options) { this.options = options; }
    on(name, callback) { this.failure = callback; }
    close() { this.options.modal.ondismiss(); }
    open() { openCount++; queueMicrotask(() => {
      if (outcome === 'dismissed') return this.options.modal.ondismiss();
      if (outcome === 'failed') return this.failure();
      if (outcome === 'account-switch') token = 'bob-token';
      this.options.handler({ razorpay_order_id: 'order-1', razorpay_payment_id: 'pay-1', razorpay_signature: 'test-signature' });
    }); }
  } };
}
const input = { user: { id: 'alice', name: 'Alice', email: 'alice@example.invalid' }, planKey: 'pro', billingCycle: 'MONTHLY' };
test('checkout grants success only after server-confirmed capture and clears the completed key', async () => {
  reset(); assert.equal((await startBillingCheckout(input)).status, 'CAPTURED');
  assert.equal(calls.length, 2); assert.equal(stored.size, 0);
});

test('checkout submits the purchase snapshot the customer reviewed', async () => {
  reset();
  await startBillingCheckout({ ...input, expectedPurchaseId: 'previous-purchase' });
  assert.equal(calls[0].body.expectedPurchaseId, 'previous-purchase');
});
test('dismissed checkout preserves its request key so reopening does not create another order', async () => {
  reset(); outcome = 'dismissed';
  assert.equal((await startBillingCheckout(input)).status, 'DISMISSED');
  await startBillingCheckout(input);
  assert.equal(calls[0].body.requestKey, calls[1].body.requestKey); assert.equal(calls.length, 2);
});
test('authorization, zero-charge and declined payment states stay distinct', async () => {
  reset(); verifyStatus = 'AUTHORIZED'; assert.equal((await startBillingCheckout(input)).status, 'AUTHORIZED');
  reset(); outcome = 'zero'; assert.equal((await startBillingCheckout(input)).status, 'CAPTURED'); assert.equal(openCount, 0);
  reset(); outcome = 'failed'; assert.equal((await startBillingCheckout(input)).status, 'FAILED'); assert.equal(calls.length, 1);
  reset(); outcome = 'authorized-order'; assert.equal((await startBillingCheckout(input)).status, 'AUTHORIZED'); assert.equal(openCount, 0);
});
test('verification timeout is reported as uncertain and keeps the recovery key', async () => {
  reset(); failVerify = true;
  await assert.rejects(startBillingCheckout(input), error => error.paymentUncertain && error.paymentId === 'payment-1');
  assert.equal(stored.size, 1);
});
test('an account switch during provider checkout cannot verify into another account', async () => {
  reset(); outcome = 'account-switch';
  await assert.rejects(startBillingCheckout(input), /account changed/);
  assert.equal(calls.length, 1);
});
test('a delayed captured payment requiring review never claims that the plan is ready', async () => {
  reset(); outcome = 'review'; assert.equal((await startBillingCheckout(input)).status, 'REVIEW_REQUIRED');
});
test('provider script load failure can be retried without leaving a stalled promise', async () => {
  reset(); window.Razorpay = null;
  globalThis.document = { createElement: () => ({ remove() {} }), body: { appendChild: script => queueMicrotask(() => script.onerror()) } };
  await assert.rejects(loadCheckoutScript(), /could not load/);
  await assert.rejects(loadCheckoutScript(), /could not load/);
});
