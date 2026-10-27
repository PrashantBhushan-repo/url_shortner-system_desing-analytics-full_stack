import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

export default function NotFoundPage({ forbidden = false }) {
  const { token } = useAuth();
  return <div className="site-page"><SiteHeader workspace={Boolean(token)} /><main className="site-content" id="main-content"><div className="site-state"><span className="site-state-icon"><Compass size={28} /></span><div className="site-eyebrow">{forbidden ? 'Access restricted' : '404 · Page not found'}</div><h1>{forbidden ? 'This page needs administrator access.' : 'Let’s get you back on track.'}</h1><p>{forbidden ? 'Your account can still use its workspace. Contact your administrator if you need additional access.' : 'This address may have changed, or the page does not exist. Use the navigation to find what you need.'}</p><div className="site-state-actions"><Link className="site-link-button" to={token ? '/dashboard' : '/'}>{token ? 'Open your workspace' : 'Back to website'}<ArrowRight size={15} /></Link><Link className="site-link-button secondary" to="/help">Help & guides</Link></div></div></main><SiteFooter /></div>;
}
