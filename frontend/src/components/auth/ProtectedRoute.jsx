import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signInPath } from '../../routes/navigation';
import { RouteLoading } from '../../routes/RouteBoundary';

function ProtectedRoute() {
  const { token, user, loading, profileError } = useAuth();
  const location = useLocation();

  if (token && !user && profileError) return <div role="alert" className="min-h-screen bg-slate-950 text-white flex flex-col gap-4 items-center justify-center p-8"><p>{profileError}</p><button className="border rounded px-5 py-2" onClick={() => window.location.reload()}>Reload account</button></div>;

  if (loading || (token && !user)) {
    return <RouteLoading />;
  }

  return token && user ? <Outlet /> : <Navigate to={signInPath(location.pathname + location.search + location.hash)} replace />;
}

export default ProtectedRoute;
