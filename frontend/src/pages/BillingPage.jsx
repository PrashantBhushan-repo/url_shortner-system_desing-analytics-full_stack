import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import SubscriptionSettings from '../components/settings/SubscriptionSettings';
import './billing-page.css';

export default function BillingPage() {
  const { user } = useAuth();
  return <div className="site-page billing-page">
    <a className="billing-skip" href="#main-content">Skip to billing</a>
    <SiteHeader workspace />
    <main className="site-content" id="main-content">
      <nav className="billing-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard" className="billing-breadcrumb-home">
          <LayoutDashboard size={12} />Workspace
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <span aria-current="page">Billing</span>
        <Link to="/dashboard" className="billing-back-pill">
          <ArrowLeft size={13} />Back to workspace
        </Link>
      </nav>
      <header className="billing-page-heading">
        <div><span className="site-eyebrow">Billing</span><h1>Plans &amp; billing</h1><p>Manage your plan, usage, payment history, invoices, and refund requests.</p></div>
        <Link className="site-link-button secondary" to="/pricing">Compare plans<ArrowUpRight size={16} /></Link>
      </header>
      <SubscriptionSettings key={user?.id || 'account'} />
    </main>
    <SiteFooter />
  </div>;
}
