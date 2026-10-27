import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, Link2, Loader2, Moon, QrCode, Sun } from "lucide-react";
import ForgotPasswordModal from "../components/auth/ForgotPasswordModal";
import { PasswordField, PasswordRequirements, ProviderIcon } from "../components/auth/AuthFields";
import { loginUser, registerUser, resendOtp, verifyEmail, verifyLoginOtp, forceChangePassword } from "../services/authApi";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import API from '../services/urlApi';
import { authErrorMessage, passwordIsStrong, requireAuthData } from '../services/authFlow.js';
import "./auth.css";
import { safeReturnTo } from '../routes/navigation';
import { RouteLoading } from '../routes/RouteBoundary';

const initialState = { name: "", email: "", password: "", confirmPassword: "", otp: "" };

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(() => ["register", "signup"].includes(searchParams.get("mode")) ? "register" : "login");
  const [form, setForm] = useState(initialState);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loginUsesTwoFactor, setLoginUsesTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [changePasswordToken, setChangePasswordToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(() => searchParams.get('recover') === '1');
  const [moreProviders, setMoreProviders] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState([]);
  const [providerError, setProviderError] = useState(false);
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [resendAfter, setResendAfter] = useState(0);
  const { login, token, user, profileError, loading: accountLoading } = useAuth();
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    API.get('/auth/options', { signal: controller.signal }).then(response => {
      setProviders(response.data?.data?.providers || []);
      setProviderError(false);
    }).catch(() => { if (!controller.signal.aborted) setProviderError(true); });
    return () => controller.abort();
  }, [optionsVersion]);

  useEffect(() => {
    if (!resendAfter) return;
    const timer = setInterval(() => setResendAfter(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);

  useEffect(() => {
    document.getElementById(mode.startsWith('verify') ? 'auth-otp' : mode === 'force-change-password' ? 'auth-password' : mode === 'register' ? 'auth-name' : 'auth-email')?.focus();
  }, [mode]);

  useEffect(() => {
    if (searchParams.get("mode") === "features") { navigate("/#tools", { replace: true }); return; }
    // Browser navigation starts a fresh form flow; verification steps stay local.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(["register", "signup"].includes(searchParams.get("mode")) ? "register" : "login");
    setError(searchParams.get("error") || "");
    setMessage("");
  }, [searchParams, navigate]);

  useEffect(() => {
    if (token && user && !accountLoading) navigate(safeReturnTo(searchParams.get('next')), { replace: true });
  }, [token, user, accountLoading, navigate, searchParams]);

  useEffect(() => {
    document.title = (mode === "register" ? "Create an account" : mode.startsWith("verify") ? "Verify your account" : mode === "force-change-password" ? "Update your password" : "Sign in") + " | PBUrls";
  }, [mode]);

  const handleOAuthLogin = (provider) => {
    const option = providers.find(item => item.id === provider);
    if (option) {
      try { sessionStorage.setItem('pburls:auth-return', safeReturnTo(searchParams.get('next'))); } catch { /* Sign-in can continue without optional storage. */ }
      window.location.assign(option.url);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        if (!passwordIsStrong(form.password)) { setError('Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'); return; }
        const response = await registerUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
        setPendingUserId(requireAuthData(response, 'userId'));
        setResendAfter(60);
        setMessage("Verification code sent to your email.");
        setForm(prev => ({ ...prev, otp: "" }));
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

        setMessage("Password updated. Signing you in…");
        login(requireAuthData(response, 'accessToken'));
        return;
      }

      const response = await loginUser({ email: form.email.trim(), password: form.password });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Please set a new password before continuing.");
        return;
      }

      if (response.data?.data?.twoFactorRequired) {
        setPendingUserId(response.data.data.userId);
        setLoginUsesTwoFactor(true);
        setMessage("Enter the 6-digit code from your authenticator app.");
        setForm(prev => ({ ...prev, otp: "" }));
        setMode("verify-login");
        return;
      }

      if (response.data?.data?.otpRequired) {
        setPendingUserId(requireAuthData(response, 'userId'));
        setResendAfter(60);
        setLoginUsesTwoFactor(false);
        setForm(prev => ({ ...prev, otp: '' }));
        setMessage("A login code was sent to your email.");
        setMode("verify-login");
        return;
      }

      login(requireAuthData(response, 'accessToken'));
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.code === "EMAIL_NOT_VERIFIED") {
        setPendingUserId(responseData.details?.userId || null);
        setResendAfter(60);
        setLoginUsesTwoFactor(false);
        setForm(prev => ({ ...prev, otp: '' }));
        setMessage(responseData.message || "Please verify your email.");
        setMode("verify-email");
        return;
      }


      setError(authErrorMessage(err, 'Unable to sign in right now. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginOtp = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await verifyLoginOtp({ userId: pendingUserId, otp: form.otp.trim() });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Please set a new password before continuing.");
        return;
      }

      login(requireAuthData(response, 'accessToken'));
    } catch (err) {

      setError(authErrorMessage(err, 'Invalid verification code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingUserId || resending || resendAfter) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      const purpose = mode === "verify-login" ? "login_otp" : "email_verify";
      const response = await resendOtp({ purpose, userId: pendingUserId });
      setMessage(response.data?.message || "A new code has been sent.");
      setResendAfter(60);
    } catch (err) {
      setError(authErrorMessage(err, 'Unable to resend code right now.'));
      if (err.response?.status === 429) setResendAfter(Number(err.response.headers?.['retry-after']) || 60);
    } finally {
      setResending(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setSearchParams(previous => { const params = new URLSearchParams(previous); params.set('mode', newMode); params.delete('error'); params.delete('recover'); return params; }, { replace: true });
    setShowPassword(false);
    setMoreProviders(false);
    setError("");
    setMessage("");
    setResending(false);
    setResendAfter(0);
    setLoginUsesTwoFactor(false);
    setUseBackupCode(false);
    setForm((prev) => ({ ...prev, otp: "", password: "", confirmPassword: "" }));
    if (newMode !== "verify-login" && newMode !== "verify-email") {
      setPendingUserId(null);
    }
  };

  const isRegister = mode === "register";
  const isForceChangeMode = mode === "force-change-password";
  const isCodeMode = mode === "verify-email" || mode === "verify-login";
  const isCredentialsMode = mode === "login" || isRegister;
  const title = isRegister ? "Create your account." : isForceChangeMode ? "Set a new password." : isCodeMode ? (loginUsesTwoFactor ? "One more step." : "Check your inbox.") : "Welcome back.";
  const description = isRegister ? "Start with a free PBUrls workspace." : isForceChangeMode ? "Update your password to continue to your account." : isCodeMode ? (loginUsesTwoFactor ? "Enter the six-digit code from your authenticator app." : "Enter the six-digit code sent to your email.") : "Sign in to your PBUrls workspace.";
  const submitLabel = isRegister ? "Create account" : isForceChangeMode ? "Update password" : isCodeMode ? "Verify and continue" : "Sign in";

  if (token && accountLoading) return <RouteLoading />;
  return <div className="auth-page">
    <header className="auth-header">
      <Link to="/" className="auth-brand" aria-label="PBUrls home"><span><Link2 size={21} strokeWidth={2.5} /></span>pburls<span className="auth-brand-dot">.</span></Link>
      <div className="auth-header-actions"><Link to="/"><ArrowLeft size={15} /> Back to website</Link><button type="button" className="auth-theme" aria-label="Switch color theme" onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}><Sun className="auth-sun" size={18} /><Moon className="auth-moon" size={18} /></button></div>
    </header>
    <main className="auth-layout">
      <aside className="auth-editorial" aria-label="About your PBUrls workspace">
        <div className="auth-editorial-copy"><span className="auth-kicker">A HOME FOR YOUR LINKS</span><h2>Your links.<br /><em>In good order.</em></h2><p>Short links, custom QR codes, and click insights.<br />Together in your workspace.</p></div>
        <div className="auth-link-study" aria-hidden="true"><div className="auth-study-label"><span>THE LONG AND SHORT OF IT</span><span>SHORT LINKS</span></div><div className="auth-original-link">example.com/collections/new-season/launch</div><div className="auth-study-connector"><span /><ArrowRight size={18} /><span /></div><div className="auth-sample-link"><span className="auth-sample-icon"><Link2 size={25} /></span><div><small>READY TO SHARE</small><strong>pburls.online/launch</strong></div><Check size={17} /></div><div className="auth-study-tools"><span><Link2 size={19} /> Shorten</span><span><QrCode size={19} /> Share</span><span><BarChart3 size={19} /> Understand</span></div></div>
        <div className="auth-editorial-bottom"><span>PBURLS / LINK MANAGEMENT</span><Link to="/#tools">Explore the toolkit <ArrowRight size={15} /></Link></div>
      </aside>
      <section className="auth-form-panel" aria-labelledby="auth-title"><div className="auth-form-content">
        <div className="auth-intro"><span className="auth-kicker">{isRegister ? "GET STARTED" : isCodeMode || isForceChangeMode ? "ACCOUNT VERIFICATION" : "ACCOUNT ACCESS"}</span><h1 id="auth-title">{title}</h1><p>{description}</p></div>
        {profileError && <p className="auth-notice auth-error" role="alert">{profileError} <button type="button" onClick={() => window.location.reload()}>Reload account</button></p>}
        {message && <p className="auth-notice auth-success" role="status">{message}</p>}
        {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={mode === "verify-login" ? handleLoginOtp : handleSubmit} aria-busy={submitting}>
          <fieldset disabled={submitting}>
          {isRegister && <div className="auth-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" value={form.name} onChange={handleChange} autoComplete="name" placeholder="Your name" minLength={2} maxLength={50} required /></div>}
          {isCredentialsMode && <div className="auth-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" maxLength={254} required /></div>}
          {(isCredentialsMode || isForceChangeMode) && <div className="auth-field"><div className="auth-label-row"><label htmlFor="auth-password">{isForceChangeMode ? "New password" : "Password"}</label>{mode === "login" && <button type="button" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>}</div><PasswordField id="auth-password" name="password" value={form.password} onChange={handleChange} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete={mode === "login" ? "current-password" : "new-password"} describedBy={isRegister || isForceChangeMode ? "auth-password-help" : undefined} />{(isRegister || isForceChangeMode) && <PasswordRequirements id="auth-password-help" password={form.password} />}</div>}
          {isForceChangeMode && <div className="auth-field"><label htmlFor="auth-confirm-password">Confirm new password</label><input id="auth-confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" minLength={8} maxLength={128} required /></div>}
          {isCodeMode && <div className="auth-field"><label htmlFor="auth-otp">{useBackupCode ? "Backup code" : "Verification code"}</label><input id="auth-otp" className="auth-code-input" name="otp" value={form.otp} onChange={handleChange} inputMode={useBackupCode ? "text" : "numeric"} autoComplete="one-time-code" pattern={useBackupCode ? "[a-fA-F0-9]{6}-?[a-fA-F0-9]{6}" : "[0-9]{6}"} minLength={6} maxLength={useBackupCode ? 13 : 6} placeholder={useBackupCode ? "xxxxxx-xxxxxx" : "000000"} required /><p className="auth-field-note">{loginUsesTwoFactor ? "Use your authenticator code or one of your saved backup codes." : form.email ? 'Sent to ' + form.email : "Check the email address associated with your account."}</p></div>}
          <button className="auth-submit" type="submit" disabled={submitting || (token && accountLoading)}>{submitting ? <><Loader2 size={17} className="auth-spinner" /> Please wait…</> : <>{submitLabel}<ArrowRight size={17} /></>}</button>
          </fieldset>
        </form>
        {isCodeMode && loginUsesTwoFactor && <p className="auth-resend"><button type="button" disabled={submitting} onClick={() => { setUseBackupCode(value => !value); setForm(prev => ({ ...prev, otp: "" })); setError(""); }}>{useBackupCode ? "Use authenticator code" : "Use a backup code"}</button></p>}
        {isCodeMode && !loginUsesTwoFactor && <p className="auth-resend">Didn’t get a code? <button type="button" onClick={handleResendOtp} disabled={submitting || resending || resendAfter > 0 || !pendingUserId}>{resending ? "Sending…" : resendAfter ? `Resend in ${resendAfter}s` : "Resend code"}</button></p>}
        {isCredentialsMode && providers.length > 0 && <><div className="auth-divider"><span>or continue with</span></div><div className="auth-providers">{providers.filter(item => ["google", "github"].includes(item.id)).map(({ id: provider }) => <button key={provider} type="button" onClick={() => handleOAuthLogin(provider)} disabled={submitting}><ProviderIcon provider={provider} /><span>{provider === "google" ? "Google" : "GitHub"}</span></button>)}</div>{providers.some(item => ["microsoft", "amazon"].includes(item.id)) && <button className="auth-more-providers" type="button" aria-expanded={moreProviders} aria-controls="other-providers" onClick={() => setMoreProviders(!moreProviders)}>More sign-in options<ChevronDown size={14} style={{ transform: moreProviders ? "rotate(180deg)" : undefined }} /></button>}{moreProviders && <div className="auth-providers auth-other-providers" id="other-providers">{providers.filter(item => ["microsoft", "amazon"].includes(item.id)).map(({ id: provider }) => <button key={provider} type="button" onClick={() => handleOAuthLogin(provider)} disabled={submitting}><ProviderIcon provider={provider} /><span>{provider === "microsoft" ? "Microsoft" : "Amazon"}</span></button>)}</div>}</>}
        {isCredentialsMode && providerError && <p className="auth-field-note">Additional sign-in options could not load. <button type="button" onClick={() => setOptionsVersion(value => value + 1)}>Try again</button></p>}
        <div className="auth-switch">{isCredentialsMode ? <>{isRegister ? "Already have an account?" : "New to PBUrls?"} <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")} disabled={submitting}>{isRegister ? "Sign in" : "Create an account"}</button></> : <button type="button" onClick={() => switchMode("login")} disabled={submitting}><ArrowLeft size={14} /> Back to sign in</button>}</div>
      <p className="auth-demo-entry">Just looking around? <Link to="/demo">Explore the read-only demo <ArrowRight size={13} /></Link></p></div><footer className="auth-form-footer"><span>© {new Date().getFullYear()} PBUrls</span><Link to="/help">Help & FAQs <ArrowRight size={13} /></Link></footer></section>
    </main>
    {showForgotPassword && <ForgotPasswordModal initialEmail={form.email} onClose={() => setShowForgotPassword(false)} />}
  </div>;
}
