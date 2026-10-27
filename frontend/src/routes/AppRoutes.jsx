import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Home from '../pages/Home';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminRoute from '../components/admin/AdminRoute';
import RouteBoundary, { RouteLoading } from './RouteBoundary';
import RouteEffects from './RouteEffects';
import { ADMIN_SECTIONS, SETTINGS_ROUTES, legacySettingsLocation } from './navigation';
import { useAuth } from '../context/AuthContext';

const AuthPage = lazy(() => import('../pages/AuthPage'));
const OAuthCallbackPage = lazy(() => import('../pages/OAuthCallbackPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const BillingPage = lazy(() => import('../pages/BillingPage'));
const AnalyticsPage = lazy(() => import('../pages/Analytics'));
const PricingPage = lazy(() => import('../pages/PricingPage'));
const PasswordProtectedPage = lazy(() => import('../pages/PasswordProtectedPage'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const DemoPage = lazy(() => import('../pages/demo/DemoPage'));
const HelpPage = lazy(() => import('../pages/HelpPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const AiAssistantWidget = lazy(() => import('../components/ai/AiAssistantWidget'));

function FloatingTools() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!['/', '/pricing', '/help'].includes(pathname)) return null;
  return <Suspense fallback={null}><div className={pathname === '/' ? 'lp-home-assistant' : undefined}><AiAssistantWidget key={user?.id || 'guest'} /></div></Suspense>;
}

function SettingsRedirect({ fallback = 'profile' }) {
  const { search, hash } = useLocation();
  return <Navigate to={legacySettingsLocation(search, fallback) + hash} replace />;
}
function SettingsRoute() {
  const { section } = useParams();
  const entry = SETTINGS_ROUTES.find(item => item.slug === section);
  return entry ? <SettingsPage defaultTab={entry.tab} /> : <NotFoundPage />;
}
function AdministrationRoute() {
  const { section } = useParams();
  return ADMIN_SECTIONS.includes(section) ? <AdminDashboard /> : <NotFoundPage />;
}
function AuthRedirect({ mode = 'login', recover = false }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search); params.set('mode', mode);
  if (recover) params.set('recover', '1');
  return <Navigate to={'/auth?' + params} replace />;
}
function CanonicalPath({ children }) {
  const { pathname, search, hash } = useLocation();
  const canonical = pathname.replace(/\/+$/, '') || '/';
  return canonical !== pathname ? <Navigate to={canonical + search + hash} replace /> : children;
}

export default function AppRoutes() {
  return <BrowserRouter><RouteEffects /><RouteBoundary><Suspense fallback={<RouteLoading />}><CanonicalPath><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/login" element={<AuthRedirect />} />
    <Route path="/signup" element={<AuthRedirect mode="register" />} />
    <Route path="/register" element={<AuthRedirect mode="register" />} />
    <Route path="/forgot-password" element={<AuthRedirect recover />} />
    <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
    <Route path="/demo" element={<DemoPage />} />
    <Route path="/demo/admin" element={<DemoPage admin />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/help" element={<HelpPage />} />
    <Route path="/docs" element={<Navigate to="/help#developers" replace />} />
    <Route path="/features" element={<Navigate to="/#tools" replace />} />
    <Route path="/developers" element={<Navigate to="/#developers" replace />} />
    <Route path="/p/:shortCode" element={<PasswordProtectedPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/analytics/:urlId" element={<AnalyticsPage />} />
      <Route path="/settings" element={<SettingsRedirect />} />
      <Route path="/settings/billing" element={<SettingsRedirect fallback="subscription" />} />
      <Route path="/settings/:section" element={<SettingsRoute />} />
      <Route path="/profile" element={<SettingsRedirect />} />
      <Route path="/billing" element={<BillingPage />} />
      {['/refund', '/refunds'].map(path => <Route key={path} path={path} element={<SettingsRedirect fallback="subscription" />} />)}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/admin/:section" element={<AdministrationRoute />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></CanonicalPath></Suspense></RouteBoundary><FloatingTools /></BrowserRouter>;
}
