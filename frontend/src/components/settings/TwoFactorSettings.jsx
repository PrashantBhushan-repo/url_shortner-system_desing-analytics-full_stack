import { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Copy, 
  Download, 
  Check, 
  QrCode, 
  RefreshCw,
  FileText
} from "lucide-react";

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
  backupCodes,
  setBackupCodes
}) {
  const [enableOtp, setEnableOtp] = useState("");
  const [disableOtp, setDisableOtp] = useState("");
  const [copied, setCopied] = useState(false);
  const isEnabled = Boolean(user?.twoFactorEnabled);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnableOtp("");
    setDisableOtp("");
  }, [isEnabled]);

  const handleCopyCodes = () => {
    if (!backupCodes || backupCodes.length === 0) return;
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    if (!backupCodes || backupCodes.length === 0) return;
    const text = `SNAPURL EMERGENCY BACKUP CODES\n=============================\nGenerated: ${new Date().toLocaleString()}\n\nKeep these codes in a secure location. Each code can only be used once.\n\n${backupCodes.join("\n")}\n`;
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `snapurl-backup-codes-${user?.email || "account"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-md">
      
      {/* Header section */}
      <div className="flex flex-col gap-4 border-b border-white/5 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-400 font-bold">Multi-Factor Authentication</p>
            <h2 className="mt-2 text-3xl font-black text-white">Two-Factor Auth (2FA)</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-xs text-slate-300">
            Secure login sessions with temporary verification codes.
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-slate-400">
          Two-factor authentication adds an extra layer of protection to your account. In addition to your password, you will need a 6-digit verification code from an authenticator app (like Google Authenticator or Microsoft Authenticator) or an emergency backup code to log in.
        </p>
      </div>

      {/* Success/Error Alerts */}
      <div className="mt-6 space-y-4">
        {message && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Backup codes panel when just enabled */}
      {isEnabled && backupCodes && backupCodes.length > 0 && (
        <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 border border-blue-500/20">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Emergency Backup Codes</h3>
              <p className="text-xs text-slate-300 mt-0.5">Keep these in a safe offline location. Each code can be used exactly once if you lose your phone.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-4 font-mono text-sm">
            {backupCodes.map((code, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-center text-slate-200">
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleCopyCodes}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800 hover:text-white transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Codes
                </>
              )}
            </button>
            <button
              onClick={handleDownloadCodes}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              <Download className="w-3.5 h-3.5" /> Download (.txt)
            </button>
            <button
              onClick={() => setBackupCodes([])}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-transparent px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-300 hover:bg-white/5 transition"
            >
              I've Saved Them
            </button>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        
        {/* SETUP/CONFIGURATION PANEL */}
        {!isEnabled ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Set Up Authenticator</h3>
            </div>
            
            <p className="text-xs leading-5 text-slate-400">
              Generate a unique secret configuration key. Scan the QR code using your security application, then type the generated OTP to activate multi-factor logins.
            </p>

            <div className="rounded-2xl bg-slate-950/60 p-5 border border-white/5 text-center flex flex-col items-center justify-center min-h-[220px]">
              {loadingSetup ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                  <span className="text-xs text-slate-400">Generating secret credential...</span>
                </div>
              ) : setupData?.qrCodeDataUrl ? (
                <div className="space-y-4 w-full">
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="Authenticator QR Code"
                    className="mx-auto h-40 w-40 rounded-2xl bg-white p-2 border-2 border-slate-800"
                  />
                  {setupData.manualEntryKey && (
                    <div className="rounded-xl border border-white/5 bg-slate-900 p-3 text-left">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Manual Entry Secret Key</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-300">{setupData.manualEntryKey}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Setup credentials not generated.</p>
                  {setupError && <p className="text-xs text-rose-400">{setupError}</p>}
                  <button
                    type="button"
                    onClick={onRefreshSetup}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Initialize Setup
                  </button>
                </div>
              )}
            </div>

            {setupData?.manualEntryKey && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Authenticator Code</label>
                  <input
                    value={enableOtp}
                    onChange={(e) => setEnableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="e.g. 123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onEnable(enableOtp)}
                  disabled={enabling || loadingSetup || !setupData?.manualEntryKey || enableOtp.length !== 6}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 py-3 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enabling ? "Activating 2FA..." : "Verify and Enable 2FA"}
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* STATUS PANEL */}
        <div className={`rounded-[1.5rem] border border-white/10 bg-slate-900/40 p-5 space-y-4 ${isEnabled ? "xl:col-span-2" : ""}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Authentication Status</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
              isEnabled 
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                : "bg-slate-700/50 text-slate-400 border-white/5"
            }`}>
              {isEnabled ? "Activated" : "Inactive"}
            </span>
          </div>

          <div className="rounded-2xl bg-slate-950/60 p-5 border border-white/5 text-sm space-y-3">
            <p className="font-semibold text-white">
              {isEnabled ? "Your account is secured with 2FA" : "Your account is vulnerable"}
            </p>
            <p className="text-xs text-slate-400 leading-normal">
              {isEnabled
                ? "When logging in, you will be prompted to enter a 6-digit dynamic token generated by your mobile security app, or use an offline emergency backup code."
                : "Secure your SnapURL shortener URLs, redirect parameters, and analytics charts. Enable 2FA now to prevent unauthorized access."}
            </p>

            {isEnabled && (
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Disable Two-Factor Auth</label>
                  <p className="text-[11px] text-slate-500 mt-1">Provide your current 6-digit authenticator OTP to verify identity and deactivate MFA.</p>
                  <input
                    value={disableOtp}
                    onChange={(e) => setDisableOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="e.g. 123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDisable(disableOtp)}
                  disabled={disabling || disableOtp.length !== 6}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {disabling ? "Disabling..." : "Disable 2FA"}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

export default TwoFactorSettings;
