import { useState } from "react";
import { forgotPassword, resetPassword } from "../../services/authApi";

function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const isPasswordStrong = Object.values(passwordCriteria).every(Boolean);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await forgotPassword({ email: email.trim() });
      setUserId(response.data?.data?.userId || "");
      setMessage("A reset code was sent to your email.");
      setStep("otp");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ userId, otp: otp.trim(), password });
      setMessage("Password reset successful. You can now sign in.");
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] transition-all duration-300">
        
        {/* Header section */}
        <div className="relative flex flex-col items-center text-center pb-4 border-b border-white/5">
          <button 
            onClick={onClose} 
            className="absolute top-0 right-0 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {step === "email" && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-8 ring-blue-500/5 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
          )}

          {step === "otp" && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400 ring-8 ring-yellow-500/5 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
            </div>
          )}

          {step === "done" && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-8 ring-emerald-500/5 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          )}

          <p className="text-xs uppercase tracking-[0.25em] text-blue-400 font-semibold">Reset password</p>
          <h2 className="mt-1 text-xl font-bold text-white">
            {step === "email" ? "Recover account" : step === "otp" ? "Set new password" : "Success!"}
          </h2>
          <p className="mt-1.5 text-xs text-slate-400 max-w-[280px]">
            {step === "email" && "Enter your registered email address and we will send a reset code."}
            {step === "otp" && "Enter the verification code sent to your email and choose a new password."}
            {step === "done" && "Your password has been reset successfully. You can now sign in."}
          </p>
        </div>

        {/* Message and Error Banners */}
        {message && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>{message}</span>
          </div>
        )}
        
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form contents */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Enter registered email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                "Send Reset Code"
              )}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                6-digit code
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                New password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5"></path>
                  </svg>
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    password.length > 0
                      ? isPasswordStrong
                        ? "border-emerald-500/50 bg-slate-800 focus:border-emerald-500/50"
                        : "border-rose-500/50 bg-slate-800 focus:border-rose-500/50"
                      : "border-white/10 bg-slate-800/50 focus:border-blue-500/50"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
                      <path d="M9.3 5.2A10.8 10.8 0 0 1 12 4c6.5 0 10 7 10 7a18.7 18.7 0 0 1-4.1 5.1" />
                      <path d="M6.6 6.6A18.7 18.7 0 0 0 2 12s3.5 7 10 7a11.2 11.2 0 0 0 4.4-.9" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Password criteria UI */}
              <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
                <p className="font-semibold text-slate-400 mb-1.5">Password must include:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.length ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600 ml-1 mr-1"></span>
                    )}
                    <span className={passwordCriteria.length ? "text-emerald-300 font-medium" : "text-slate-500"}>8+ characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.uppercase ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600 ml-1 mr-1"></span>
                    )}
                    <span className={passwordCriteria.uppercase ? "text-emerald-300 font-medium" : "text-slate-500"}>Uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.lowercase ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600 ml-1 mr-1"></span>
                    )}
                    <span className={passwordCriteria.lowercase ? "text-emerald-300 font-medium" : "text-slate-500"}>Lowercase letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {passwordCriteria.number ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600 ml-1 mr-1"></span>
                    )}
                    <span className={passwordCriteria.number ? "text-emerald-300 font-medium" : "text-slate-500"}>Number</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 mt-0.5">
                    {passwordCriteria.special ? (
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-600 ml-1 mr-1"></span>
                    )}
                    <span className={passwordCriteria.special ? "text-emerald-300 font-medium" : "text-slate-500"}>Special character</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? "border-emerald-500/50 bg-slate-800 focus:border-emerald-500/50"
                        : "border-rose-500/50 bg-slate-800 focus:border-rose-500/50"
                      : "border-white/10 bg-slate-800/50 focus:border-blue-500/50"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
                      <path d="M9.3 5.2A10.8 10.8 0 0 1 12 4c6.5 0 10 7 10 7a18.7 18.7 0 0 1-4.1 5.1" />
                      <path d="M6.6 6.6A18.7 18.7 0 0 0 2 12s3.5 7 10 7a11.2 11.2 0 0 0 4.4-.9" />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`mt-1.5 text-xs flex items-center gap-1 ${passwordsMatch ? "text-emerald-400 font-medium" : "text-rose-400"}`}>
                  {passwordsMatch ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Passwords match
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Passwords do not match
                    </>
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordStrong || !passwordsMatch}
              className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/35 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[0.98]"
            >
              Go to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
