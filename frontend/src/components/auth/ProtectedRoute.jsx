import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function ProtectedRoute() {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>;
  }

  return token ? <Outlet /> : <Navigate to="/auth" replace />;
}

export default ProtectedRoute;
