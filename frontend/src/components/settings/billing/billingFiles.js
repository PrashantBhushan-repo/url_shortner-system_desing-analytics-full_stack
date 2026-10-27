import { billingDate, money } from '../../../services/billingModel';

export function downloadBillingFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function receiptHTML(payment) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const profile = payment.billingProfile;
  const rows = [['Receipt', payment.id], ['Order', payment.gateway_order_id], ['Payment', payment.gateway_payment_id || 'No gateway charge'], ['Date', billingDate(payment.paidAt || payment.created_at)], ['Plan', payment.plan?.name], ['Access period', payment.billing_cycle], ['Status', payment.status], ['Amount', money(payment.amount, payment.currency)], ['Refunded', money(payment.refunded_amount, payment.currency)]];
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>PBUrls payment receipt</title><style>body{font:15px system-ui;color:#153222;max-width:720px;margin:60px auto;padding:24px}h1{font-size:32px}table{border-collapse:collapse;width:100%;margin:32px 0}td{padding:14px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}td:first-child{color:#666;width:32%}p{line-height:1.6;color:#555}@media print{body{margin:0}}</style><h1>pburls.</h1><h2>Payment receipt</h2>' + (profile ? '<p>' + [profile.name, profile.company, profile.email, profile.address, profile.city, profile.region, profile.postal_code, profile.country, profile.tax_id ? 'Tax ID: ' + profile.tax_id : ''].filter(Boolean).map(escape).join('<br>') + '</p>' : '') + '<table>' + rows.map(([label,value]) => '<tr><td>' + escape(label) + '</td><td>' + escape(value) + '</td></tr>').join('') + '</table><p>This is a payment record, not a tax invoice. Contact billing@pburls.online for tax documentation or a billing correction.</p></html>';
}
