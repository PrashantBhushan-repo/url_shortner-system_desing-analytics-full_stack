import prisma from '../config/prismaClient.js';
import { AppError } from '../utils/AppError.js';

export async function listBillingRecovery(req, res, next) {
  try {
    const jobs = await prisma.$queryRaw`SELECT id, kind, resource_id, user_id, due_at, lease_until,
      failures, last_error, review_required, updated_at FROM "BillingRecoveryJob"
      WHERE review_required = true OR failures > 0 ORDER BY review_required DESC, due_at LIMIT 100`;
    const unprocessedWebhooks = await prisma.webhookEvent.count({ where: { processed: false } });
    const reviews = await prisma.payment.findMany({ where: { metadata: { path: ['fulfillmentStatus'], equals: 'REVIEW_REQUIRED' } }, select: { id: true, user_id: true, gateway_order_id: true, gateway_payment_id: true, amount: true, currency: true, metadata: true }, take: 100, orderBy: { created_at: 'desc' } });
    const heartbeat = await prisma.$queryRaw`SELECT MAX(updated_at) AS last_activity FROM "BillingRecoveryJob"`;
    res.json({ success: true, data: { jobs, reviews, unprocessedWebhooks, lastActivity: heartbeat[0]?.last_activity || null } });
  } catch (error) { next(error); }
}

export async function retryBillingRecovery(req, res, next) {
  try {
    const count = await prisma.$executeRaw`UPDATE "BillingRecoveryJob" SET due_at = NOW(), failures = 0,
      last_error = NULL, updated_at = NOW() WHERE id = ${req.params.id}
      AND (lease_until IS NULL OR lease_until < NOW())`;
    if (!count) throw new AppError('Job not found or currently processing. Refresh before retrying.', 409);
    res.json({ success: true, message: 'Recovery scheduled. No new payment order was created.' });
  } catch (error) { next(error); }
}
