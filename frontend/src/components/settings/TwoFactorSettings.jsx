import { useEffect, useState } from "react";

function TwoFactorSettings({
  user,
  setupData,
  loadingSetup,
  setupError,
  onRefreshSetup,
  onEnable,
  onDisable,
  enabling,
  disabling,
  message,
  error,
}) {
  const [enableOtp, setEnableOtp] = useState("");
  const [disableOtp, setDisableOtp] = useState("");
  const isEnabled = Boolean(user?.twoFactorEnabled);

  useEffect(() => {
    setEnableOtp("");
    setDisableOtp("");
  }, [isEnabled]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Two-factor authentication</h2>
        <p className="text-sm text-slate-400">
          Secure your account with an authenticator app such as Google Authenticator, Microsoft Authenticator, or Authy.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div> : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {!isEnabled ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Enable 2FA</h3>
            <p className="mt-3 text-sm text-slate-400">
              Scan the QR code with your authenticator app, or enter the setup key manually, then enter the 6-digit code.
            </p>

            <div className="mt-5 rounded-3xl bg-slate-900/80 p-5 text-center">
              {loadingSetup ? (
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-800 text-sm text-slate-400">
                  Loading QR code...
                </div>
              ) : setupData?.qrCodeDataUrl ? (
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="Authenticator app QR code"
                  className="mx-auto h-40 w-40 rounded-3xl bg-white p-2"
                />
              ) : (
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-800 text-sm text-slate-400">
                  QR code unavailable
                </div>
              )}

              {setupData?.manualEntryKey ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-left">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manual setup key</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-200">{setupData.manualEntryKey}</p>
                </div>
              ) : null}

              {setupError ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-rose-300">{setupError}</p>
                  <button
                    type="button"
                    onClick={onRefreshSetup}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
                  >
                    Generate new QR code
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Enter code from authenticator app</label>
                <input
                  value={enableOtp}
                  onChange={(e) => setEnableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => onEnable(enableOtp)}
                disabled={enabling || loadingSetup || !setupData?.manualEntryKey}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enabling ? "Enabling..." : "Enable 2FA"}
              </button>
            </div>
          </div>
        ) : null}

        <div className={`rounded-3xl border border-white/10 bg-slate-950/70 p-5 ${isEnabled ? "xl:col-span-2" : ""}`}>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Current status</h3>
          <div className="mt-4 rounded-3xl bg-slate-900/80 p-5 text-sm text-slate-400">
            <p className="font-medium text-white">{isEnabled ? "Enabled" : "Not enabled"}</p>
            <p className="mt-3">
              {isEnabled
                ? "Your account requires a code from your authenticator app each time you sign in."
                : "Use your authenticator app to approve each login and keep your account safer."}
            </p>

            {isEnabled ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Enter code to disable 2FA</label>
                  <input
                    value={disableOtp}
                    onChange={(e) => setDisableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDisable(disableOtp)}
                  disabled={disabling}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-800 px-5 py-3 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {disabling ? "Disabling..." : "Disable 2FA"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorSettings;
