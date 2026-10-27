import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import { config } from '../src/config/config.js';
import { PrismaClient } from '../src/generated/prisma/index.js';

test('local PostgreSQL billing: checkout, capture, profile snapshot, refund and replay are transactional', async t => {
  const host = config.db.connectionString ? new URL(config.db.connectionString).hostname : config.db.host;
  if (!['localhost','127.0.0.1','::1'].includes(host)) { t.skip('Billing fixtures only run against a local database'); return; }
  const client = new PrismaClient();
  const rollback = new Error('ROLLBACK_BILLING_FIXTURES');
  try {
    await client.$transaction(async tx => {
      mock.module('../src/config/prismaClient.js', { defaultExport: new Proxy(tx, { get(target, key) { if (key === '$transaction') return fn => fn(tx); const value = target[key]; return typeof value === 'function' ? value.bind(target) : value; } }) });
      mock.module('../src/services/planLimitService.js', { namedExports: { invalidateSubscriptionCache: async () => {}, getActiveSubscription: async () => null } });
      let refundStatus = 'pending', refundKey, paymentId;
      const orderId = 'order_qa_' + randomUUID();
      const gatewayId = 'pay_qa_' + randomUUID();
      mock.module('../src/services/billingGateway.js', { namedExports: {
        gatewayConfigured: () => true, gatewayPublicKey: () => 'qa-test-key',
        createGatewayOrder: async data => ({ id: orderId, amount: data.amount, currency: data.currency }),
        fetchGatewayOrder: async () => { throw new Error('Unexpected recovery'); },
        fetchOrdersByReceipt: async () => ({ items: [] }),
        fetchGatewayPayment: async () => ({ id: gatewayId, order_id: orderId, amount: 25000, currency: 'INR', status: 'captured' }),
        fetchOrderPayments: async () => ({ items: [] }),
        createGatewayRefund: async (id, amount, key) => { refundKey = key; return { id: 'rfnd_qa', payment_id: id, amount, status: refundStatus }; },
        fetchGatewayRefund: async () => ({ id: 'rfnd_qa', payment_id: gatewayId, amount: 25000, status: refundStatus }),
        fetchProcessedRefunds: async () => refundStatus === 'processed' ? [{ id: 'rfnd_qa', amount: 25000 }] : [],
      } });
      const billing = await import('../src/services/billing.service.js');
      const suffix = randomUUID();
      const user = await tx.user.create({ data: { name: 'Billing QA', email: 'billing-' + suffix + '@example.invalid' } });
      const plan = await tx.plan.create({ data: { key: 'qa' + suffix.slice(0, 12), name: 'QA paid plan', price_monthly: 25000, currency: 'INR' } });
      await tx.billingProfile.create({ data: { user_id: user.id, name: 'QA Company', email: 'billing@example.invalid', country: 'IN' } });
      const input = { planKey: plan.key, billingCycle: 'MONTHLY', requestKey: randomUUID() };
      const order = await billing.createBillingOrder(user.id, input); paymentId = order.paymentId;
      assert.equal((await billing.createBillingOrder(user.id, input)).paymentId, paymentId);
      const entity = { id: gatewayId, order_id: orderId, amount: 25000, currency: 'INR', status: 'captured' };
      await billing.settlePayment(entity); await billing.settlePayment(entity);
      assert.equal(await tx.subscription.count({ where: { user_id: user.id, status: 'ACTIVE' } }), 1);
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      assert.equal(payment.metadata.billingProfile.name, 'QA Company');
      const controllers = await import('../src/controllers/subscription.controller.js');
      let result;
      const response = { json: value => { result = value; } };
      const next = error => { throw error; };
      await controllers.getInvoices({ user: { id: user.id }, query: { search: plan.name, status: 'CAPTURED' } }, response, next);
      assert.equal(result.pagination.total, 1);
      assert.equal('gateway_signature' in result.data[0], false);
      await controllers.getInvoices({ user: { id: randomUUID() }, query: {} }, response, next);
      assert.equal(result.pagination.total, 0);
      await controllers.saveBillingProfile({ user: { id: user.id }, body: { name: 'Updated QA company', email: 'updated@example.invalid', country: 'IN' } }, response, next);
      assert.equal(result.data.name, 'Updated QA company');
      assert.equal((await tx.payment.findUnique({ where: { id: paymentId } })).metadata.billingProfile.name, 'QA Company');
      await assert.rejects(controllers.saveBillingProfile({ user: { id: user.id }, body: { name: 'Bad user', email: 'qa@example.invalid', country: 'IN', user_id: 'another-user' } }, response, next), error => error.statusCode === 400);
      await assert.rejects(controllers.saveBillingProfile({ user: { id: user.id }, body: { name: 'Bad tax ID', email: 'qa@example.invalid', country: 'IN', tax_id: 'invalid' } }, response, next), error => error.statusCode === 400);
      const request = { paymentId, reason: 'Integration test refund', acceptedTerms: true };
      const pending = await billing.requestBillingRefund(user.id, request);
      assert.equal(pending.status, 'PENDING'); assert.equal(refundKey, pending.id);
      assert.equal((await tx.payment.findUnique({ where: { id: paymentId } })).status, 'CAPTURED');
      refundStatus = 'processed';
      await billing.syncBillingRefund(user.id, paymentId);
      await billing.syncBillingRefund(user.id, paymentId);
      assert.equal((await tx.payment.findUnique({ where: { id: paymentId } })).refunded_amount, 25000);
      assert.equal(await tx.subscription.count({ where: { user_id: user.id, status: 'ACTIVE' } }), 0);
      assert.equal(await tx.billingRefund.count({ where: { payment_id: paymentId } }), 1);
      assert.equal((await billing.requestBillingRefund(user.id, request)).status, 'PROCESSED');
      await billing.settlePayment(entity);
      assert.equal(await tx.subscription.count({ where: { user_id: user.id, status: 'ACTIVE' } }), 0);
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await client.$disconnect(); }
});
