import { z } from 'zod';
import prisma from '../config/prismaClient.js';
import { AppError } from '../utils/AppError.js';
import { getActiveSubscription, invalidateSubscriptionCache } from '../services/planLimitService.js';
import { requestBillingRefund, syncBillingRefund } from '../services/billing.service.js';
import { publicPayment } from '../services/billingPolicy.js';
import { gatewayConfigured } from '../services/billingGateway.js';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).default(''), address: z.string().trim().max(500).default(''),
  city: z.string().trim().max(100).default(''), region: z.string().trim().max(100).default(''),
  postal_code: z.string().trim().max(20).default(''), country: z.string().regex(/^[A-Z]{2}$/),
  tax_id: z.string().trim().max(40).default(''),
}).strict().superRefine((profile, ctx) => {
  if (profile.country === 'IN' && profile.tax_id && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(profile.tax_id)) ctx.addIssue({ code: 'custom', path: ['tax_id'], message: 'Enter a valid 15-character GSTIN or leave it blank.' });
});

export const getSubscriptionInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sub = await getActiveSubscription(userId);
    const latestPurchase = await prisma.payment.findFirst({ where: { user_id: userId, subscription_id: { not: null } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: { id: true } });
    if (!sub) throw new AppError('No plan is configured for this account. Contact billing support.', 409);
    const [urlsCount, teamMembersCount, webhooksCount, customDomainsCount, checkouts] = await Promise.all([
      prisma.url.count({ where: { user_id: userId, is_active: true } }),
      prisma.teamMember.count({ where: { team: { owner_id: userId }, status: 'ACCEPTED' } }),
      prisma.webhook.count({ where: { user_id: userId, is_active: true } }),
      prisma.customDomain.count({ where: { user_id: userId } }),
      prisma.billingCheckout.findMany({ where: { user_id: userId, status: { in: ['CREATING', 'UNKNOWN', 'AUTHORIZED', 'READY'] } }, orderBy: { created_at: 'desc' }, take: 5, select: { id: true, status: true, payment_id: true, created_at: true } }),
    ]);
    res.json({ success: true, data: {
      subscription: { id: sub.id, billingCycle: sub.billing_cycle, status: sub.status, startedAt: sub.started_at, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), canceledAt: sub.canceled_at, managed: sub.id === 'bypass-sub-id' },
      plan: { key: sub.plan.key, name: sub.plan.name, description: sub.plan.description, currency: sub.plan.currency, priceMonthly: sub.plan.price_monthly ?? sub.plan.priceMonthly, priceQuarterly: sub.plan.price_quarterly, priceYearly: sub.plan.price_yearly },
      limits: sub.plan.limit, usage: { urlsCount, teamMembersCount, webhooksCount, customDomainsCount },
      billing: { configured: gatewayConfigured(), mode: 'ONE_TIME', refundWindowDays: 14, purchaseId: latestPurchase?.id || null, checkouts },
    } });
  } catch (error) { next(error); }
};

async function subscriptionAction(userId, action) {
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text`;
    const pending = await tx.billingRefund.findFirst({ where: { user_id: userId, status: { in: ['REQUESTED', 'PROCESSING', 'PENDING', 'UNKNOWN'] } } });
    if (pending) throw new AppError('Wait for the pending refund before changing your plan.', 409);
    const active = await tx.subscription.findFirst({ where: { user_id: userId, status: 'ACTIVE', OR: [{ current_period_end: null }, { current_period_end: { gt: new Date() } }] }, include: { plan: true }, orderBy: { started_at: 'desc' } });
    if (!active || active.plan.key === 'free') throw new AppError('There is no active paid plan to change.', 409);
    if (action === 'cancel' && !active.current_period_end) throw new AppError('This managed subscription requires a billing review.', 409);
    return tx.subscription.update({ where: { id: active.id }, data: { cancel_at_period_end: action === 'cancel', canceled_at: action === 'cancel' ? new Date() : null } });
  });
  await invalidateSubscriptionCache(userId);
  return result;
}

export const cancelSubscription = async (req, res, next) => {
  try { res.json({ success: true, message: 'Downgrade scheduled for the end of your paid period. No refund has been requested.', data: await subscriptionAction(req.user.id, 'cancel') }); }
  catch (error) { next(error); }
};
export const resumeSubscription = async (req, res, next) => {
  try { res.json({ success: true, message: 'Scheduled downgrade removed. Renew manually to extend paid access.', data: await subscriptionAction(req.user.id, 'resume') }); }
  catch (error) { next(error); }
};

// A free downgrade preserves the period already purchased instead of discarding paid time.
export const changeSubscription = async (req, res, next) => {
  if (req.body?.planKey !== 'free') return next(new AppError('Paid plans require checkout.', 403));
  return cancelSubscription(req, res, next);
};

export const listPlansPublic = async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.plan.findMany({ where: { is_active: true }, include: { limit: true }, orderBy: { sort_order: 'asc' } }) }); }
  catch (error) { next(error); }
};

export const getInvoices = async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    if (!Number.isInteger(page)) throw new AppError('Invalid page number.', 400);
    const status = req.query.status || 'ALL';
    if (!['ALL', 'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status)) throw new AppError('Invalid payment status filter.', 400);
    const search = String(req.query.search || '').slice(0, 100).trim();
    const where = { user_id: req.user.id, ...(status === 'ALL' ? {} : { status }), ...(search ? { OR: [{ gateway_order_id: { contains: search, mode: 'insensitive' } }, { id: { contains: search, mode: 'insensitive' } }, { plan: { name: { contains: search, mode: 'insensitive' } } }] } : {}) };
    const [payments, total] = await Promise.all([prisma.payment.findMany({ where, include: { plan: true }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip: (page - 1) * 10, take: 10 }), prisma.payment.count({ where })]);
    const refunds = await prisma.billingRefund.findMany({ where: { payment_id: { in: payments.map(p => p.id) } } });
    res.json({ success: true, data: payments.map(payment => publicPayment(payment, refunds.find(refund => refund.payment_id === payment.id))), pagination: { page, pageSize: 10, total, pages: Math.ceil(total / 10) } });
  } catch (error) { next(error); }
};

export const requestRefund = async (req, res, next) => {
  try {
    const result = await requestBillingRefund(req.user.id, req.body);
    res.status(result.status === 'PROCESSED' ? 200 : 202).json({ success: true, message: result.status === 'PROCESSED' ? 'The provider processed your refund. Your bank may take 5–7 working days to show the credit.' : 'Your refund request is recorded. Check its status for provider confirmation.', data: result });
  } catch (error) { next(error); }
};
export const syncRefund = async (req, res, next) => {
  try { res.json({ success: true, data: await syncBillingRefund(req.user.id, req.params.id) }); }
  catch (error) { next(error); }
};
export const getBillingProfile = async (req, res, next) => {
  try { res.json({ success: true, data: await prisma.billingProfile.findUnique({ where: { user_id: req.user.id } }) }); }
  catch (error) { next(error); }
};
export const saveBillingProfile = async (req, res, next) => {
  try {
    const result = profileSchema.safeParse(req.body);
    if (!result.success) throw new AppError(result.error.issues[0].message, 400);
    const data = await prisma.billingProfile.upsert({ where: { user_id: req.user.id }, update: result.data, create: { user_id: req.user.id, ...result.data } });
    res.json({ success: true, data, message: 'Billing details saved for future receipts.' });
  } catch (error) { next(error); }
};
