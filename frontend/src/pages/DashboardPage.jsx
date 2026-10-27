import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { linkView, updateLinkView } from "../routes/navigation";
import { Activity, ArrowDownUp, ArrowRight, BarChart3, Check, ChevronLeft, ChevronRight, Copy, Edit3, ExternalLink, Link2, Loader2, LockKeyhole, Plus, QrCode, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import API from "../services/urlApi";
import { linkStatus, normalizeLink, upsertLink, visibleLinks } from "../services/linkModel";
import WorkspaceShell from "../layout/WorkspaceShell";
import UrlForm from "../components/url/UrlForm";
import QRCustomizer from "../components/url/QRCustomizer";

const formatNumber = value => Number(value || 0).toLocaleString();
const date = value => value ? new Date(value).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }) : '—';

function LinkDialog({ link, limits, onClose, onSaved, deleting = false }) {
  const [destination, setDestination] = useState(link.longUrl);
  const [alias, setAlias] = useState(link.shortCode);
  const [password, setPassword] = useState('');
  const [removePassword, setRemovePassword] = useState(false);
  const [expiry, setExpiry] = useState(link.expiresAt ? new Date(new Date(link.expiresAt).getTime()-new Date(link.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current.querySelector('button')?.focus();
    const key = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')];
      if (!controls.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown',key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown',key); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  const submit = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      if (deleting) { await API.delete(`/urls/${encodeURIComponent(link.shortCode)}`); onSaved(null, link.id); }
      else {
        const payload = {};
        if (destination.trim() !== link.longUrl) payload.longUrl = destination.trim();
        if (alias.trim() !== link.shortCode) payload.customAlias = alias.trim();
        if (password) payload.password = password;
        if (removePassword) payload.password = null;
        const previousExpiry = link.expiresAt ? new Date(new Date(link.expiresAt).getTime()-new Date(link.expiresAt).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
        if (expiry !== previousExpiry) payload.expiresAt = expiry ? new Date(expiry).toISOString() : null;
        if (!Object.keys(payload).length) { onClose(); return; }
        const response = await API.patch(`/urls/${encodeURIComponent(link.shortCode)}`,payload);
        onSaved(response.data.data,link.id);
      }
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'Unable to save this change. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="ws-dialog-overlay"><section ref={panel} className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title"><button className="ws-dialog-close ws-icon-button" onClick={onClose} aria-label="Close link dialog"><X size={18} /></button><span className="ws-eyebrow">{deleting ? 'CONFIRM LINK REMOVAL' : 'LINK SETTINGS'}</span><h2 id="link-dialog-title">{deleting ? 'Remove this link?' : 'Edit your link.'}</h2><p className="ws-muted ws-dialog-url">{link.shortUrl}</p>{error && <p className="ws-notice ws-error" role="alert">{error}</p>}<form onSubmit={submit}><fieldset disabled={busy}>{deleting ? <p className="ws-dialog-description">This deactivates the short link. Future visitors will no longer be redirected. Existing click history is retained.</p> : <><label htmlFor="edit-destination">Destination URL</label><input id="edit-destination" type="url" value={destination} onChange={e => setDestination(e.target.value)} maxLength={2048} required /><label htmlFor="edit-alias">Short code</label><input id="edit-alias" value={alias} onChange={e => setAlias(e.target.value)} disabled={!limits?.custom_alias_allowed} pattern="[a-zA-Z0-9_-]{3,64}" required /><small>{limits?.custom_alias_allowed ? 'Changing this code also changes the short URL.' : 'Custom aliases require an eligible plan.'}</small>{limits?.custom_expiry_allowed && <><label htmlFor="edit-expiry">Expiration date (your local time)</label><input id="edit-expiry" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} /><small>Leave empty for no expiration.</small></>}{limits?.password_protected_links && <><label htmlFor="edit-link-password">{link.passwordProtected ? 'Replace link password' : 'Add a link password'}</label><input id="edit-link-password" type="password" autoComplete="new-password" maxLength={64} value={password} onChange={e => setPassword(e.target.value)} disabled={removePassword} placeholder="Leave blank to keep current settings" />{link.passwordProtected && <label className="ws-checkbox"><input type="checkbox" checked={removePassword} onChange={e => setRemovePassword(e.target.checked)} />Remove password protection</label>}</>}</>}<div className="ws-dialog-actions"><button type="button" className="ws-button ws-button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className={`ws-button ${deleting ? 'ws-button-danger' : ''}`} disabled={busy}>{busy ? 'Saving…' : deleting ? 'Deactivate link' : 'Save changes'}</button></div></fieldset></form></section></div>;
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  if (!user?.id) return <WorkspaceShell><div className="ws-empty" role="status"><h1>Loading your account</h1><p>If your connection was interrupted, reload to try again.</p><button className="ws-button" onClick={() => window.location.reload()}>Reload account</button></div></WorkspaceShell>;
  return <Dashboard key={user.id} user={user} token={token} />;
}

function Dashboard({ user, token }) {
  const [urls,setUrls] = useState([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [subscription,setSubscription] = useState(null);
  const [params,setParams] = useSearchParams();
  const {query,status,sort,page,showCreate} = linkView(params);
  const updateView = (patch,replace=false) => setParams(previous => updateLinkView(previous,patch),{replace,preventScrollReset:true});
  const [dialog,setDialog] = useState(null);
  const [qr,setQr] = useState(null);
  const [copied,setCopied] = useState(null);
  const requests = useRef(0), controller = useRef(null), copyTimer = useRef(null);
  const closeDialog = useCallback(() => setDialog(null),[]);
  const load = useCallback(async (silent = false) => {
    const request = ++requests.current;
    controller.current?.abort(); controller.current = new AbortController();
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const response = await API.get('/urls/me',{signal:controller.current.signal});
      if (request === requests.current) setUrls((response.data?.data || []).map(normalizeLink).filter(link => link.isActive));
    } catch (err) { if (request === requests.current && err.code !== 'ERR_CANCELED') setError(err.response?.data?.message || 'Unable to load your links. Try refreshing.'); }
    finally { if (request === requests.current) { setLoading(false); setRefreshing(false); } }
  },[]);
  const cancelLoad = useCallback(() => { requests.current++; controller.current?.abort(); }, []);
  useEffect(() => {
    // Start the remote request and synchronize its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const abort = new AbortController();
    API.get('/subscription',{signal:abort.signal}).then(response => setSubscription(response.data?.data || null)).catch(() => {});
    return () => { cancelLoad(); abort.abort(); clearTimeout(copyTimer.current); };
  },[load,token,cancelLoad]);
  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden && !dialog) load(true); },30000);
    const focus = () => { if (!document.hidden && !dialog) load(true); };
    window.addEventListener('focus',focus);
    return () => { clearInterval(interval); window.removeEventListener('focus',focus); };
  },[load,dialog]);
  const saved = (link,id) => { if (link) setUrls(previous => upsertLink(previous,link)); else setUrls(previous => previous.filter(item => item.id !== id)); setNotice(link ? 'Link saved.' : 'Link deactivated.'); load(true); };
  const copy = async link => { try { await navigator.clipboard.writeText(link.shortUrl); setCopied(link.id); clearTimeout(copyTimer.current); copyTimer.current=setTimeout(() => setCopied(null),2000); } catch { setNotice('Copy is unavailable. Select the short URL to copy it manually.'); } };
  const filtered=visibleLinks(urls,query,status,sort), pages=Math.max(1,Math.ceil(filtered.length/10)), current=Math.min(page,pages), displayed=filtered.slice((current-1)*10,current*10);
  const limits=subscription?.limits;
  const stats=[['Saved links',urls.length,Link2],['Active links',urls.filter(link=>linkStatus(link)==='Active').length,Activity],['Total clicks',urls.reduce((sum,link)=>sum+link.clicksCount,0),BarChart3],['Expired links',urls.filter(link=>linkStatus(link)==='Expired').length,LockKeyhole]];
  return <WorkspaceShell title="Overview"><div className="ws-page-heading"><div><span className="ws-eyebrow">YOUR PERSONAL WORKSPACE</span><h1>{user.name ? `${user.name.split(' ')[0]}’s link workspace.` : 'Your link workspace.'}</h1><p>Create, organize, and understand the links you share.</p></div><div className="ws-heading-actions"><button className="ws-icon-button" onClick={()=>load(true)} disabled={refreshing} aria-label="Refresh your links"><RefreshCw size={17} className={refreshing ? 'ws-spin' : ''} /></button><button className="ws-button" onClick={()=>updateView({showCreate:!showCreate})} aria-expanded={showCreate} aria-controls="create-link-panel"><Plus size={17} />{showCreate ? 'Close creator' : 'Create a link'}</button></div></div>{notice && <p className="ws-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={14} /></button></p>}{error && <p className="ws-notice ws-error" role="alert">{error}<button onClick={()=>load(true)}>Try again</button></p>}<div className="ws-stats">{stats.map(([label,value,Icon])=><article key={label}><div><span>{label}</span><Icon size={17} /></div><strong>{loading || (error && !urls.length) ? '—' : formatNumber(value)}</strong><small>{label==='Total clicks' ? 'Recorded activity across saved links' : label==='Active links' ? 'Available and not expired' : label==='Expired links' ? 'Past their expiration date' : 'Created by your account'}</small></article>)}</div>
    {showCreate && <section className="ws-card ws-create" id="create-link-panel"><div className="ws-card-heading"><div><h2>Create a short link</h2><p>Paste a destination. Add branding or protection when your plan supports it.</p></div><span className="ws-badge">{subscription?.plan?.name || 'Your plan'}</span></div><UrlForm onLinkCreated={link=>saved(link)} onLinkUpdated={link=>saved(link)} onLinkDeleted={code=>{setUrls(previous=>previous.filter(link=>link.shortCode!==code));load(true);}} /></section>}
    <section className="ws-card"><div className="ws-card-heading"><div><h2>Your links</h2><p>Only links belonging to your account appear here.</p></div><span className="ws-muted">{formatNumber(urls.length)} saved</span></div><div className="ws-toolbar"><label className="ws-search"><Search size={17} /><input value={query} onChange={e=>{updateView({query:e.target.value,page:1},true);}} placeholder="Search destination or short code…" aria-label="Search your links" /></label><label><span className="ws-sr-only">Filter by status</span><select aria-label="Filter links by status" value={status} onChange={e=>{updateView({status:e.target.value,page:1});}}>{['All','Active','Expired'].map(value=><option key={value}>{value}</option>)}</select></label><label className="ws-sort"><ArrowDownUp size={15} /><select aria-label="Sort your links" value={sort} onChange={e=>{updateView({sort:e.target.value,page:1});}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="clicks">Most clicks</option></select></label></div>
    {loading ? <div className="ws-empty" role="status"><Loader2 size={24} className="ws-spin" /><p>Loading your saved links…</p></div> : error && !urls.length ? <div className="ws-empty"><h3>Your links couldn’t be loaded.</h3><p>Refresh to retry. Your saved data has not been changed.</p><button className="ws-button" onClick={()=>load()}>Reload links</button></div> : !urls.length ? <div className="ws-empty"><Link2 size={28} /><h3>Your first link starts here.</h3><p>Shorten a URL to see it here with its recorded clicks and analytics.</p><button className="ws-button" onClick={()=>updateView({showCreate:true})}>Create your first link<ArrowRight size={15} /></button></div> : !filtered.length ? <div className="ws-empty"><h3>No matching links.</h3><p>Try a different destination, code, or status.</p><button className="ws-button ws-button-secondary" onClick={()=>{updateView({query:'',status:'All',page:1});}}>Clear filters</button></div> : <div className="ws-link-list">{displayed.map(link=><article className="ws-link-row" key={link.id}><div className="ws-link-info"><div className="ws-link-title"><a href={link.shortUrl} target="_blank" rel="noopener noreferrer">{link.shortUrl}<ExternalLink size={13} /></a><span className={`ws-badge ws-status-${linkStatus(link).toLowerCase()}`}>{linkStatus(link)}</span>{link.passwordProtected && <span className="ws-badge"><LockKeyhole size={11} />Protected</span>}</div><p className="ws-destination" title={link.longUrl}>{link.longUrl}</p><div className="ws-link-meta"><span>Created {date(link.createdAt)}</span><span>{link.expiresAt ? `Expires ${date(link.expiresAt)}` : 'No expiration'}</span><span>{link.lastCheckedAt ? `Destination ${link.isAlive ? 'reachable' : 'unreachable'} · checked ${date(link.lastCheckedAt)}` : 'Destination not checked yet'}</span></div></div><div className="ws-link-side"><div className="ws-click-count"><strong>{formatNumber(link.clicksCount)}</strong><small>clicks</small></div><div className="ws-link-actions"><button className="ws-icon-button" onClick={()=>copy(link)} aria-label={`Copy ${link.shortCode}`}>{copied===link.id ? <Check size={16} /> : <Copy size={16} />}</button><Link className="ws-icon-button" to={`/analytics/${link.id}`} state={{from:'/dashboard'+(params.size?'?'+params:'')}} aria-label={`Analytics for ${link.shortCode}`}><BarChart3 size={16} /></Link><button className="ws-icon-button" disabled={!limits?.qr_code_allowed} title={limits?.qr_code_allowed ? 'Customize QR code' : 'QR codes require an eligible plan'} onClick={()=>setQr(link.shortUrl)} aria-label={`QR code for ${link.shortCode}`}><QrCode size={16} /></button><button className="ws-icon-button" onClick={()=>setDialog({link})} aria-label={`Edit ${link.shortCode}`}><Edit3 size={16} /></button><button className="ws-icon-button ws-danger" onClick={()=>setDialog({link,deleting:true})} aria-label={`Deactivate ${link.shortCode}`}><Trash2 size={16} /></button></div></div></article>)}</div>}
    {!!filtered.length && <div className="ws-pagination"><span>{(current-1)*10+1}–{Math.min(current*10,filtered.length)} of {formatNumber(filtered.length)} links</span><div><button className="ws-icon-button" disabled={current===1} onClick={()=>updateView({page:current-1})} aria-label="Previous page"><ChevronLeft size={16} /></button><span>{current} / {pages}</span><button className="ws-icon-button" disabled={current===pages} onClick={()=>updateView({page:current+1})} aria-label="Next page"><ChevronRight size={16} /></button></div></div>}</section><p className="ws-footnote">Click data updates after the analytics worker processes redirects. Counts refresh every 30 seconds while this window is active.</p>
    {dialog && <LinkDialog key={dialog.link.id+Boolean(dialog.deleting)} {...dialog} limits={limits} onClose={closeDialog} onSaved={saved} />}{qr && <QRCustomizer url={qr} onClose={()=>setQr(null)} />}</WorkspaceShell>;
}
