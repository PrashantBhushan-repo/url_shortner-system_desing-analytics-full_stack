import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

export default function PasswordProtectedPage() {
  const { shortCode } = useParams();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [opening, setOpening] = useState(false);
  function submit(event) {
    event.preventDefault();
    if (!password.trim() || opening) return;
    const destination = new URL(API_BASE_URL, window.location.origin);
    destination.pathname = destination.pathname.replace(/\/api\/?$/, '') + '/r/' + encodeURIComponent(shortCode);
    destination.search = new URLSearchParams({ password }).toString(); destination.hash = '';
    setOpening(true); window.location.assign(destination.href);
  }
  return <div className="site-page"><SiteHeader /><main className="site-content" id="main-content"><section className="site-state protected-link-state"><span className="site-state-icon"><KeyRound size={27} /></span><div className="site-eyebrow">Password-protected link</div><h1>A password is needed<br />to open this link.</h1><p>The link owner has restricted access. Enter the password they shared with you to continue.</p><form onSubmit={submit}><label htmlFor="link-password">Link password</label><input id="link-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required autoFocus aria-invalid={params.get('error') === 'true'} aria-describedby={params.get('error') === 'true' ? 'link-password-error' : undefined} />{params.get('error') === 'true' && <p id="link-password-error" role="alert">That password did not match. Check it with the link owner and try again.</p>}<button className="site-link-button" disabled={!password.trim() || opening}>{opening ? 'Opening link…' : 'Open destination'}<ArrowRight size={15} /></button></form><p className="protected-link-note"><ShieldCheck size={14} />Only the link owner can provide its password.</p><Link to="/help#links">Help with links</Link></section></main><SiteFooter /></div>;
}
