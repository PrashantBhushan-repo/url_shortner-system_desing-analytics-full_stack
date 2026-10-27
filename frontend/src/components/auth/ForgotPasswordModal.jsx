import { useState, useEffect, useRef } from "react";
import { forgotPassword, resetPassword } from "../../services/authApi";

import { ArrowRight, Loader2, X } from "lucide-react";
import { PasswordField, PasswordRequirements } from "./AuthFields";
import "../../pages/auth.css";
import { authErrorMessage } from '../../services/authFlow.js';

function ForgotPasswordModal({ onClose, initialEmail = '' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.querySelector("input, button")?.focus();
    const handleKeys = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKeys);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKeys); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [onClose]);
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(initialEmail);
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  useEffect(() => {
    if (!resendAfter) return;
    const timer = setTimeout(() => setResendAfter(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendAfter]);
  useEffect(() => { dialogRef.current?.querySelector('form input')?.focus(); }, [step]);

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
    if (loading) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const response = await forgotPassword({ email: email.trim() });
      setUserId(response.data?.data?.userId || '00000000-0000-4000-8000-000000000000');
      setMessage(response.data?.message || 'If an account exists, a reset code has been sent.');
      setResendAfter(60);
      setStep("otp");
    } catch (err) {
      setError(authErrorMessage(err, 'Unable to send reset code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
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
      setError(authErrorMessage(err, 'Unable to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return <div className="auth-dialog-overlay"><section className="auth-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description">
    <button type="button" className="auth-dialog-close" onClick={onClose} aria-label="Close password recovery"><X size={18} /></button>
    <div className="auth-intro"><span className="auth-kicker">ACCOUNT RECOVERY</span><h2 id="reset-title">{step === "email" ? "Forgot your password?" : step === "otp" ? "Choose a new password." : "You’re ready to sign in."}</h2><p id="reset-description">{step === "email" ? "Enter your account email. We’ll send a code to help you reset your password." : step === "otp" ? "Use the code in your email to reset your password." : "Your password has been updated."}</p></div>
    {error && <p className="auth-notice auth-error" role="alert">{error}</p>}
    {message && step !== "done" && <p className="auth-notice auth-success" role="status">{message}</p>}
    {step === "email" && <form onSubmit={handleEmailSubmit} aria-busy={loading}><div className="auth-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" maxLength={254} required disabled={loading} /></div><button className="auth-submit" type="submit" disabled={loading}>{loading ? <><Loader2 size={17} className="auth-spinner" /> Sending…</> : <>Send reset code<ArrowRight size={17} /></>}</button></form>}
    {step === "otp" && <form onSubmit={handleResetSubmit} aria-busy={loading}><fieldset disabled={loading}><div className="auth-field"><label htmlFor="reset-code">Verification code</label><input id="reset-code" className="auth-code-input" value={otp} onChange={e => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required /><p className="auth-field-note">Sent to {email}</p></div><div className="auth-field"><label htmlFor="reset-password">New password</label><PasswordField id="reset-password" name="newPassword" value={password} onChange={e => setPassword(e.target.value)} visible={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" describedBy="reset-password-help" /><PasswordRequirements id="reset-password-help" password={password} /></div><div className="auth-field"><label htmlFor="reset-confirm">Confirm new password</label><PasswordField id="reset-confirm" name="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} autoComplete="new-password" />{confirmPassword && !passwordsMatch && <p className="auth-field-note">Passwords do not match yet.</p>}</div><button className="auth-submit" type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch}>{loading ? "Updating…" : "Reset password"}<ArrowRight size={17} /></button></fieldset><p className="auth-resend"><button type="button" disabled={loading || resendAfter > 0} onClick={handleEmailSubmit}>{resendAfter ? `Resend in ${resendAfter}s` : "Resend reset code"}</button> · <button type="button" disabled={loading} onClick={() => { setStep("email"); setError(""); setMessage(""); setOtp(""); }}>Change email</button></p></form>}
    {step === "done" && <button className="auth-submit" type="button" onClick={onClose}>Back to sign in<ArrowRight size={17} /></button>}
  </section></div>;
}

export default ForgotPasswordModal;
