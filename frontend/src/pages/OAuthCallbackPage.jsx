import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { safeReturnTo } from '../routes/navigation';
import { RouteLoading } from '../routes/RouteBoundary';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const token = params.get('token');
    const error = params.get('error');
    if (error || !token) { navigate('/auth?' + new URLSearchParams({ error: error || 'Sign-in could not be completed. Please try again.' }), { replace: true }); return; }
    let destination = '/dashboard';
    try { destination = safeReturnTo(sessionStorage.getItem('pburls:auth-return')); sessionStorage.removeItem('pburls:auth-return'); } catch { /* Optional return destination. */ }
    login(token);
    // Protected routes load the actual profile and enforce its current role.
    // Replace removes the callback (and token) from browser history.
    navigate(destination, { replace: true });
  }, [params, login, navigate]);
  return <RouteLoading />;
}
