import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

function PasswordSettings({ passwordForm, setPasswordForm, onSubmit, message, error, passwordCriteria, doesPasswordMatch, showCurrentPassword, showNewPassword, showConfirmPassword, toggleShowCurrentPassword, toggleShowNewPassword, toggleShowConfirmPassword, saving }) {
  const fields = [
    { key: "currentPassword", label: "Current password", shown: showCurrentPassword, toggle: toggleShowCurrentPassword, autocomplete: "current-password" },
    { key: "newPassword", label: "New password", shown: showNewPassword, toggle: toggleShowNewPassword, autocomplete: "new-password" },
    { key: "confirmPassword", label: "Confirm new password", shown: showConfirmPassword, toggle: toggleShowConfirmPassword, autocomplete: "new-password" },
  ];
  const requirements = [["length", "At least 8 characters"], ["uppercase", "An uppercase letter"], ["lowercase", "A lowercase letter"], ["number", "A number"], ["special", "A special character"]];
  const passed = Object.values(passwordCriteria).filter(Boolean).length;
  return <section className="profile-card settings-password">
    <div className="settings-card-intro"><span className="settings-eyebrow">SIGN-IN CREDENTIALS</span><h2>Update your password</h2><p>A strong, unique password is your first line of defense.</p></div>
    <div className="settings-password-body">
      <form id="settings-password-form" onSubmit={onSubmit} className="profile-form-grid">
        {message && <div className="profile-alert profile-alert-success" role="status">{message}</div>}
        {error && <div className="profile-alert profile-alert-error" role="alert">{error}</div>}
        {fields.map(field => <div className="profile-form-group" key={field.key}>
          <label className="profile-form-label" htmlFor={field.key}>{field.label}</label>
          <div className="settings-password-input">
            <LockKeyhole size={15} />
            <input id={field.key} className="profile-input" type={field.shown ? "text" : "password"} autoComplete={field.autocomplete} value={passwordForm[field.key]} onChange={e => setPasswordForm(prev => ({ ...prev, [field.key]: e.target.value }))} required disabled={saving} />
            <button type="button" onClick={field.toggle} aria-label={(field.shown ? "Hide " : "Show ") + field.label.toLowerCase()} aria-pressed={field.shown}>{field.shown ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {field.key === "confirmPassword" && passwordForm.confirmPassword && <span role="status" className={doesPasswordMatch ? "settings-password-match" : "settings-password-mismatch"}>{doesPasswordMatch ? "Passwords match." : "Passwords do not match yet."}</span>}
        </div>)}
      </form>
      <aside className="settings-password-guide">
        <span className="settings-section-icon"><ShieldCheck size={22} /></span>
        <h3>Make it a strong one</h3><p>Your new password should include:</p>
        <div className="settings-password-strength" aria-label={passed + " of 5 password requirements met"}>{requirements.map(([key]) => <i key={key} className={passwordCriteria[key] ? "is-met" : ""} />)}</div>
        <ul>{requirements.map(([key,label]) => <li key={key} className={passwordCriteria[key] ? "is-met" : ""}><span>{passwordCriteria[key] ? <Check size={11} /> : <span />}</span>{label}</li>)}</ul>
      </aside>
    </div>
    <div className="settings-password-footer"><p><ShieldCheck size={15} /> You'll sign in again after changing your password.</p><button type="submit" form="settings-password-form" className="lp-btn lp-btn-small" disabled={saving || !doesPasswordMatch || passed !== 5 || !passwordForm.currentPassword}>{saving ? "Updating password…" : "Update password"}</button></div>
  </section>;
}

export default PasswordSettings;
