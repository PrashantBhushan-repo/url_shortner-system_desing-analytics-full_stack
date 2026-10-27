import crypto from 'node:crypto';
import prisma from '../config/prismaClient.js';
import { config } from '../config/config.js';
import { AppError } from '../utils/AppError.js';
import { tracePayment } from '../telemetry/businessSpans.js';
import { createBillingOrder, verifyBillingPayment, syncBillingPayment, syncBillingCheckout, processBillingWebhook, validSignature, validateBillingCoupon } from '../services/billing.service.js';
import { publicPayment } from '../services/billingPolicy.js';

export const createOrder = async (req, res, next) => {
  try {
    const data = await tracePayment({ operation: 'create_order', provider: 'razorpay' }, () => createBillingOrder(req.user.id, req.body));
    res.status(201).json({ success: true, zeroCharge: data.zeroCharge, data });
  } catch (error) { next(error); }
};

export const verifySignature = async (req, res, next) => {
  try {
    const payment = await verifyBillingPayment(req.user.id, req.body);
    res.status(payment.status === 'AUTHORIZED' ? 202 : 200).json({ success: true, status: payment.status === 'CAPTURED' ? 'success' : 'pending', data: publicPayment(payment) });
  } catch (error) { next(error); }
};

export const syncPayment = async (req, res, next) => {
  try { res.json({ success: true, data: await syncBillingPayment(req.user.id, req.params.id) }); }
  catch (error) { next(error); }
};
export const syncCheckout = async (req, res, next) => {
  try {
    const data = await syncBillingCheckout(req.user.id, req.params.id);
    res.json({ success: true, data, message: data.status === 'NOT_CREATED' ? 'The provider confirmed no order was created. The reservation is closed; you can start checkout again.' : 'Checkout reconciled with the provider. Check payment history for its current state.' });
  }
  catch (error) { next(error); }
};

// A missing gateway configuration must never grant a paid plan.
export const verifyMockPayment = (req, res, next) => next(new AppError('Simulated payments are not available. Use the configured provider test mode.', 410));
export const failMockPayment = verifyMockPayment;

export const validateCoupon = async (req, res, next) => {
  try {
    if (typeof req.body?.planKey !== 'string') throw new AppError('Select a plan before applying a coupon.', 400);
    const coupon = await validateBillingCoupon(prisma, req.body.couponCode, req.body.planKey, req.user?.id);
    res.json({ success: true, data: { code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, description: coupon.description, applicablePlans: coupon.applicable_plans } });
  } catch (error) { next(error); }
};

export const listActiveCouponsPublic = async (req, res, next) => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({ where: { is_active: true, valid_from: { lte: now }, OR: [{ valid_until: null }, { valid_until: { gt: now } }] }, select: { id: true, code: true, description: true, discount_type: true, discount_value: true, applicable_plans: true, max_redemptions: true, times_redeemed: true, valid_until: true }, orderBy: { created_at: 'desc' } });
    res.json({ success: true, data: coupons.filter(c => c.max_redemptions == null || c.times_redeemed < c.max_redemptions) });
  } catch (error) { next(error); }
};

export const processWebhookPayload = (eventId, eventType, payload) => tracePayment({ operation: 'process_webhook', provider: 'razorpay', status: eventType }, () => processBillingWebhook(eventId, eventType, payload));

export const handleWebhook = async (req, res, next) => {
  try {
    if (!config.razorpay.webhookSecret) throw new AppError('Webhook verification is not configured.', 409);
    if (!Buffer.isBuffer(req.body)) throw new AppError('Webhook requires an unmodified request body.', 400);
    const raw = req.body.toString('utf8');
    const secrets = [config.razorpay.webhookSecret, config.razorpay.previousWebhookSecret].filter(Boolean);
    if (!secrets.some(secret => validSignature(req.headers['x-razorpay-signature'], crypto.createHmac('sha256', secret).update(raw).digest('hex')))) throw new AppError('Webhook signature verification failed.', 400);
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new AppError('Invalid webhook body.', 400); }
    const id = req.headers['x-razorpay-event-id'] || crypto.createHash('sha256').update(raw).digest('hex');
    if (typeof id !== 'string' || id.length > 200 || typeof payload.event !== 'string') throw new AppError('Invalid webhook event.', 400);
    // Acknowledge only after durable storage. Provider API work runs in recovery.
    await prisma.webhookEvent.upsert({ where: { event_id: id }, update: {}, create: { event_id: id, event_type: payload.event, payload } });
    res.json({ success: true });
  } catch (error) { next(error); }
};
