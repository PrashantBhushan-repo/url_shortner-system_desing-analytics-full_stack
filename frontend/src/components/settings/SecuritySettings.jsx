import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  Trash2,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  Activity,
  History,
  UserX,
  Lock,
  ChevronRight,
  Monitor,
  ChevronDown,
  ChevronUp
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
  const [subTab, setSubTab] = useState("sessions"); // "sessions" or "history"
  const [showOtherSessions, setShowOtherSessions] = useState(false);

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeLoginHistory = Array.isArray(loginHistory) ? loginHistory : [];
  const currentSession = safeSessions.find((session) => session.isCurrent);
  const otherSessions = safeSessions.filter((session) => !session.isCurrent);
  const lastLogin = safeLoginHistory.find((h) => h.success);
  const isEmailAlertsEnabled = Boolean(user?.securityEmailAlerts);

  // Helper to determine device icon
  const getDeviceIcon = (os = "") => {
    const lowerOS = (os || "").toLowerCase();
    if (lowerOS.includes("windows")) {
      return <Monitor className="w-5 h-5 text-blue-400" />;
    }
    if (lowerOS.includes("mac") || lowerOS.includes("ios") || lowerOS.includes("iphone") || lowerOS.includes("ipad")) {
      return <Smartphone className="w-5 h-5 text-indigo-400" />;
    }
    if (lowerOS.includes("android")) {
      return <Smartphone className="w-5 h-5 text-emerald-400" />;
    }
    if (lowerOS.includes("linux")) {
      return <Laptop className="w-5 h-5 text-orange-400" />;
    }
    return <Globe className="w-5 h-5 text-slate-400" />;
  };

  // Helper for risk coloring
  const getRiskBadge = (risk = "") => {
    switch ((risk || "").toLowerCase()) {
      case "high":
        return <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-400 border border-rose-500/20">High Risk</span>;
      case "medium":
        return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/20">Medium Risk</span>;
      case "low":
      default:
        return <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400 border border-white/5">Low Risk</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Alert Notifications */}
      {securityMessage && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs font-semibold text-emerald-300 animate-fade-in">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <span>{securityMessage}</span>
        </div>
      )}
      {securityError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs font-semibold text-rose-300 animate-fade-in">
          <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
          <span>{securityError}</span>
        </div>
      )}

      {/* Security Hub Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        
        {/* Active Sessions Overview */}
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/30 p-5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">ACTIVE CONNECTIONS</span>
              <p className="text-3xl font-black text-white">{safeSessions.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-white/5 shadow-inner">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal mt-4">Connected client tokens holding active session credentials.</p>
        </div>

        {/* 2FA Status Card */}
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/30 p-5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">MULTI-FACTOR AUTH</span>
              <p className={`text-xl font-bold ${user?.twoFactorEnabled ? "text-emerald-400" : "text-amber-400"}`}>
                {user?.twoFactorEnabled ? "Activated" : "Disabled"}
              </p>
            </div>
            <div className={`rounded-2xl p-3 border ${user?.twoFactorEnabled ? "bg-emerald-500/10 border-emerald-500/25" : "bg-amber-500/10 border-amber-500/25"}`}>
              {user?.twoFactorEnabled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal mt-4">Required configuration for secure, industrial-grade deployments.</p>
        </div>

        {/* Security Alerts Toggle */}
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/30 p-5 backdrop-blur-md flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">SECURITY EMAIL NOTIFICATIONS</span>
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleEmailAlerts(!isEmailAlertsEnabled)}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEmailAlertsEnabled ? "bg-blue-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      user?.securityEmailAlerts ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-300">
                  {isEmailAlertsEnabled ? "Alerts Enabled" : "Alerts Muted"}
                </span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-white/5">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal mt-3">Receive email alerts on new device logins and password updates.</p>
        </div>

      </div>

      {/* Sub Tab Navigation */}
      <div className="border-b border-white/5 flex gap-1">
        <button
          onClick={() => setSubTab("sessions")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition duration-150 flex items-center gap-1.5 cursor-pointer ${
            subTab === "sessions" 
              ? "border-blue-500 text-white" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Activity className="w-4 h-4" /> Active Devices & Sessions
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition duration-150 flex items-center gap-1.5 cursor-pointer ${
            subTab === "history" 
              ? "border-blue-500 text-white" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <History className="w-4 h-4" /> Login History & Audit Trail
        </button>
      </div>

      {/* Active Sessions Panel */}
      {subTab === "sessions" && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Active Login Sessions</h3>
              <p className="text-xs text-slate-400 mt-1">Audit active client credentials. Revoke unrecognized devices.</p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onRevokeAllSessions}
                disabled={otherSessions.length === 0}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Revoke Others
              </button>
              <button
                type="button"
                onClick={onRevokeAllAbsoluteSessions}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition"
              >
                Logout Everywhere
              </button>
            </div>
          </div>

          {/* Current Active Session */}
          {currentSession && (
            <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-[0_0_20px_rgba(16,185,129,0.02)] space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20">
                    {getDeviceIcon(currentSession.os)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">
                        {currentSession.browser || "Unknown Browser"} on {currentSession.os || "Unknown OS"}
                      </h4>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
                        Current Session
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs text-slate-400 font-mono">
                      <span>{currentSession.ip}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> {currentSession.location || "Unknown Location"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider border-t border-emerald-500/10 pt-3">
                First authenticated at: {new Date(currentSession.createdAt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Collapsible Other Connected Devices */}
          <div className="border border-white/5 rounded-2xl bg-slate-950/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOtherSessions(!showOtherSessions)}
              className="w-full flex items-center justify-between px-5 py-4 text-xs font-bold text-slate-300 hover:bg-white/5 transition duration-150 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Laptop className="w-4.5 h-4.5 text-blue-400" /> 
                Other Connected Devices ({otherSessions.length})
              </span>
              {showOtherSessions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showOtherSessions && (
              <div className="p-4 border-t border-white/5 space-y-3 bg-slate-950/40 animate-fade-in">
                {loadingSecurity ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-800 border-t-blue-500" />
                    <span className="text-xs text-slate-500">Querying active sessions...</span>
                  </div>
                ) : otherSessions.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    No other active sessions detected.
                  </div>
                ) : (
                  otherSessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="rounded-xl border border-white/5 bg-slate-950/70 p-4 hover:border-white/10 transition duration-150 flex items-center justify-between gap-4"
                    >
                      <div className="flex gap-3">
                        <div className="rounded-xl bg-slate-900 p-2 border border-white/5">
                          {getDeviceIcon(session.os)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">
                            {session.browser || "Unknown Browser"} on {session.os || "Unknown OS"}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 font-mono">
                            <span>{session.ip}</span>
                            <span>•</span>
                            <span>{session.location || "Unknown Location"}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 mt-1 block">
                            Login time: {new Date(session.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRevokeSession(session.id)}
                        className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2 text-rose-400 hover:bg-rose-500 hover:text-white transition cursor-pointer shrink-0"
                        title="Revoke session key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login History Audit Panel */}
      {subTab === "history" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Security Sign-in Logs</h3>
            <p className="text-xs text-slate-400 mt-1">Audit timeline of recent successful and failed sign-in credentials.</p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-950/20 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="p-4">Event</th>
                  <th className="p-4">Device & Client</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {safeLoginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">No login history recorded.</td>
                  </tr>
                ) : (
                  safeLoginHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition">
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.success 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.success ? "bg-emerald-400" : "bg-rose-400"}`} />
                          {item.success ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-white truncate max-w-[200px]" title={item.device}>
                        {item.device || "Unknown Client"}
                      </td>
                      <td className="p-4 font-mono text-slate-400">{item.ip || "Unknown IP"}</td>
                      <td className="p-4 text-slate-400">{item.location || "Unknown"}</td>
                      <td className="p-4 text-slate-400 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {item.riskLevel ? getRiskBadge(item.riskLevel) : <span className="text-slate-600 font-mono">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger Zone: Account Deletion */}
      <div className="rounded-[2rem] border border-rose-500/15 bg-rose-500/5 p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-400 border border-rose-500/25">
              Danger Zone
            </span>
            <h3 className="text-lg font-bold text-white">Permanently Delete Account</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Permanently destroy your profile, generated short links, custom domains, webhooks, click analytics, and user parameters. This action is irreversible.
            </p>
          </div>
          {!showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-xl bg-rose-600/10 border border-rose-500/20 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-600 hover:text-white transition cursor-pointer"
            >
              Delete Account
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="rounded-2xl border border-rose-500/20 bg-slate-950/60 p-5 space-y-4 animate-fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Confirm Account Deletion</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Please verify your current password to authorize absolute deletion.</p>
              </div>
            </div>

            {deleteMessage && <div className="rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300 border border-emerald-500/20">{deleteMessage}</div>}
            {deleteError && <div className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300 border border-rose-500/20">{deleteError}</div>}

            <form onSubmit={onDeleteAccount} className="space-y-3">
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Verify Current Password"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition font-mono"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                  }}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassword}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {deletingAccount ? "Deleting Account..." : "Confirm Delete"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

export default SecuritySettings;
