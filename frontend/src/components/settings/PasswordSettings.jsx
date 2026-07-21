function PasswordSettings({ passwordForm, setPasswordForm, onSubmit, message, error, passwordCriteria, doesPasswordMatch, showCurrentPassword, showNewPassword, showConfirmPassword, toggleShowCurrentPassword, toggleShowNewPassword, toggleShowConfirmPassword }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-white">Password</h2>
        <p className="text-sm text-slate-400">Change the password used to log in to your account.</p>
      </div>

      <div className="mt-6 space-y-4">
        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div> : null}
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Current password</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              required
            />
            <button type="button" onClick={toggleShowCurrentPassword} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white" aria-label="Toggle current password visibility">
              {showCurrentPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">New password</label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              required
            />
            <button type="button" onClick={toggleShowNewPassword} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white" aria-label="Toggle new password visibility">
              {showNewPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-slate-400">
            <p>Strong password should include:</p>
            <div className={passwordCriteria.length ? "text-emerald-300" : "text-slate-500"}>• At least 8 characters</div>
            <div className={passwordCriteria.uppercase ? "text-emerald-300" : "text-slate-500"}>• Uppercase letters</div>
            <div className={passwordCriteria.lowercase ? "text-emerald-300" : "text-slate-500"}>• Lowercase letters</div>
            <div className={passwordCriteria.number ? "text-emerald-300" : "text-slate-500"}>• Numbers</div>
            <div className={passwordCriteria.special ? "text-emerald-300" : "text-slate-500"}>• Special symbols</div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Confirm new password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
              required
            />
            <button type="button" onClick={toggleShowConfirmPassword} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white" aria-label="Toggle confirm password visibility">
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
          {passwordForm.confirmPassword.length > 0 ? (
            <p className={`mt-3 text-sm ${doesPasswordMatch ? "text-emerald-300" : "text-rose-300"}`}>
              {doesPasswordMatch ? "Passwords match." : "Passwords do not match."}
            </p>
          ) : null}
        </div>

        <div>
          <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordSettings;
