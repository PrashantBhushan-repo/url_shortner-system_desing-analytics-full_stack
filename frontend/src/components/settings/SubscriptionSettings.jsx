import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/urlApi';
import { BILLING_CYCLES, money, billingDate, utilization, billingError } from '../../services/billingModel';
import { BillingDialog, BillingCheckoutDialog, BillingProfileDialog, BillingRefundDialog, BillingReceiptDialog, RefundPolicy, BillingNotice } from './billing/BillingDialogs';
import BillingHistory from './billing/BillingHistory';
import { ArrowUpRight, CreditCard, FileText, Globe2, Link2, Loader2, LockKeyhole, Mail, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Users, Check, Zap } from 'lucide-react';
import './billing.css';

export default function SubscriptionSettings() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [profile, setProfile] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({});
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState('');
  const [dialogError, setDialogError] = useState('');
  const actionLock = useRef(false);
  const refresh = () => { setLoading(true); setReload(n => n + 1); };

  useEffect(() => {
    const abort = new AbortController();
    const paths = ['/subscription', '/plans', '/subscription/billing-profile', '/payments/active-coupons'];
    Promise.allSettled(paths.map(path => API.get(path, { signal: abort.signal }))).then(results => {
      if (abort.signal.aborted) return;
      const errors = {};
      const setters = [setData, setPlans, setProfile, setVouchers];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value.data?.data ?? (index === 1 || index === 3 ? [] : null));
        else errors[paths[index]] = billingError(result.reason);
      });
      setLoadErrors(errors); setLoading(false);
    });
    return () => abort.abort();
  }, [reload, user?.id]);

  const openDialog = value => { setDialogError(''); setDialog(value); };
  const closeDialog = () => { if (!actionLock.current) { setDialog(null); setDialogError(''); } };
  async function runAction(key, operation, message) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(key); setDialogError(''); setNotice(null);
    try { const result = await operation(); setNotice({ type: 'success', text: result?.data?.message || message }); setDialog(null); refresh(); }
    catch (error) { const text = billingError(error); setDialogError(text); setNotice({ type: 'error', text }); if (key === 'refund') { setDialog(null); refresh(); } }
    finally { actionLock.current = false; setBusy(''); }
  }
  const openPlans = code => openDialog({ type: 'plans', couponCode: typeof code === 'string' ? code : '' });

  if (loading && !data) return <div className="billing-loading" role="status"><Loader2 size={25} className="animate-spin" /><h3>Getting your billing workspace ready</h3><p>Your plan, usage, and payment records in one place.</p></div>;
  if (!data) return <div className="billing-empty"><CreditCard size={32} /><h3>Billing could not be loaded</h3><p>{loadErrors['/subscription'] || 'Refresh to try again.'}</p><button className="billing-button primary" onClick={refresh}>Try again</button></div>;

  const { subscription: sub = {}, plan = {}, limits = {}, usage = {}, billing = {} } = data;
  const isFree = plan.key === 'free';
  const features = Object.entries(FEATURE_LABELS).filter(([key]) => limits?.[key]);
  const meters = [
    { label: 'Short links', icon: Link2, used: usage.urlsCount, limit: limits?.max_urls },
    { label: 'Team members', icon: Users, used: usage.teamMembersCount, limit: limits?.team_members_allowed },
    { label: 'Custom domains', icon: Globe2, used: usage.customDomainsCount },
    { label: 'Webhooks', icon: Zap, used: usage.webhooksCount },
  ];
  const uncertain = billing.checkouts?.find(item => ['UNKNOWN', 'CREATING', 'AUTHORIZED'].includes(item.status));

  return <div className="billing-console" aria-busy={loading || undefined}>
    <div className="billing-toolbar"><span><i />YOUR BILLING WORKSPACE</span><button className="billing-button subtle" onClick={refresh} disabled={Boolean(busy) || loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Refreshing…' : 'Refresh billing'}</button></div>
    {notice && <BillingNotice type={notice.type}>{notice.text}</BillingNotice>}
    {loadErrors['/subscription'] && <BillingNotice type="error">Your plan could not be refreshed. Details below may be out of date. <button className="billing-text-button" onClick={refresh}>Retry</button></BillingNotice>}
    <section className="billing-plan-hero">
      <div className="billing-hero-copy"><span className="billing-overline"><Sparkles size={14} />BUILT FOR YOUR NEXT BIG THING</span><div className="billing-plan-title"><h3>{plan.name || 'Your'} plan</h3><span className="billing-status status-captured"><i />{sub.managed ? 'Managed access' : sub.cancelAtPeriodEnd ? 'Downgrade scheduled' : isFree ? 'Free workspace' : 'Active'}</span></div><p>{plan.description || 'The tools to turn every link into an opportunity.'}</p><div className="billing-hero-actions"><button className="billing-button primary" onClick={openPlans} disabled={Boolean(busy) || !plans.length || sub.managed}>{isFree ? 'Find your next plan' : 'Compare & change plan'}<ArrowUpRight size={15} /></button>{!isFree && !sub.managed && <button className="billing-button" onClick={() => openDialog({ type: sub.cancelAtPeriodEnd ? 'resume' : 'cancel' })} disabled={Boolean(busy)}>{sub.cancelAtPeriodEnd ? 'Keep my plan' : 'Schedule downgrade'}</button>}</div></div>
      <div className="billing-hero-art" aria-hidden="true"><div className="billing-orbit orbit-one" /><div className="billing-orbit orbit-two" /><span><Link2 size={37} strokeWidth={1.4} /></span><i className="orbit-spark one">✦</i><i className="orbit-spark two">+</i><small>Small links. Bigger possibilities.</small></div>
      <div className="billing-plan-facts"><div><span>Access period</span><strong>{isFree ? 'Free, ongoing' : sub.managed ? 'Managed by your organization' : BILLING_CYCLES.find(item => item.key === sub.billingCycle)?.label || 'Paid access'}</strong></div><div><span>{sub.cancelAtPeriodEnd ? 'Switches to Free on' : 'Paid access until'}</span><strong>{isFree ? 'No expiry date' : billingDate(sub.currentPeriodEnd)}</strong></div><div><span>Payment schedule</span><strong>{isFree ? 'No payment required' : 'Manual renewal'}</strong></div></div>
    </section>
    {!billing.configured && <BillingNotice>Online payments are currently unavailable. Billing history and billing details remain available. Contact <a href="mailto:billing@pburls.online">billing support</a> to arrange a purchase or refund.</BillingNotice>}
    {uncertain && <BillingNotice>A payment is awaiting confirmation. Avoid another charge. Checkout reference: <code>{uncertain.id}</code>. <button className="billing-text-button" disabled={Boolean(busy) || !billing.configured} onClick={() => runAction('checkout-sync', () => API.post('/payments/checkouts/' + uncertain.id + '/sync'), 'Checkout status refreshed.')}>Recover checkout<RefreshCw size={12} /></button> If recovery remains pending, share this reference with billing support.</BillingNotice>}
    {loadErrors['/plans'] && <BillingNotice type="error">Plan comparison is unavailable. <button className="billing-text-button" onClick={refresh}>Reload plans</button></BillingNotice>}

    <section className="billing-card"><div className="billing-card-heading"><div><span className="settings-eyebrow">ROOM TO GROW</span><h3>Your workspace at a glance</h3><p>Usage and features included in your current plan.</p></div><span className="billing-small-label">Current usage</span></div><div className="billing-meters">{meters.map(item => { const meter = utilization(item.used, item.limit); const Icon = item.icon; return <div className={'billing-meter meter-' + meter.severity} key={item.label}><span><Icon size={16} />{item.label}</span><strong>{meter.label}</strong><div role="meter" aria-label={item.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter.percent)} aria-valuetext={meter.label}><i style={{ width: meter.percent + '%' }} /></div>{meter.severity !== 'normal' && <small>{meter.severity === 'limit' ? 'Plan limit reached' : 'Approaching your limit'}</small>}</div>; })}</div><div className="billing-feature-tags">{features.map(([,label]) => <span key={label}><Check size={12} />{label}</span>)}<span><FileText size={12} />{limits?.analytics_retention_days === null ? 'Unlimited analytics history' : limits?.analytics_retention_days != null ? limits.analytics_retention_days + '-day analytics history' : 'Analytics retention follows your plan'}</span></div></section>

    <div className="billing-details-grid"><section className="billing-card"><div className="billing-card-heading"><div className="billing-heading-with-icon"><span className="billing-square-icon"><CreditCard size={20} /></span><div><h3>Payment methods</h3><p>Handled by secure checkout.</p></div></div><LockKeyhole size={15} /></div><div className="billing-card-content"><div className="billing-method-brands"><span>Cards</span><span>UPI</span><span>Netbanking</span><span>Wallets</span></div><p>Available methods appear in Razorpay checkout and depend on your bank, currency, and merchant configuration. PBUrls never collects full card numbers or CVVs.</p><div className="billing-inline-note"><ShieldCheck size={15} /><span>One-time payments. No automatic charges or saved methods are configured here.</span></div></div></section>
      <section className="billing-card"><div className="billing-card-heading"><div className="billing-heading-with-icon"><span className="billing-square-icon"><FileText size={20} /></span><div><h3>Billing details</h3><p>For future payment receipts.</p></div></div><button className="billing-button subtle" onClick={() => openDialog({ type: 'profile' })} disabled={Boolean(busy) || Boolean(loadErrors['/subscription/billing-profile'])}>Edit<ArrowUpRight size={13} /></button></div><div className="billing-card-content">{loadErrors['/subscription/billing-profile'] ? <BillingNotice type="error">Billing details could not load. <button className="billing-text-button" onClick={refresh}>Retry</button></BillingNotice> : profile ? <div className="billing-address"><strong>{profile.company || profile.name}</strong><span>{profile.email}</span><span>{[profile.address, profile.city, profile.region, profile.postal_code, profile.country].filter(Boolean).join(', ')}</span>{profile.tax_id && <span>Tax ID: {profile.tax_id}</span>}</div> : <div className="billing-profile-empty"><Mail size={20} /><p>Add your billing name, email, company, address, and optional tax ID.</p></div>}<p className="billing-caption">Changes apply to new receipts. Contact support for existing receipt corrections or tax invoices.</p></div></section></div>

    <BillingHistory reload={reload} userId={user?.id} busy={busy} configured={billing.configured} onAction={runAction} onDialog={openDialog} />
    <section className="billing-refund-card"><span className="billing-square-icon"><RotateCcw size={23} /></span><div><span className="settings-eyebrow">A LITTLE PEACE OF MIND</span><h3>A clear, 14-day refund window.</h3><p>Eligible captured payments return to their original payment method. Follow requests from submission to provider confirmation.</p></div><button className="billing-button" onClick={() => openDialog({ type: 'policy' })}>Read refund policy<ArrowUpRight size={14} /></button></section>
    {vouchers.length > 0 && <section className="billing-offers"><span><Sparkles size={17} />Offers for your next chapter</span>{vouchers.slice(0, 3).map(voucher => <button key={voucher.id} onClick={() => openPlans(voucher.code)}>{voucher.code}<small>{voucher.discount_type === 'PERCENT' ? voucher.discount_value + '% off' : money(voucher.discount_value)}</small><ArrowUpRight size={13} /></button>)}</section>}
    <footer className="billing-support"><span><ShieldCheck size={15} />Secure checkout. Clear records. You're in control.</span><a href="mailto:billing@pburls.online">Contact billing support<ArrowUpRight size={13} /></a></footer>

    {dialog?.type === 'plans' && <BillingCheckoutDialog plans={plans} data={data} initialCoupon={dialog.couponCode} onClose={closeDialog} onDone={(text,type) => { setNotice({ text, type }); setDialog(null); refresh(); }} onRefresh={refresh} />}
    {['cancel','resume'].includes(dialog?.type) && <BillingDialog title={dialog.type === 'cancel' ? 'Your paid time stays yours' : 'Keep your current plan'} eyebrow="PLAN PREFERENCES" onClose={closeDialog} busy={Boolean(busy)}><div className="billing-dialog-body"><BillingNotice>{dialog.type === 'cancel' ? 'Your plan switches to Free at the end of your paid period on ' + billingDate(sub.currentPeriodEnd) + '. This does not request a refund.' : 'Remove the scheduled downgrade. Paid access still ends on ' + billingDate(sub.currentPeriodEnd) + ' unless you renew manually.'}</BillingNotice><p>Existing links are preserved. Paid features and new link creation follow your remaining plan limits. There are no automatic charges.</p>{dialogError && <BillingNotice type="error">{dialogError}</BillingNotice>}</div><div className="billing-dialog-footer"><button className="billing-button" onClick={closeDialog} disabled={Boolean(busy)}>Go back</button><button className="billing-button primary" disabled={Boolean(busy)} onClick={() => runAction(dialog.type, () => API.post('/subscription/' + dialog.type), 'Plan preference updated.')}>{busy ? 'Updating…' : dialog.type === 'cancel' ? 'Schedule downgrade' : 'Remove scheduled downgrade'}</button></div></BillingDialog>}
    {dialog?.type === 'profile' && <BillingProfileDialog profile={profile} user={user} onClose={closeDialog} busy={Boolean(busy)} error={dialogError} onSave={form => runAction('profile', () => API.put('/subscription/billing-profile', form), 'Billing details saved.')} />}
    {dialog?.type === 'refund' && <BillingRefundDialog payment={dialog.payment} onClose={closeDialog} busy={Boolean(busy)} error={dialogError} onSubmit={form => runAction('refund', () => API.post('/subscription/refund-request', form), 'Refund request recorded.')} />}
    {dialog?.type === 'receipt' && <BillingReceiptDialog payment={dialog.payment} onClose={closeDialog} canRefund={Boolean(billing.configured)} onRefund={() => openDialog({ type: 'refund', payment: dialog.payment })} />}
    {dialog?.type === 'policy' && <BillingDialog title="Clear terms. No guesswork." eyebrow="REFUND POLICY" onClose={closeDialog}><RefundPolicy /><div className="billing-dialog-footer"><button className="billing-button primary" onClick={closeDialog}>Got it<Check size={14} /></button></div></BillingDialog>}
  </div>;
}

const FEATURE_LABELS = { custom_alias_allowed: 'Custom aliases', custom_domain_allowed: 'Branded domains', qr_code_allowed: 'QR codes', password_protected_links: 'Password-protected links', geo_analytics: 'Location analytics', device_browser_analytics: 'Device analytics', api_access: 'Developer API', csv_export: 'CSV exports', bulk_url_creation: 'Bulk link creation', webhooks_allowed: 'Event webhooks', priority_support: 'Priority support' };
