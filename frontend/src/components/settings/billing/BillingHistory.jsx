import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, RefreshCw, Search } from 'lucide-react';
import API from '../../../services/urlApi';
import { billingDate, billingError, invoiceCSV, money } from '../../../services/billingModel';
import { PaymentStatus } from './BillingDialogs';
import { downloadBillingFile } from './billingFiles';

export default function BillingHistory({ reload, userId, busy, configured, onAction, onDialog }) {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [query, setQuery] = useState({ page: 1, status: 'ALL', search: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams({ page: String(query.page), status: query.status, search: query.search });
    API.get('/subscription/invoices?' + params, { signal: abort.signal }).then(response => {
      if (abort.signal.aborted) return;
      setInvoices(response.data?.data || []);
      setPagination(response.data?.pagination || { page: 1, pages: 1, total: response.data?.data?.length || 0 });
      setError(''); setLoading(false);
    }).catch(error => { if (!abort.signal.aborted) { setError(billingError(error)); setLoading(false); } });
    return () => abort.abort();
  }, [query, reload, userId, retry]);
  const update = values => { setLoading(true); setQuery(previous => ({ ...previous, ...values })); };
  const filtered = query.search || query.status !== 'ALL';
  return <section className="billing-card billing-history">
    <div className="billing-card-heading"><div><span className="settings-eyebrow">EVERY TRANSACTION, ACCOUNTED FOR</span><h3>Payments & receipts</h3><p>Track charges, download receipts, and follow refunds.</p></div><button className="billing-button" disabled={!invoices.length || loading || Boolean(error)} onClick={() => downloadBillingFile('pburls-billing-page-' + pagination.page + '.csv', invoiceCSV(invoices), 'text/csv;charset=utf-8')}><Download size={14} />Export this page</button></div>
    <div className="billing-history-controls"><form onSubmit={event => { event.preventDefault(); update({ search: search.trim(), page: 1 }); }} className="billing-search"><Search size={15} /><input aria-label="Search payments" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search plan, order, or receipt…" maxLength={100} /><button type="submit" aria-label="Apply payment search"><ChevronRight size={15} /></button></form><label className="billing-filter"><span>Status</span><select aria-label="Filter payment status" value={query.status} onChange={event => update({ status: event.target.value, page: 1 })}>{[['ALL','All payments'],['CAPTURED','Paid'],['CREATED','Awaiting payment'],['AUTHORIZED','Confirming payment'],['FAILED','Failed'],['REFUNDED','Refunded'],['PARTIALLY_REFUNDED','Partially refunded']].map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    {error ? <div className="billing-empty"><FileText size={28} /><h4>Payment history could not load</h4><p>{error}</p><button className="billing-button" onClick={() => { setLoading(true); setRetry(n => n + 1); }}>Try again</button></div> : loading ? <div className="billing-empty" role="status"><Loader2 className="animate-spin" size={22} /><p>Loading payment history…</p></div> : !invoices.length ? <div className="billing-empty"><FileText size={30} /><h4>{filtered ? 'No matching payments' : 'Your story starts here'}</h4><p>{filtered ? 'Try a different search or status filter.' : 'Receipts will appear here after your first checkout.'}</p>{filtered && <button className="billing-button" onClick={() => { setSearch(''); update({ page: 1, status: 'ALL', search: '' }); }}>Clear filters</button>}</div> : <div className="billing-table-scroll"><table><thead><tr><th>Transaction</th><th>Plan & period</th><th>Amount</th><th>Status</th><th className="billing-align-right">Actions</th></tr></thead><tbody>{invoices.map(item => <tr key={item.id}>
      <td><strong>{billingDate(item.paidAt || item.created_at)}</strong><span className="billing-reference" title={item.gateway_order_id}>{item.gateway_order_id}</span></td><td><strong>{item.plan?.name || 'Plan purchase'}</strong><span>{item.billing_cycle?.toLowerCase()}</span></td><td><strong>{money(item.amount, item.currency)}</strong>{item.refunded_amount > 0 && <span>{money(item.refunded_amount, item.currency)} returned</span>}</td><td><PaymentStatus value={item.status} />{item.refund && <PaymentStatus value={item.refund.status} refund />}{item.fulfillmentStatus === 'REVIEW_REQUIRED' && <span className="billing-review">Access requires billing review</span>}</td>
      <td><div className="billing-row-actions"><button className="billing-text-button" onClick={() => onDialog({ type: 'receipt', payment: item })}>Details<ChevronRight size={13} /></button>{item.gateway === 'razorpay' && <button className="billing-text-button" disabled={Boolean(busy) || !configured} onClick={() => onAction('sync-' + item.id, () => API.post('/payments/' + item.id + '/sync'), 'Payment status refreshed.')}><RefreshCw size={12} className={busy === 'sync-' + item.id ? 'animate-spin' : ''} />Check status</button>}{item.refundEligibility?.eligible && <button className="billing-text-button" disabled={Boolean(busy) || !configured} onClick={() => onDialog({ type: 'refund', payment: item })}>Request refund</button>}{item.refund && !['PROCESSED','FAILED'].includes(item.refund.status) && <button className="billing-text-button" disabled={Boolean(busy) || !configured} onClick={() => onAction('refund-sync', () => API.post('/subscription/invoices/' + item.id + '/refund-sync'), 'Refund status refreshed.')}>Refresh refund</button>}</div></td>
    </tr>)}</tbody></table></div>}
    <div className="billing-pagination"><span>{pagination.total.toLocaleString()} transaction{pagination.total === 1 ? '' : 's'}{pagination.pages > 0 && ' · Page ' + pagination.page + ' of ' + pagination.pages}</span><div><button className="billing-icon-button" aria-label="Previous payment page" disabled={loading || query.page <= 1} onClick={() => update({ page: query.page - 1 })}><ChevronLeft size={17} /></button><button className="billing-icon-button" aria-label="Next payment page" disabled={loading || query.page >= pagination.pages} onClick={() => update({ page: query.page + 1 })}><ChevronRight size={17} /></button></div></div>
  </section>;
}
