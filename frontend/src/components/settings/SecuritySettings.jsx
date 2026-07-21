import { useMemo } from "react";

function SecuritySettings({ sessions, loginHistory, loadingSecurity, securityMessage, securityError, onRevokeSession, onRevokeAllSessions }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Security</h2>
        <p className="text-sm text-slate-400">Manage active sessions and review recent sign-in activity.</p>
      </div>

      <div className="mt-6 space-y-4">
        {securityMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{securityMessage}</div> : null}
        {securityError ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{securityError}</div> : null}
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Active sessions</h3>
          <p className="mt-2 text-sm text-slate-500">Revoke sessions you don't recognize.</p>
        </div>
        <button onClick={onRevokeAllSessions} className="rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-3 text-sm font-medium text-white hover:bg-slate-900">
          Revoke all others
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          {loadingSecurity ? (
            <p className="text-sm text-slate-400">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400">No active sessions found.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{session.device || "Unknown device"}</p>
                      <p className="text-sm text-slate-400">{session.ip || "Unknown IP"}</p>
                      <p className="text-xs text-slate-500">Established {new Date(session.createdAt).toLocaleString()}</p>
                    </div>
                    <button onClick={() => onRevokeSession(session.id)} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Login history</h3>
          {loginHistory.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No recent login history available.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {loginHistory.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{item.success ? "Successful login" : "Failed login"}</p>
                      <p className="text-sm text-slate-400">{item.ip || "Unknown IP"} • {item.device || "Unknown device"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${item.success ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SecuritySettings;
