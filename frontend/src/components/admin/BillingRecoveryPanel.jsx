import { useEffect, useState } from 'react';
import API from '../../services/urlApi';

export default function BillingRecoveryPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function refresh() {
    try { const response = await API.get('/admin/billing/recovery'); setData(response.data.data); setError(''); }
    catch (failure) { setError(failure.response?.data?.message || 'Recovery diagnostics could not load.'); }
  }
  useEffect(() => { let active = true; API.get('/admin/billing/recovery').then(response => { if (active) setData(response.data.data); }).catch(() => { if (active) setError('Recovery diagnostics could not load.'); }); return () => { active = false; }; }, []);
  async function retry(id) {
    setBusy(id);
    try { await API.post('/admin/billing/recovery/' + encodeURIComponent(id) + '/retry'); await refresh(); }
    catch (failure) { setError(failure.response?.data?.message || 'Retry could not be scheduled.'); }
    finally { setBusy(''); }
  }
  return <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm text-slate-300 space-y-4">
    <div className="flex items-center justify-between gap-4"><div><h3 className="font-bold text-white">Automatic payment recovery</h3><p className="text-xs mt-1">Unprocessed webhooks: {data?.unprocessedWebhooks ?? '…'} · Last job activity: {data?.lastActivity ? new Date(data.lastActivity).toLocaleString() : 'No activity yet'}</p></div><button className="border border-zinc-700 rounded-lg px-3 py-2" onClick={refresh}>Refresh</button></div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {data?.jobs.length === 0 && <p>No recovery failures currently require review.</p>}
    {data?.jobs.map(job => <div key={job.id} className="border-t border-zinc-800 pt-3 flex justify-between gap-4"><div className="min-w-0"><strong>{job.kind} · {job.review_required ? 'Review required' : 'Retry pending'}</strong><p className="break-all text-xs">{job.resource_id}</p><p className="text-xs mt-1">{job.last_error || 'Payment confirmation is taking longer than expected.'} · Attempts failed: {job.failures}</p><p className="text-xs">Next check: {new Date(job.due_at).toLocaleString()}</p></div><button disabled={Boolean(busy)} className="border border-zinc-700 rounded-lg px-3 py-2 self-start disabled:opacity-50" onClick={() => retry(job.id)}>{busy === job.id ? 'Scheduling…' : 'Retry check'}</button></div>)}
    {data?.reviews.map(payment => <div key={payment.id} className="border-t border-amber-900 pt-3"><strong className="text-amber-200">Captured payment needs review</strong><p className="text-xs break-all">Payment: {payment.id} · Order: {payment.gateway_order_id}</p>{payment.metadata?.duplicateCharges?.map(id => <p key={id} className="text-xs break-all">Additional captured charge: {id}</p>)}<p className="text-xs mt-1">Verify the customer's intended purchase and provider refund totals before issuing any refund in Razorpay. Keep the provider reference in the support record.</p></div>)}
  </section>;
}
