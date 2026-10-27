import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, CreditCard, Loader2, Minus, RefreshCw, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API from '../services/urlApi';
import { BILLING_CYCLES, billingError, cyclePrice, money } from '../services/billingModel';
import { signInPath } from '../routes/navigation';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import { BillingCheckoutDialog, RefundPolicy } from '../components/settings/billing/BillingDialogs';
import '../components/settings/billing.css';
import './pricing.css';

const COMPARISON = [
  ['max_urls', 'Active short links'], ['analytics_retention_days', 'Analytics retention', 'days'],
  ['qr_code_allowed', 'Custom QR codes'], ['custom_alias_allowed', 'Custom aliases'],
  ['custom_domain_allowed', 'Custom domains'], ['password_protected_links', 'Password protection'],
  ['geo_analytics', 'Location analytics'], ['api_access', 'Developer API'], ['webhooks_allowed', 'Webhooks'],
  ['team_members_allowed', 'Team members'], ['csv_export', 'CSV export'], ['priority_support', 'Priority support'],
];

function CompareCell({ value, suffix }) {
  if (value === null) return <span className="pc-unlimited">Unlimited</span>;
  if (value === undefined) return <span className="pc-dash"><Minus size={14} /></span>;
  if (typeof value === 'boolean') {
    return value
      ? <span className="pc-yes"><Check size={15} /></span>
      : <span className="pc-no">—</span>;
  }
  return <span className="pc-number">{Number(value).toLocaleString()}{suffix ? <em>{suffix}</em> : null}</span>;
}

