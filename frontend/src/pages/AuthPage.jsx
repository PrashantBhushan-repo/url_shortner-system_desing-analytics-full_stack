import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ForgotPasswordModal from "../components/auth/ForgotPasswordModal";
import { loginUser, registerUser, resendOtp, verifyEmail, verifyLoginOtp, forceChangePassword } from "../services/authApi";
import { useAuth } from "../context/AuthContext";
import { Lock, Shield } from "lucide-react";

const initialState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  otp: "",
};

function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    return m === "register" || m === "signup" ? "register" : "login";
  });

  // Sync mode if query params change
  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "register" || m === "signup") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("register");
    } else if (m === "login") {
      setMode("login");
    }
  }, [searchParams]);

  const [form, setForm] = useState(initialState);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loginUsesTwoFactor, setLoginUsesTwoFactor] = useState(false);
  const [changePasswordToken, setChangePasswordToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, navigate]);

  const handleChange = (e) => {
    setError("");
    setMessage("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const passwordCriteria = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
  };

  const parseJwtPayload = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const response = await registerUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
        setPendingUserId(response.data?.data?.userId || null);
        setMessage("Verification code sent to your email.");
        setMode("verify-email");
        return;
      }

      if (mode === "verify-email") {
        await verifyEmail({ userId: pendingUserId, otp: form.otp.trim() });
        setMessage("Email verified. You can now log in.");
        setMode("login");
        return;
      }

      if (mode === "force-change-password") {
        if (form.password !== form.confirmPassword) {
          setError("Passwords do not match.");
          setSubmitting(false);
          return;
        }

        const passesCriteria = Object.values(passwordCriteria).every(Boolean);
        if (!passesCriteria) {
          setError("Password does not meet the complexity criteria.");
          setSubmitting(false);
          return;
        }

        const response = await forceChangePassword({
          changePasswordToken,
          newPassword: form.password,
        });

        setMessage("Password updated successfully. Session authenticated.");
        login(response.data?.data?.accessToken);
        
        const payload = parseJwtPayload(response.data.data.accessToken);
        if (payload.role === "ADMIN") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
        return;
      }

      const response = await loginUser({ email: form.email.trim(), password: form.password });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Administrator Sign-In: Forced password rotation on first login.");
        return;
      }

      if (response.data?.data?.twoFactorRequired) {
        setPendingUserId(response.data.data.userId);
        setLoginUsesTwoFactor(true);
        setMessage("Enter the 6-digit code from your authenticator app.");
        setMode("verify-login");
        return;
      }

      if (response.data?.data?.otpRequired) {
        setPendingUserId(response.data.data.userId);
        setLoginUsesTwoFactor(false);
        setMessage("A login code was sent to your email.");
        setMode("verify-login");
        return;
      }

      login(response.data?.data?.accessToken);
      const payload = parseJwtPayload(response.data.data.accessToken);
      if (payload.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.code === "EMAIL_NOT_VERIFIED") {
        setPendingUserId(responseData.details?.userId || null);
        setMessage(responseData.message || "Please verify your email.");
        setMode("verify-email");
        return;
      }

      const apiMessage = responseData?.message;
      const apiDetails = responseData?.details;
      const detailMessage = Array.isArray(apiDetails)
        ? apiDetails.map((detail) => detail.message).join(". ")
        : null;

      setError(detailMessage || apiMessage || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginOtp = async (e) => {
    e.preventDefault();
    try {
      const response = await verifyLoginOtp({ userId: pendingUserId, otp: form.otp.trim() });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Administrator Sign-In: Forced password rotation on first login.");
        return;
      }

      login(response.data?.data?.accessToken);
      const payload = parseJwtPayload(response.data.data.accessToken);
      if (payload.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const apiDetails = err.response?.data?.details;
      const detailMessage = Array.isArray(apiDetails)
        ? apiDetails.map((detail) => detail.message).join(". ")
        : null;

      setError(detailMessage || apiMessage || "Invalid OTP");
    }
  };

  const handleResendOtp = async () => {
    if (!pendingUserId) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      const purpose = mode === "verify-login" ? "login_otp" : "email_verify";
      const response = await resendOtp({ purpose, userId: pendingUserId });
      setMessage(response.data?.message || "A new code has been sent.");
    } catch (err) {
      const apiMessage = err.response?.data?.message || "Unable to resend code right now.";
      setError(apiMessage);
    } finally {
      setResending(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setMessage("");
    setResending(false);
    setLoginUsesTwoFactor(false);
    setForm((prev) => ({ ...prev, otp: "", password: "", confirmPassword: "" }));
    if (newMode !== "verify-login" && newMode !== "verify-email") {
      setPendingUserId(null);
    }
  };

  const isForceChangeMode = mode === "force-change-password";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className={`w-full max-w-md rounded-2xl border bg-slate-900/80 p-8 shadow-lg backdrop-blur-md transition-all duration-300 ${
        isForceChangeMode 
          ? "border-red-500/20 shadow-red-500/10" 
          : "border-white/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]"
      }`}>
        
        {isForceChangeMode && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2 text-xs font-mono">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <strong>ADMINISTRATIVE SESSION DETECTED</strong>
              <p className="mt-1">First-time console provisioning requires password change before session tokens are signed.</p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          {isForceChangeMode ? (
            <>
              <Lock className="w-6 h-6 text-red-500" />
              <span>Rotate Password</span>
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : mode === "verify-email" ? (
            "Verify your email"
          ) : mode === "verify-login" ? (
            loginUsesTwoFactor ? "MFA Code Verification" : "Verify Login"
          ) : (
            "Sign Up"
          )}
        </h1>
        
        <p className="mt-2 text-sm text-slate-400">
          {isForceChangeMode 
            ? "Choose a strong, complex credential to authorize your administration privileges."
            : mode === "login" 
            ? "Sign in to manage your short links." 
            : mode === "verify-login" && loginUsesTwoFactor 
            ? "Enter the 6-digit code from your system authenticator app." 
            : "Use the secure OTP flow for your account."}
        </p>

        {message ? <div className={`mt-4 rounded-lg border p-3 text-sm font-mono ${isForceChangeMode ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{message}</div> : null}
        {error ? <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300 font-mono">{error}</div> : null}

        <form className="mt-6 space-y-4" onSubmit={mode === "verify-login" ? handleLoginOtp : handleSubmit}>
          {mode === "register" ? (
            <div>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Full Name"
                required
              />
              <p className="mt-2 text-xs text-slate-500">Use your full name; letters, spaces, hyphens and apostrophes only.</p>
            </div>
          ) : null}

          {isForceChangeMode ? (
            <>
              <div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-red-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="New Admin Password"
                  required
                />
              </div>
              <div>
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-red-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Confirm New Password"
                  required
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                <span className="text-slate-500 uppercase font-black col-span-2 tracking-wider">Complexity Rules:</span>
                <div className={passwordCriteria.length ? "text-emerald-400" : "text-slate-500"}>✓ 8+ chars</div>
                <div className={passwordCriteria.uppercase ? "text-emerald-400" : "text-slate-500"}>✓ Uppercase</div>
                <div className={passwordCriteria.lowercase ? "text-emerald-400" : "text-slate-500"}>✓ Lowercase</div>
                <div className={passwordCriteria.number ? "text-emerald-400" : "text-slate-500"}>✓ Number</div>
                <div className={passwordCriteria.special ? "text-emerald-400" : "text-slate-500"}>✓ Special Symbol</div>
              </div>
            </>
          ) : (mode === "login" || mode === "register") ? (
            <>
              <div>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Email"
                  required
                />
              </div>
              <div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 pr-12 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Password"
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
              </div>
            </>
          ) : null}

          {(mode === "verify-email" || mode === "verify-login") ? (
            <div className="space-y-3 font-mono">
              <input
                name="otp"
                value={form.otp}
                onChange={handleChange}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2.5 text-white text-center tracking-widest font-black"
                placeholder={loginUsesTwoFactor ? "Authenticator code" : "OTP Code"}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              {!loginUsesTwoFactor ? (
                <button type="button" onClick={handleResendOtp} disabled={resending || !pendingUserId} className="w-full rounded-lg border border-blue-500/40 px-4 py-2.5 text-xs font-bold text-blue-300 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                  {resending ? "Sending..." : "Resend code"}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
              isForceChangeMode 
                ? "bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25 hover:from-red-500 hover:to-rose-500"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : isForceChangeMode ? (
              "ROTATE PASSWORD & ACTIVATE SESSION"
            ) : mode === "login" ? (
              "Sign In"
            ) : mode === "register" ? (
              "Sign Up"
            ) : mode === "verify-email" ? (
              "Verify Email"
            ) : (
              "Verify Login"
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-4 text-sm text-slate-400 font-mono text-xs">
          {isForceChangeMode ? (
            <div className="text-center text-slate-500 uppercase">
              Secure Administration console rotation active.
            </div>
          ) : (mode === "login" || mode === "register") ? (
            <>
              <div className="flex justify-between items-center w-full">
                <Link to="/" className="hover:text-white transition-colors">← Back home</Link>
                {mode === "login" && (
                  <button type="button" className="hover:text-white transition-colors" onClick={() => setShowForgotPassword(true)}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="text-[10px] border-t border-white/5 pt-4 text-center">
                {mode === "login" ? (
                  <>
                    New to SnapURL?{" "}
                    <button type="button" onClick={() => switchMode("register")} className="text-blue-400 font-semibold hover:text-blue-300 transition cursor-pointer">
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("login")} className="text-blue-400 font-semibold hover:text-blue-300 transition cursor-pointer">
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center w-full">
              <button type="button" className="hover:text-white transition-colors" onClick={() => switchMode("login")}>
                Back to sign in
              </button>
              <Link to="/" className="hover:text-white transition-colors">Back home</Link>
            </div>
          )}
        </div>
      </div>
      {showForgotPassword ? <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} /> : null}
    </div>
  );
}

export default AuthPage;
