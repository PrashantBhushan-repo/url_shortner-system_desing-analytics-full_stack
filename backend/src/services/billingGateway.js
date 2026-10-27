import { config } from '../config/config.js';
import { AppError } from '../utils/AppError.js';

export const gatewayConfigured = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);
export const gatewayPublicKey = () => config.razorpay.keyId;

async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
  if (!gatewayConfigured()) throw new AppError('Payments are not configured. Contact billing support.', 409);
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json', ...(idempotencyKey ? { 'X-Refund-Idempotency': idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AppError('The payment provider has not confirmed the result yet. Check status before trying another payment.', 409, null, 'PAYMENT_UNCERTAIN');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const uncertain = response.status >= 500 || response.status === 409 || response.status === 429 || !result;
    const error = new AppError(uncertain ? 'The provider result is pending. Check status before retrying.' : 'The payment provider rejected this request. Contact billing support if the problem continues.', 409, null, uncertain ? 'PAYMENT_UNCERTAIN' : 'PAYMENT_REJECTED');
    const retry = response.headers?.get('retry-after');
    error.retryAfterMs = retry ? Math.max(0, Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) || 0 : 0;
    throw error;
  }
  return result;
}

export const createGatewayOrder = data => request('orders', { method: 'POST', body: data });
export const fetchGatewayOrder = id => request(`orders/${encodeURIComponent(id)}`);
export const fetchOrdersByReceipt = receipt => request(`orders?receipt=${encodeURIComponent(receipt)}&count=100`);
export const fetchGatewayPayment = id => request(`payments/${encodeURIComponent(id)}`);
export const fetchOrderPayments = id => request(`orders/${encodeURIComponent(id)}/payments`);
export const createGatewayRefund = (id, amount, key) => request(`payments/${encodeURIComponent(id)}/refund`, {
  method: 'POST', body: { amount, speed: 'normal' }, idempotencyKey: key,
});
export const fetchGatewayRefund = id => request(`refunds/${encodeURIComponent(id)}`);

// Reconcile the cumulative amount from processed refunds only; pending money is not refunded money.
export async function fetchProcessedRefunds(paymentId) {
  const items = [];
  for (let skip = 0; ; skip += 100) {
    const page = await request(`payments/${encodeURIComponent(paymentId)}/refunds?count=100&skip=${skip}`);
    if (!Array.isArray(page.items)) throw new AppError('Invalid refund response from provider.', 409);
    items.push(...page.items.filter(item => item.status === 'processed'));
    if (page.items.length < 100) return items;
    if (skip >= 9900) throw new AppError('This refund history requires a billing review.', 409);
  }
}
