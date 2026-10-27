import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CreditCard, ExternalLink, Home, LayoutDashboard, Link2, LogOut, Menu, Moon, Settings, ShieldCheck, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './site.css';

export default function SiteHeader({ workspace = false }) {
  const { user, token, logout } = useAuth();
  const { setTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [expandedFor, setExpandedFor] = useState(null);
  const open = expandedFor === pathname;
  const setOpen = useCallback(value => setExpandedFor(value ? pathname : null), [pathname]);
  const menuButton = useRef(null);
  const header = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const items = workspace ? [
    { to: '/dashboard', label: 'Links', icon: LayoutDashboard, active: pathname === '/dashboard' || pathname.startsWith('/analytics/') },
    { to: '/billing', label: 'Billing', icon: CreditCard, active: pathname === '/billing' },
    { to: '/settings/profile', label: 'Settings', icon: Settings, active: pathname.startsWith('/settings/') },
    ...(user?.role === 'ADMIN' ? [{ to: '/admin/overview', label: 'Admin', icon: ShieldCheck, active: pathname.startsWith('/admin') }] : []),
    { to: '/help', label: 'Help', icon: BookOpen, active: pathname === '/help' },
  ] : [
    { to: '/#tools', label: 'Features', icon: Home },
    { to: '/demo', label: 'Demo', active: pathname.startsWith('/demo') },
    { to: '/pricing', label: 'Pricing', active: pathname === '/pricing' },
    { to: '/help', label: 'Help', active: pathname === '/help' },
  ];
  useEffect(() => {
    if (!open) return;
    const keydown = event => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    const outside = event => { if (!header.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', keydown); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside); };
  }, [open, setOpen]);
  useEffect(() => {
    if (!userMenuOpen) return;
    const keydown = event => { if (event.key === 'Escape') setUserMenuOpen(false); };
    const outside = event => { if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside); };
  }, [userMenuOpen]);
  async function signOut() { setOpen(false); setUserMenuOpen(false); await logout(); navigate('/auth', { replace: true }); }
  return <header className="site-header" ref={header}>
    <Link to={workspace ? '/dashboard' : '/'} className="site-brand" aria-label={workspace ? 'PBUrls workspace' : 'PBUrls home'}><span><Link2 size={21} strokeWidth={2.5} /></span>pburls<span className="site-brand-dot">.</span></Link>
    <nav className={'site-nav' + (open ? ' is-open' : '')} id="site-navigation" aria-label={workspace ? 'Workspace navigation' : 'Main navigation'}>
      {items.map(({ to, label, icon: Icon, active }) => <Link key={to} to={to} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)}>{Icon && <Icon size={16} />}{label}</Link>)}
      {workspace && <Link to="/" className="site-mobile-only" onClick={() => setOpen(false)}>Visit website<ArrowUpRight size={14} /></Link>}
      {token && <button className="site-mobile-only" onClick={signOut}><LogOut size={16} />Sign out</button>}
    </nav>
    <div className="site-account">
      <button className="site-icon" aria-label="Switch color theme" onClick={() => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')}><Sun className="site-sun" size={18} /><Moon className="site-moon" size={18} /></button>
      {token ? (
        workspace ? (
          <div className="site-user-menu" ref={userMenuRef}>
            <button
              className="site-avatar site-avatar-btn"
              aria-label="Open user menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={user?.name || 'Your account'}
              onClick={() => setUserMenuOpen(v => !v)}
            >
              {user?.name?.slice(0, 1).toUpperCase() || 'P'}
            </button>
            {userMenuOpen && (
              <div className="site-user-dropdown" role="menu">
                <div className="site-user-info">
                  <span className="site-user-name">{user?.name || 'Your account'}</span>
                  {user?.email && <span className="site-user-email">{user.email}</span>}
                </div>
                <div className="site-user-divider" />
                <Link to="/" className="site-user-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <ExternalLink size={14} />Back to website
                </Link>
                <Link to="/settings/profile" className="site-user-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <Settings size={14} />Settings
                </Link>
                <div className="site-user-divider" />
                <button className="site-user-item site-user-signout" role="menuitem" onClick={signOut}>
                  <LogOut size={14} />Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/dashboard" className="site-cta" aria-label="Open workspace">Open workspace<ArrowUpRight size={14} /></Link>
        )
      ) : (
        <><Link className="site-login" to="/auth">Sign in</Link><Link className="site-cta" to="/auth?mode=register">Get started<ArrowUpRight size={14} /></Link></>
      )}
      <button className="site-icon site-menu-button" ref={menuButton} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
    </div>
  </header>;
}
