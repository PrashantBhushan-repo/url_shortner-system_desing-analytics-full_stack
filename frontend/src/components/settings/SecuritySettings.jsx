import { useState } from "react";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Bell, 
  CheckCircle, 
  XCircle,
  AlertCircle
} from "lucide-react";

function SecuritySettings({
  user,
  sessions,
  loginHistory,
  loadingSecurity,
  securityMessage,
  securityError,
  onRevokeSession,
  onRevokeAllSessions,
  onRevokeAllAbsoluteSessions,
  onToggleEmailAlerts,
  // Delete account props
  showDeleteConfirm,
  setShowDeleteConfirm,
  deletePassword,
  setDeletePassword,
  deleteMessage,
  deleteError,
  deletingAccount,
  onDeleteAccount
}) {
  const currentSession = sessions.find((session) => session.isCurrent);
  const otherSessions = sessions.filter((session) => !session.isCurrent);
  const lastLogin = loginHistory.find(h => h.success);

  // Helper to determine device icon
  const getDeviceIcon = (os = "") => {
    const lowerOS = os.toLowerCase();
    if (lowerOS.includes("windows") || lowerOS.includes("mac") || lowerOS.includes("linux")) {
      return <Laptop className="w-5 h-5 text-sky-400" />;
    }
    if (lowerOS.includes("android") || lowerOS.includes("ios") || lowerOS.includes("iphone") || lowerOS.includes("ipad")) {
      return <Smartphone className="w-5 h-5 text-indigo-400" />;
    }
    return <Globe className="w-5 h-5 text-slate-400" />;
  };

  // Helper for risk coloring
  const getRiskBadge = (risk = "") => {
    switch (risk.toLowerCase()) {
      case "high":
        return <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/25">High Risk</span>;
      case "medium":
        return <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/25">Medium Risk</span>;
      case "low":
      default:
        return <span className="rounded-md bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">Low Risk</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Message */}
      {securityMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{securityMessage}</span>
        </div>
      )}
      {securityError && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300 animate-fadeIn">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{securityError}</span>
        </div>
      )}

      {/* Security Hub Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Active Sessions Overview */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Sessions</p>
              <p className="mt-2 text-3xl font-black text-white">{sessions.length}</p>
            </div>
            <div className="rounded-xl bg-sky-500/10 p-2 border border-sky-500/20">
              <Laptop className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Connected devices currently holding access rights.</p>
        </div>

        {/* 2FA Status Card */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Two-Factor Auth</p>
              <p className={`mt-2 text-xl font-bold ${user?.twoFactorEnabled ? "text-emerald-400" : "text-amber-400"}`}>
                {user?.twoFactorEnabled ? "Activated" : "Disabled"}
              </p>
            </div>
            <div className={`rounded-xl p-2 border ${user?.twoFactorEnabled ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
              {user?.twoFactorEnabled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">MFA verification secures account logins.</p>
        </div>

        {/* Last Login Info */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Last Active Seen</p>
              <p className="mt-2 text-xs font-semibold text-white break-words">
                {lastLogin ? new Date(lastLogin.createdAt).toLocaleString() : "Never login before"}
              </p>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-2 border border-indigo-500/20">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">IP: {lastLogin?.ip || "N/A"}</p>
        </div>

        {/* Notification Settings */}
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security Alerts</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => onToggleEmailAlerts(!user?.securityEmailAlerts)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    user?.securityEmailAlerts ? "bg-blue-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      user?.securityEmailAlerts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-slate-300">
                  {user?.securityEmailAlerts ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-2 border border-purple-500/20">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Email alerts on new login and password changes.</p>
        </div>

      </div>

      {/* Main Sections: Sessions list & Login History Audit */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Column: Sessions List (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Active Sessions</h3>
                <p className="text-xs text-slate-400 mt-1">Audit active credentials and revoke suspicious endpoints immediately.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onRevokeAllSessions}
                  disabled={otherSessions.length === 0}
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Revoke Others
                </button>
                <button
                  onClick={onRevokeAllAbsoluteSessions}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                >
                  Logout Everywhere
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {loadingSecurity ? (
                <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                  <span className="animate-pulse">Loading connected devices...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No active login sessions found.</div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div 
                      key={session.id} 
                      className={`relative overflow-hidden rounded-[1.25rem] border transition duration-150 ${
                        session.isCurrent 
                          ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                          : "border-white/10 bg-slate-950/40 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-lg p-2 ${session.isCurrent ? "bg-emerald-500/10" : "bg-slate-800/80"}`}>
                            {getDeviceIcon(session.os)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">
                                {session.browser || "Unknown Browser"} on {session.os || "Unknown OS"}
                              </span>
                              {session.isCurrent && (
                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/30 animate-pulse">
                                  Current Session
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1 font-mono">{session.ip}</span>
                              <span>•</span>
                              <span className="text-slate-400">{session.location || "Unknown Location"}</span>
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500 uppercase tracking-wide">
                              Login Time: {new Date(session.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {!session.isCurrent && (
                          <button
                            onClick={() => onRevokeSession(session.id)}
                            className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-2 text-rose-300 hover:bg-rose-500/15 hover:text-white transition"
                            title="Revoke session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Timeline / History Audit Log (1 span) */}
        <div className="lg:col-span-1">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md h-full">
            <div>
              <h3 className="text-lg font-bold text-white">Login Audit Trail</h3>
              <p className="text-xs text-slate-400 mt-1">Audit timeline of recent successful and failed sign-in activities.</p>
            </div>

            <div className="mt-5 space-y-4">
              {loginHistory.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No login events logged.</div>
              ) : (
                <div className="relative border-l border-white/10 ml-3 pl-4 space-y-4">
                  {loginHistory.map((item) => (
                    <div key={item.id} className="relative group">
                      
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-1.5 flex h-2 w-2 rounded-full ring-4 ${
                        item.success 
                          ? "bg-emerald-500 ring-emerald-500/10" 
                          : "bg-rose-500 ring-rose-500/10"
                      }`} />

                      <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3 hover:bg-slate-950/60 transition">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold ${item.success ? "text-slate-200" : "text-rose-400"}`}>
                            {item.success ? "Sign-in Success" : "Sign-in Failed"}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-xs text-slate-400 truncate" title={item.device}>
                          {item.device || "Unknown Device"}
                        </p>
                        
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono">
                          <span>{item.ip || "Unknown IP"}</span>
                          {item.location && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{item.location}</span>
                            </>
                          )}
                        </div>

                        {/* Audit Details */}
                        {(!item.success || item.reason || item.riskLevel) && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                            {item.reason && (
                              <p className="text-[10px] text-slate-400 italic">
                                Reason: {item.reason}
                              </p>
                            )}
                            {item.riskLevel && getRiskBadge(item.riskLevel)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Account Deletion (Danger Zone) */}
      <div className="rounded-[2rem] border border-rose-500/15 bg-rose-500/5 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400 border border-rose-500/20">
              Danger Zone
            </span>
            <h3 className="mt-2 text-xl font-bold text-white">Delete User Account</h3>
            <p className="text-sm text-slate-400 leading-normal max-w-xl">
              Permanently destroy your profile, links created, clicks history, and analytics parameters. This operation cannot be reversed.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-500 shadow-md shadow-rose-600/15 transition shrink-0"
            >
              Delete Account
            </button>
          ) : null}
        </div>

        {showDeleteConfirm ? (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-slate-950/80 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">Confirm Absolute Deletion</h4>
                <p className="text-xs text-slate-400 mt-1">Please type your current password to authorize database truncation.</p>
              </div>
            </div>

            {deleteMessage && <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300 border border-emerald-500/20">{deleteMessage}</div>}
            {deleteError && <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-xs text-rose-300 border border-rose-500/20">{deleteError}</div>}

            <form onSubmit={onDeleteAccount} className="mt-4 space-y-3">
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Verify Current Password"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassword}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {deletingAccount ? "Deleting Account..." : "Confirm Delete"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

    </div>
  );
}

export default SecuritySettings;
