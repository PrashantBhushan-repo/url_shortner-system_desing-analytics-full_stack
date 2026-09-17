import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Shield } from "lucide-react";

function Navbar() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="border-b border-zinc-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto h-16 px-6 md:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
          <span className="font-black tracking-tight text-white text-2xl">
            pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
          </span>
        </Link>
        <div className="flex items-center gap-4 text-xs md:text-sm">
          <Link to="/pricing" className="text-slate-300 hover:text-white transition font-semibold">Pricing</Link>
          {token ? (
            <>
              {user?.role === "ADMIN" && (
                <Link to="/admin" className="rounded-xl border border-red-500/30 px-3.5 py-1.5 text-red-400 bg-red-950/20 hover:bg-red-900/30 hover:text-white transition font-bold text-xs flex items-center gap-1.5 shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-[#E50914]" /> Admin Center
                </Link>
              )}
              <Link to="/billing" className="text-slate-300 hover:text-white transition font-semibold">Billing &amp; Refunds</Link>
              <Link to="/dashboard" className="text-slate-300 hover:text-white transition font-semibold">Dashboard</Link>
              <button onClick={handleLogout} className="rounded-xl border border-white/10 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-900 transition font-semibold cursor-pointer">Logout</button>
            </>
          ) : (
            <>
              <Link to="/auth?mode=features" className="text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                pburls Features
              </Link>
              <Link to="/auth?mode=login" className="text-slate-300 hover:text-white transition font-semibold cursor-pointer">Sign In</Link>
              <Link to="/auth?mode=register" className="rounded-xl bg-blue-600 px-4 py-2 text-white font-bold hover:bg-blue-500 transition shadow-md shadow-blue-500/10 active:scale-[0.98] cursor-pointer">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
