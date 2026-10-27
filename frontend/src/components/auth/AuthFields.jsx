import { Check, Eye, EyeOff } from "lucide-react";

export function PasswordField({ id, name, value, onChange, visible, onToggle, autoComplete, describedBy }) {
  return <div className="auth-password-wrap">
    <input id={id} name={name} type={visible ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} aria-describedby={describedBy} minLength={8} maxLength={128} required />
    <button type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} aria-controls={id}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </div>;
}

export function PasswordRequirements({ id, password }) {
  const requirements = [
    ["8+ characters", password.length >= 8],
    ["Upper & lowercase", /[A-Z]/.test(password) && /[a-z]/.test(password)],
    ["A number", /[0-9]/.test(password)],
    ["A symbol", /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password)],
  ];
  return <ul id={id} className="auth-password-requirements" aria-label="Password requirements">{requirements.map(([label, met]) => <li key={label} className={met ? "is-met" : ""}><Check size={12} aria-hidden="true" /><span>{label}<span className="auth-sr-only">{met ? ": met" : ": required"}</span></span></li>)}</ul>;
}

export function ProviderIcon({ provider }) {
  if (provider === "google") return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94z" fill="#fbbc05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" fill="#ea4335" /></svg>;
  if (provider === "github") return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025a9.564 9.564 0 0 1 5.008 0c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>;
  if (provider === "microsoft") return <svg viewBox="0 0 23 23" width="18" height="18" aria-hidden="true"><path fill="#f35325" d="M0 0h11v11H0z" /><path fill="#81bc06" d="M12 0h11v11H12z" /><path fill="#05a6f0" d="M0 12h11v11H0z" /><path fill="#ffba08" d="M12 12h11v11H12z" /></svg>;
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><text x="7" y="16" fill="currentColor" fontSize="21" fontWeight="700" fontFamily="Georgia,serif">a</text><path d="M3 19q9 5 18-1m-4 0h4v4" stroke="#df8a1c" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;
}
