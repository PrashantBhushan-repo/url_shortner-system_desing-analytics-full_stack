import { Component } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import '../layout/site.css';

export function RouteLoading() { return <div className="site-loading" role="status" aria-live="polite"><Loader2 size={26} /><span>Getting your page ready…</span></div>; }
class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="site-page"><main className="site-content"><div className="site-state" role="alert"><span className="site-state-icon"><RefreshCw size={27} /></span><h1>This page could not load.</h1><p>A connection problem or an updated version of the site may be responsible. Reload to try again.</p><div className="site-state-actions"><button className="site-link-button" onClick={() => window.location.reload()}>Reload page</button><Link className="site-link-button secondary" to="/dashboard">Go to workspace</Link><a className="site-link-button secondary" href="/">Website</a></div></div></main></div>;
  }
}
export default function RouteBoundary({ children }) { const { pathname } = useLocation(); return <PageBoundary key={pathname}>{children}</PageBoundary>; }
