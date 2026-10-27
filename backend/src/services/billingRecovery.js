import crypto from 'node:crypto';
import prisma from '../config/prismaClient.js';
import { processBillingWebhook, syncBillingCheckout, syncBillingRefund, syncBillingPayment } from './billing.service.js';

// PostgreSQL is the durable queue. Redis and the customer's browser are optional.
// Seed queries also repair a crash between committing a purchase and scheduling work.
export async function seedBillingRecovery(db = prisma) {
  await db.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id)
    SELECT 'webhook:' || event_id, 'WEBHOOK', event_id FROM "WebhookEvent" WHERE processed = false
    ON CONFLICT (id) DO NOTHING`;
  await db.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id, user_id)
    SELECT 'checkout:' || id, 'CHECKOUT', id, user_id FROM "BillingCheckout"
    ON CONFLICT (id) DO NOTHING`;
  await db.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id, user_id)
    SELECT 'refund:' || payment_id, 'REFUND', payment_id, user_id FROM "BillingRefund"
    WHERE status NOT IN ('PROCESSED', 'FAILED') ON CONFLICT (id) DO NOTHING`;
  await db.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id, user_id)
    SELECT 'payment:' || p.id, 'PAYMENT', p.id, p.user_id FROM "Payment" p
    WHERE p.gateway = 'razorpay' AND NOT EXISTS (SELECT 1 FROM "BillingCheckout" c WHERE c.payment_id = p.id)
    ON CONFLICT (id) DO NOTHING`;
}

export async function claimBillingRecovery(db = prisma, onlyId = null) {
  const token = crypto.randomUUID();
  const rows = await db.$queryRaw`WITH candidate AS (
    SELECT id FROM "BillingRecoveryJob" WHERE due_at <= NOW()
      AND (${onlyId}::text IS NULL OR id = ${onlyId})
      AND (lease_until IS NULL OR lease_until < NOW())
    ORDER BY due_at, id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE "BillingRecoveryJob" j SET lease_token = ${token},
    lease_until = NOW() + INTERVAL '5 minutes', updated_at = NOW()
    FROM candidate c WHERE j.id = c.id RETURNING j.*`;
  return rows[0] || null;
}

export function recoveryDelay(failures, retryAfter = 0, random = Math.random) {
  return Math.min(86400000, Math.max(15000 * 2 ** Math.min(failures, 12) * (0.8 + random() * 0.4), retryAfter));
}

export async function finishBillingRecovery(job, { error, delay = 3600000, review = false, done = false } = {}, db = prisma) {
  if (done && !error) return db.$executeRaw`DELETE FROM "BillingRecoveryJob" WHERE id = ${job.id} AND lease_token = ${job.lease_token}`;
  const failures = error ? job.failures + 1 : 0;
  const due = new Date(Date.now() + (error ? recoveryDelay(failures, error.retryAfterMs) : delay));
  // Fencing prevents an expired worker from overwriting a newer worker's result.
  return db.$executeRaw`UPDATE "BillingRecoveryJob" SET due_at = ${due}, lease_until = NULL,
    lease_token = NULL, failures = ${failures}, last_error = ${error ? String(error.message).slice(0, 500) : null},
    review_required = ${review || failures >= 8}, updated_at = NOW()
    WHERE id = ${job.id} AND lease_token = ${job.lease_token}`;
}

export async function runBillingRecoveryJob(job) {
  try {
    if (job.kind === 'WEBHOOK') {
      const event = await prisma.webhookEvent.findUnique({ where: { event_id: job.resource_id } });
      if (event && !event.processed) await processBillingWebhook(event.event_id, event.event_type, event.payload);
      return finishBillingRecovery(job, { done: true });
    }
    if (job.kind === 'REFUND') {
      if (!await prisma.billingRefund.findUnique({ where: { payment_id: job.resource_id } })) return finishBillingRecovery(job, { done: true });
      const refund = await syncBillingRefund(job.user_id, job.resource_id);
      return finishBillingRecovery(job, { done: ['PROCESSED', 'FAILED'].includes(refund.status), delay: 60000 });
    }
    if (!await prisma.user.findUnique({ where: { id: job.user_id }, select: { id: true } })) return finishBillingRecovery(job, { done: true });
    const source = job.kind === 'PAYMENT' ? await prisma.payment.findUnique({ where: { id: job.resource_id } }) : await prisma.billingCheckout.findUnique({ where: { id: job.resource_id } });
    if (!source) return finishBillingRecovery(job, { done: true });
    const result = job.kind === 'PAYMENT' ? await syncBillingPayment(job.user_id, job.resource_id) : await syncBillingCheckout(job.user_id, job.resource_id);
    const terminal = ['CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'NOT_CREATED'].includes(result.status);
    await finishBillingRecovery(job, { delay: terminal ? 86400000 : 300000,
      review: result.fulfillmentStatus === 'REVIEW_REQUIRED' || (!terminal && Date.now() - new Date(source.created_at).getTime() > 86400000) });
  } catch (error) {
    await finishBillingRecovery(job, { error });
    console.error('Billing recovery needs retry', { job: job.id, code: error.errorCode || 'RECOVERY_FAILED' });
  }
}

export function startBillingRecovery() {
  let stopped = false, timer;
  async function tick() {
    try {
      await seedBillingRecovery();
      // Bound each batch so provider outages do not produce a request flood.
      for (let count = 0; count < 10 && !stopped; count++) {
        const job = await claimBillingRecovery();
        if (!job) break;
        await runBillingRecoveryJob(job);
      }
    } catch (error) { console.error('Billing recovery database unavailable:', error.code || error.name); }
    if (!stopped) timer = setTimeout(tick, 15000);
  }
  void tick();
  return () => { stopped = true; clearTimeout(timer); };
}
