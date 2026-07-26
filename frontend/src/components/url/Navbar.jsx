import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Navbar() {
  const { token, logout } = useAuth();

  return (
    <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto h-16 px-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 w-8 h-8 rounded-lg flex items-center justify-center text-white text-base font-extrabold shadow-md shadow-blue-500/20">S</span>
          <span>SnapURL</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {token ? (
            <>
              <Link to="/dashboard" className="text-slate-300 hover:text-white transition py-1.5 px-3 font-medium">Dashboard</Link>
              <button onClick={logout} className="rounded-lg border border-white/10 px-3.5 py-1.5 text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer">Logout</button>
            </>
          ) : (
            <>
              <Link to="/auth?mode=login" className="text-slate-300 hover:text-white transition py-1.5 px-3 font-medium cursor-pointer">Sign in</Link>
              <Link to="/auth?mode=register" className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-white font-medium hover:bg-blue-500 transition shadow-sm shadow-blue-500/10 active:scale-[0.98] cursor-pointer">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
