export const BILLING_CYCLES = [{ key: 'MONTHLY', label: 'Monthly', months: 1 }, { key: 'QUARTERLY', label: 'Quarterly', months: 3 }, { key: 'YEARLY', label: 'Yearly', months: 12 }];
export const REFUND_REASONS = ['Purchased the wrong plan', 'Missing a feature I need', 'Technical problems', 'No longer needed', 'Other billing concern'];

export function money(amount, currency = 'INR') {
  if (!Number.isFinite(Number(amount))) return '—';
  try { const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits; return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(Number(amount) / (10 ** digits)); }
  catch { return `${currency} ${(Number(amount) / 100).toFixed(2)}`; }
}
export function billingDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
export function cyclePrice(plan, cycle) {
  if (!plan) return null;
  if (cycle === 'QUARTERLY') return plan.price_quarterly ?? plan.price_monthly * 3;
  if (cycle === 'YEARLY') return plan.price_yearly ?? plan.price_monthly * 12;
  return plan.price_monthly;
}
export function quotePrice(plan, cycle, coupon) {
  const base = cyclePrice(plan, cycle);
  const applicable = coupon && (!coupon.applicablePlans?.length || coupon.applicablePlans.includes(plan.key));
  if (!applicable) return base;
  return Math.max(0, base - (coupon.discountType === 'PERCENT' ? Math.round(base * coupon.discountValue / 100) : coupon.discountValue));
}
export function utilization(used, limit) {
  const count = Number.isFinite(used) ? Math.max(0, used) : 0;
  if (limit === null) return { label: `${count.toLocaleString()} / Unlimited`, percent: 0, severity: 'normal' };
  if (!Number.isFinite(limit)) return { label: `${count.toLocaleString()} used`, percent: 0, severity: 'normal' };
  return { label: `${count.toLocaleString()} / ${limit.toLocaleString()}`, percent: limit > 0 ? Math.min(100, count / limit * 100) : count > 0 ? 100 : 0, severity: count >= limit ? 'limit' : count / limit >= .8 ? 'near' : 'normal' };
}
export function invoiceCSV(payments) {
  const safe = value => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]|^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [['Receipt ID', 'Date', 'Plan', 'Cycle', 'Currency', 'Amount (minor units)', 'Refunded (minor units)', 'Payment status', 'Refund status'], ...payments.map(p => [p.id, p.created_at, p.plan?.name, p.billing_cycle, p.currency, p.amount, p.refunded_amount, p.status, p.refund?.status || ''])].map(row => row.map(safe).join(',')).join('\r\n');
}
export const billingError = (error, fallback = 'Something went wrong. Please try again.') => error?.response?.data?.message || error?.message || fallback;