export default function PricingPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedCycle = params.get('cycle');
  const cycle = BILLING_CYCLES.some(item => item.key === requestedCycle) ? requestedCycle : 'MONTHLY';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [vouchers, setVouchers] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    // Synchronize the visible loading state with this remote request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError('');
    API.get('/plans', { signal: abort.signal }).then(response => { if (!abort.signal.aborted) setPlans(response.data?.data || []); }).catch(failure => { if (!abort.signal.aborted) setError(billingError(failure)); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    API.get('/payments/active-coupons', { signal: abort.signal }).then(response => { if (!abort.signal.aborted) setVouchers(response.data?.data || []); }).catch(() => {});
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const abort = new AbortController();
    // Discard the previous account before loading another user's billing data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccount(null); setAccountError('');
    if (token && user?.id) API.get('/subscription', { signal: abort.signal }).then(response => { if (!abort.signal.aborted) setAccount(response.data?.data || null); }).catch(failure => { if (!abort.signal.aborted) setAccountError(billingError(failure)); });
    return () => abort.abort();
  }, [token, user?.id, revision]);
  function choose(plan) {
    const query = new URLSearchParams({ plan: plan.key, cycle });
    if (params.get('coupon')) query.set('coupon', params.get('coupon'));
    if (!token) { navigate(signInPath('/pricing?' + query, 'register')); return; }
    if (plan.key === 'free') { navigate(account?.plan?.key === 'free' ? '/dashboard' : '/billing'); return; }
    if (!account) return;
    setNotice(''); setCheckout({ planKey: plan.key, cycle, coupon: params.get('coupon') || '', account });
  }
  function chooseCycle(value) { setParams(previous => { const next = new URLSearchParams(previous); next.set('cycle', value); return next; }, { replace: true, preventScrollReset: true }); }
  return <div className="site-page pricing-page"><SiteHeader /><main className="site-content" id="main-content">
    <div className="pricing-intro"><div><span className="site-eyebrow">Plans &amp; pricing</span><h1>The right tools.<br />Room to grow.</h1><p>Start with short links. Add the capacity, insights, and workspace features your team needs.</p></div><div className="pricing-promise"><ShieldCheck size={24} /><strong>Clear choices. You're in control.</strong><p>One-time payments. Manual renewal.<br />Review the full price before checkout.</p>{token && <Link to="/billing">Your plan &amp; billing<ArrowRight size={14} /></Link>}</div></div>
    <div className="pricing-controls"><div role="group" aria-label="Billing cycle" className="pricing-cycle">{BILLING_CYCLES.map(item => <button key={item.key} aria-pressed={cycle === item.key} onClick={() => chooseCycle(item.key)}>{item.label}</button>)}</div><span><CreditCard size={15} />Prices below are charged per selected period.</span></div>
    {notice && <div className="pricing-notice" role="status">{notice} <Link to="/billing">Check billing status<ArrowRight size={14} /></Link></div>}
    {accountError && <div className="pricing-notice" role="alert">Your account could not be loaded. Refresh before purchasing. <button onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />Refresh account</button></div>}
    {token && account && !account.billing?.configured && <div className="pricing-notice">Online checkout is currently unavailable. You can still compare plans and review <Link to="/billing">your existing billing records</Link>.</div>}
    {loading ? <div className="site-loading" role="status"><Loader2 size={25} />Loading available plans…</div> : error || !plans.length ? <section className="site-state" role="alert"><h2>Plans could not be loaded.</h2><p>{error || 'No plans are available at the moment.'}</p><button className="site-link-button" onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={14} /></button></section> : <>
      <div className="pricing-plans" style={{ '--plan-columns': Math.min(plans.length, 4) }}>{plans.map(plan => { const current = account?.plan?.key === plan.key; const featured = plan.key === 'pro'; return <section className={'pricing-plan' + (featured ? ' is-featured' : '') + (params.get('plan') === plan.key ? ' is-requested' : '')} key={plan.id}>
        <div className="pricing-plan-badges"><span className="site-eyebrow">{plan.key === 'free' ? 'Get started' : 'Build momentum'}</span>{current ? <span className="pricing-badge">Your current plan</span> : featured && <Sparkles size={17} />}</div><h2>{plan.name}</h2><p>{plan.description || 'Tools and capacity for your next chapter.'}</p><div className="pricing-amount"><strong>{money(cyclePrice(plan, cycle), plan.currency)}</strong><span>/{plan.key === 'free' ? 'free access' : cycle === 'MONTHLY' ? 'month' : cycle === 'QUARTERLY' ? '3 months' : 'year'}</span></div>
        <button className={'pricing-cta' + (featured ? ' pricing-cta-primary' : ' pricing-cta-secondary')} disabled={Boolean(token && plan.key !== 'free' && (!account || !account.billing?.configured))} onClick={() => choose(plan)}>{plan.key === 'free' ? token ? current ? 'Open your workspace' : 'Manage your plan' : 'Start free' : token && !account && !accountError ? 'Loading account…' : current ? 'Review renewal' : 'Get ' + plan.name}<ArrowRight size={14} /></button>
        <ul>{[['max_urls', 'active short links'], ['analytics_retention_days', 'days of analytics'], ['team_members_allowed', 'team members']].map(([key, label]) => <li key={key}><Check size={14} /><span>{plan.limit?.[key] === null ? 'Unlimited ' + label.replace('days of ', '') : plan.limit?.[key] === undefined ? 'See feature details below' : Number(plan.limit[key]).toLocaleString() + ' ' + label}</span></li>)}{['qr_code_allowed', 'custom_domain_allowed', 'api_access'].filter(key => plan.limit?.[key]).map(key => <li key={key}><Check size={14} />{COMPARISON.find(item => item[0] === key)?.[1]}</li>)}</ul>
        <a href="#plan-comparison" className="pricing-compare-link"><ArrowDown size={13} />Compare all features</a>
      </section>; })}</div>

      {/* ── Compare plans highlight banner ── */}
      <div className="pricing-compare-banner">
        <div className="pricing-compare-banner-inner">
          <span>Not sure which plan fits?</span>
          <a href="#plan-comparison" className="pricing-compare-btn">
            <Check size={15} />Compare all plans
          </a>
        </div>
      </div>

      <section className="pricing-comparison" id="plan-comparison"><div><span className="site-eyebrow">Find your fit</span><h2>Compare the details.</h2><p>Feature availability comes from the current plan configuration.</p></div><div className="pricing-table-scroll" tabIndex={0} aria-label="Scrollable plan comparison"><table><caption className="sr-only">Features included in each available plan</caption><thead><tr><th scope="col">Feature</th>{plans.map(plan => <th scope="col" key={plan.id} className={plan.key === 'pro' ? 'pc-featured-col' : ''}>{plan.name}</th>)}</tr></thead><tbody>{COMPARISON.map(([key, label, suffix]) => <tr key={key}><th scope="row">{label}</th>{plans.map(plan => <td key={plan.id} className={plan.key === 'pro' ? 'pc-featured-col' : ''}><CompareCell value={plan.limit?.[key]} suffix={suffix} /></td>)}</tr>)}</tbody><tfoot><tr><th scope="row"></th>{plans.map(plan => <td key={plan.id} className={plan.key === 'pro' ? 'pc-featured-col' : ''}><button className={'pricing-cta pricing-tfoot-cta' + (plan.key === 'pro' ? ' pricing-cta-primary' : ' pricing-cta-secondary')} disabled={Boolean(token && plan.key !== 'free' && (!account || !account.billing?.configured))} onClick={() => choose(plan)}>{plan.key === 'free' ? 'Start free' : 'Get ' + plan.name}<ArrowRight size={13} /></button></td>)}</tr></tfoot></table></div></section>
    </>}
    <section className="pricing-notes"><div><Ticket size={23} /><h2>Have a coupon?</h2><p>Apply it during plan review. The server checks eligibility and confirms the final total.</p>{vouchers.slice(0, 4).map(voucher => <button key={voucher.id} className="pricing-coupon" onClick={() => { setParams(previous => { const next = new URLSearchParams(previous); next.set('coupon', voucher.code); return next; }, { replace: true }); setNotice('Coupon ' + voucher.code + ' selected. Choose a plan and apply it during review.'); }}>{voucher.code}<ArrowRight size={13} /></button>)}</div><div><ShieldCheck size={23} /><h2>Know what happens next.</h2><p>Same-plan renewals extend paid time. Different plans replace access after payment confirmation, without proration. Manage downgrade preferences in Billing.</p><Link to="/help#billing">Read the billing guide<ArrowRight size={14} /></Link></div></section>
    <details className="pricing-policy"><summary>Payment, cancellation, and refund policy</summary><RefundPolicy /></details>
    <div className="pricing-final"><h2>Still finding your fit?</h2><p>Explore the product before choosing a plan.</p><Link className="site-link-button secondary" to="/demo">Explore the demo<ArrowRight size={14} /></Link><Link to="/help">Help &amp; guides</Link></div>
  </main><SiteFooter />{checkout && <BillingCheckoutDialog plans={plans} data={checkout.account} initialPlanKey={checkout.planKey} initialCycle={checkout.cycle} initialCoupon={checkout.coupon} onClose={() => setCheckout(null)} onRefresh={() => setRevision(value => value + 1)} onDone={(text, type) => { setCheckout(null); setNotice(text); if (type === 'success') navigate('/billing'); else setRevision(value => value + 1); }} />}</div>;
}
