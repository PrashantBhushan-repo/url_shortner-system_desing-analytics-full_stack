import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Navbar() {
  const { token, logout } = useAuth();

  return (
    <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto h-16 px-6 md:px-8 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span className="bg-gradient-to-tr from-blue-600 to-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center text-white text-base font-extrabold shadow-md shadow-blue-500/20">S</span>
          <span>SnapURL</span>
        </Link>
        <div className="flex items-center gap-4 text-xs md:text-sm">
          {token ? (
            <>
              <Link to="/dashboard" className="text-slate-300 hover:text-white transition font-semibold">Dashboard</Link>
              <button onClick={logout} className="rounded-xl border border-white/10 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-900 transition font-semibold cursor-pointer">Logout</button>
            </>
          ) : (
            <>
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
