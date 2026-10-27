import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { config } from '../src/config/config.js';
import prisma from '../src/config/prismaClient.js';
import { claimBillingRecovery, finishBillingRecovery, recoveryDelay, seedBillingRecovery } from '../src/services/billingRecovery.js';

test('recovery backoff is bounded, jittered and respects provider Retry-After', () => {
  assert.equal(recoveryDelay(1, 0, () => 0.5), 30000);
  assert.equal(recoveryDelay(1, 120000, () => 0.5), 120000);
  assert.ok(recoveryDelay(100, 0, () => 0.5) <= 86400000);
});

test('PostgreSQL recovery leases survive crashes, exclude parallel workers and fence stale writes', async t => {
  const host = config.db.connectionString ? new URL(config.db.connectionString).hostname : config.db.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { t.skip('Local database only'); return; }
  const id = 'qa-recovery:' + randomUUID();
  // Isolate claim operations to a temporary table visible only to this transaction.
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "BillingRecoveryJob" (LIKE public."BillingRecoveryJob" INCLUDING ALL) ON COMMIT DROP');
    await tx.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id, due_at) VALUES (${id}, 'CHECKOUT', 'qa', NOW() - INTERVAL '1 second')`;
    const first = await claimBillingRecovery(tx);
    assert.equal(first.id, id);
    assert.equal(await claimBillingRecovery(tx), null);
    await tx.$executeRaw`UPDATE "BillingRecoveryJob" SET lease_until = NOW() - INTERVAL '1 second' WHERE id = ${id}`;
    const restarted = await claimBillingRecovery(tx);
    assert.notEqual(first.lease_token, restarted.lease_token);
    assert.equal(await finishBillingRecovery(first, { done: true }, tx), 0);
    assert.equal(await finishBillingRecovery(restarted, { error: new Error('provider unavailable') }, tx), 1);
    const rows = await tx.$queryRaw`SELECT * FROM "BillingRecoveryJob" WHERE id = ${id}`;
    assert.equal(rows[0].failures, 1);
    assert.equal(rows[0].lease_token, null);
    assert.ok(rows[0].due_at > new Date());
    await seedBillingRecovery(tx);
  });
});

test.after(async () => { await prisma.$disconnect(); });

test('two independent PostgreSQL worker claims cannot lease the same job', async t => {
  const host = config.db.connectionString ? new URL(config.db.connectionString).hostname : config.db.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { t.skip('Local database only'); return; }
  const id = 'qa-concurrent:' + randomUUID();
  try {
    await prisma.$executeRaw`INSERT INTO "BillingRecoveryJob" (id, kind, resource_id, due_at) VALUES (${id}, 'CHECKOUT', 'qa', NOW() - INTERVAL '1 second')`;
    const results = await Promise.all([claimBillingRecovery(prisma, id), claimBillingRecovery(prisma, id)]);
    assert.equal(results.filter(Boolean).length, 1);
  } finally { await prisma.$executeRaw`DELETE FROM "BillingRecoveryJob" WHERE id = ${id}`; }
});
