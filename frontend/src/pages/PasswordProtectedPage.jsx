import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { KeyRound, ShieldAlert, ArrowRight, ShieldCheck } from "lucide-react";

function PasswordProtectedPage() {
  const { shortCode } = useParams();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const isError = searchParams.get("error") === "true";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    // Construct redirect directly to base URL gateway (removing '/api' suffix)
    const baseRedirectUrl = apiUrl.replace(/\/api\/?$/, "");
    window.location.href = `${baseRedirectUrl}/${shortCode}?password=${encodeURIComponent(password)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden text-white">
      
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        
        {/* Logo and Status */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg">
            <KeyRound className="h-6 w-6 text-blue-400 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Decryption Key Required</h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            This short link is encrypted and requires a security password to proceed to the destination.
          </p>
        </div>

        {/* Form Container */}
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-2xl">
          {isError && (
            <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Incorrect password. Verification failed.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Link Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold hover:bg-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Unlock Destination <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-center text-slate-600 font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> SECURED BY SNAPURL
        </p>

      </div>
    </div>
  );
}

export default PasswordProtectedPage;
