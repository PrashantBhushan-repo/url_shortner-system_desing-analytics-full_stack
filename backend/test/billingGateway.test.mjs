import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
const config = { razorpay: { keyId: 'qa-key', keySecret: 'qa-secret' } };
mock.module('../src/config/config.js', { namedExports: { config } });
const gateway = await import('../src/services/billingGateway.js');
test('provider refunds carry the stable idempotency key and integer amount', async () => {
  let request;
  globalThis.fetch = async (url, options) => { request = { url, ...options }; return { ok: true, json: async () => ({ id: 'rfnd-test' }) }; };
  await gateway.createGatewayRefund('pay-test', 199, 'durable-key-12345');
  assert.equal(request.headers['X-Refund-Idempotency'], 'durable-key-12345');
  assert.deepEqual(JSON.parse(request.body), { amount: 199, speed: 'normal' });
});
test('network timeouts and provider errors are uncertain; definitive rejections do not expose bank errors', async () => {
  globalThis.fetch = async () => { throw new Error('socket secret'); };
  await assert.rejects(gateway.fetchGatewayPayment('pay-test'), error => error.errorCode === 'PAYMENT_UNCERTAIN' && !error.message.includes('secret'));
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { description: 'private bank detail' } }) });
  await assert.rejects(gateway.fetchGatewayPayment('pay-test'), error => error.errorCode === 'PAYMENT_REJECTED' && !error.message.includes('bank detail'));
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(gateway.fetchGatewayPayment('pay-test'), error => error.errorCode === 'PAYMENT_UNCERTAIN');
});
test('refund reconciliation ignores pending and failed refund amounts', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ items: [{ id: 'a', status: 'processed', amount: 100 }, { id: 'b', status: 'pending', amount: 200 }, { id: 'c', status: 'failed', amount: 300 }] }) });
  assert.deepEqual(await gateway.fetchProcessedRefunds('pay-test'), [{ id: 'a', status: 'processed', amount: 100 }]);
});

test('provider throttling preserves the Retry-After deadline for durable recovery', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get: () => '120' }, json: async () => ({}) });
  await assert.rejects(gateway.fetchGatewayPayment('pay-test'), error => error.retryAfterMs === 120000 && error.errorCode === 'PAYMENT_UNCERTAIN');
});
