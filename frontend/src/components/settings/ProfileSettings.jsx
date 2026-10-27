import { useMemo, useRef, useState } from "react";
import {
  User,
  Mail,
  Upload,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  KeyRound,
  Check,
  ArrowRight,
  Camera,
  Globe2,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  Fingerprint
} from "lucide-react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 256;

const getInitials = (name, email) => {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const resizeImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, AVATAR_SIZE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to process image."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.onerror = () => reject(new Error("Unable to read image file."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

export default function ProfileSettings({
  user,
  profileForm,
  setProfileForm,
  onSubmit,
  saving,
  message,
  error,
  // Email change props
  emailForm,
  setEmailForm,
  emailOtp,
  setEmailOtp,
  emailStep,
  setEmailStep,
  emailMessage,
  emailError,
  loadingEmailChange,
  onEmailRequest,
  onEmailConfirm,
  onTabChange,
}) {
  const fileInputRef = useRef(null);
  const [imageError, setImageError] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  const profileImagePreview = useMemo(() => {
    if (profileForm.profileImage) return profileForm.profileImage;
    if (user?.profileImage) return user.profileImage;
    return null;
  }, [profileForm.profileImage, user]);

  const initials = getInitials(profileForm.name || user?.name, user?.email);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  const isDirty =
    (profileForm.name || "") !== (user?.name || "") ||
    (profileForm.profileImage || "") !== (user?.profileImage || "");

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please select a PNG, JPG, or WebP image file.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image file size must be 2 MB or smaller.");
      return;
    }

    try {
      const optimizedImage = await resizeImage(file);
      setProfileForm((prev) => ({ ...prev, profileImage: optimizedImage }));
    } catch (uploadError) {
      setImageError(uploadError.message || "Unable to process image.");
    }
  };

  const handleRemoveImage = () => {
    setImageError("");
    setProfileForm((prev) => ({ ...prev, profileImage: "" }));
  };

  return (
    <div className="profile-panel-container">
      {/* Feedback Messages */}
      {message && (
        <div className="profile-alert profile-alert-success" role="status">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="profile-alert profile-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Profile & Identity Card */}
      <div className="profile-card">
        {/* Terminal / Window Bar Header */}
        <div className="lp-window-bar">
          <div className="lp-window-dots">
            <i />
            <i />
            <i />
          </div>
          <span>
            <Fingerprint size={12} /> Your personal profile
          </span>
          <span className="lp-sample">Account profile</span>
        </div>

        <div className="profile-card-body">
          {/* Header Title */}
          <div className="profile-card-header">
            <span className="lp-eyebrow">PROFILE DETAILS</span>
            <h3>Personal information</h3>
            <p>
              Update how you appear across your workspace, shared links, and team.
            </p>
          </div>

          {/* Avatar Management Studio */}
          <div className="profile-avatar-studio">
            <div className="profile-avatar-wrapper">
              {profileImagePreview ? (
                <img
                  src={profileImagePreview}
                  alt="Profile Avatar"
                  className="profile-avatar-preview"
                />
              ) : (
                <div className="profile-avatar-initials">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="profile-avatar-camera-btn"
                title="Change profile avatar"
                aria-label="Upload profile image"
              >
                <Camera size={15} />
              </button>
            </div>

            <div className="profile-avatar-info">
              <h4>
                <span>{profileForm.name || user?.name || "Workspace member"}</span>
                <span className="lp-announcement" style={{ margin: 0, padding: "3px 8px" }}>
                  <span className="lp-live-dot" /> {user?.role || "USER"}
                </span>
              </h4>
              <p>
                PNG, JPG, or WebP up to 2 MB. Square images work best across share cards and dashboards.
              </p>

              <div className="profile-avatar-actions">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="lp-btn lp-btn-small"
                >
                  <Upload size={14} /> Upload image
                </button>

                {profileImagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="lp-btn lp-btn-secondary lp-btn-small"
                  >
                    <Trash2 size={14} /> Remove avatar
                  </button>
                )}
              </div>

              {imageError && (
                <p className="profile-input-hint" style={{ color: "#f87171", marginTop: 8 }}>
                  <AlertCircle size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  {imageError}
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="profile-form-grid">
            {/* Display Name */}
            <div className="profile-form-group">
              <div className="profile-form-label-row">
                <label htmlFor="profile-name" className="profile-form-label">
                  Display Name
                </label>
                <span className="profile-char-count">
                  {profileForm.name.length} / 50
                </span>
              </div>
              <input
                id="profile-name"
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Alex Rivera"
                maxLength={50}
                required
                className="profile-input"
              />
              <span className="profile-input-hint">
                Your name appears on your short links, team workspaces, generated reports, and activity logs. Letters, spaces, hyphens, and apostrophes allowed.
              </span>
            </div>

            {/* Email Address */}
            <div className="profile-form-group">
              <div className="profile-form-label-row">
                <label htmlFor="profile-email" className="profile-form-label">
                  Primary Account Email
                </label>
                <span className="profile-stat-badge">
                  <ShieldCheck size={13} /> Verified
                </span>
              </div>
              <div className="profile-email-row">
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="profile-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(!showEmailForm);
                    setEmailStep(1);
                  }}
                  className="lp-btn lp-btn-secondary lp-btn-small"
                  style={{ whiteSpace: "nowrap" }}
                >
                  <Mail size={14} />
                  {showEmailForm ? "Cancel change" : "Change email"}
                </button>
              </div>
              <span className="profile-input-hint">
                Used for sign-in, account notifications, and security recovery tokens.
              </span>
            </div>

            {/* Expandable Email Verification Wizard */}
            {showEmailForm && (
              <div className="profile-email-wizard">
                <div className="profile-wizard-header">
                  <span>
                    <Mail size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                    {emailStep === 1 ? "Step 1 of 2: Request Email Change" : "Step 2 of 2: Verify 6-Digit OTP"}
                  </span>
                  <span className="lp-announcement" style={{ margin: 0, padding: "2px 7px", fontSize: 9 }}>
                    {emailStep === 1 ? "AUTHORIZE" : "CONFIRM OTP"}
                  </span>
                </div>

                {emailMessage && (
                  <div className="profile-alert profile-alert-success" style={{ margin: 0 }}>
                    <CheckCircle2 size={15} />
                    <span>{emailMessage}</span>
                  </div>
                )}
                {emailError && (
                  <div className="profile-alert profile-alert-error" style={{ margin: 0 }}>
                    <AlertCircle size={15} />
                    <span>{emailError}</span>
                  </div>
                )}

                {emailStep === 1 ? (
                  <div className="profile-form-grid" style={{ gap: 14 }}>
                    <div className="profile-form-group">
                      <label className="profile-form-label">New Email Address</label>
                      <input
                        type="email"
                        required
                        value={emailForm.newEmail}
                        onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                        placeholder="you@domain.com"
                        className="profile-input"
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Confirm Current Password</label>
                      <input
                        type="password"
                        required
                        value={emailForm.currentPassword}
                        onChange={(e) => setEmailForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter account password"
                        className="profile-input"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={onEmailRequest}
                      disabled={loadingEmailChange || !emailForm.newEmail || !emailForm.currentPassword}
                      className="lp-btn lp-btn-small"
                      style={{ justifyContent: "center", marginTop: 4 }}
                    >
                      {loadingEmailChange ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Sending verification token...</span>
                        </>
                      ) : (
                        <>
                          <span>Send verification code</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="profile-form-grid" style={{ gap: 14 }}>
                    <div className="profile-form-group" style={{ textAlign: "center" }}>
                      <label className="profile-form-label">Enter 6-Digit OTP Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        className="profile-input profile-otp-input"
                      />
                      <span className="profile-input-hint" style={{ marginTop: 6, display: "block" }}>
                        We sent a 6-digit confirmation code to <strong>{emailForm.newEmail}</strong>.
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setEmailStep(1)}
                        className="lp-btn lp-btn-secondary lp-btn-small"
                        style={{ flex: 1 }}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={onEmailConfirm}
                        disabled={loadingEmailChange || emailOtp.length !== 6}
                        className="lp-btn lp-btn-small"
                        style={{ flex: 2, justifyContent: "center" }}
                      >
                        {loadingEmailChange ? "Confirming..." : "Confirm & Update Email"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Connected Features Strip */}
            <div className="profile-shortcuts-grid">
              <div className="profile-shortcut-card">
                <div>
                  <div className="profile-shortcut-top">
                    <span className="profile-shortcut-icon">
                      <ShieldCheck size={18} />
                    </span>
                    <h5>Two-Factor Auth</h5>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    {user?.twoFactorEnabled ? "Active & protecting your sessions." : "Add extra security with TOTP verification."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange && onTabChange("twoFactor")}
                  className="lp-text-link"
                  style={{ alignSelf: "flex-start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {user?.twoFactorEnabled ? "Review 2FA" : "Enable 2FA"} <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="profile-shortcut-card">
                <div>
                  <div className="profile-shortcut-top">
                    <span className="profile-shortcut-icon">
                      <KeyRound size={18} />
                    </span>
                    <h5>Developer API</h5>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    Create API keys for MCP tools, automated shorteners, and integrations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange && onTabChange("apiKeys")}
                  className="lp-text-link"
                  style={{ alignSelf: "flex-start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Manage API keys <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="profile-shortcut-card">
                <div>
                  <div className="profile-shortcut-top">
                    <span className="profile-shortcut-icon">
                      <Globe2 size={18} />
                    </span>
                    <h5>Branded Domains</h5>
                  </div>
                  <p style={{ marginTop: 8 }}>
                    Put your custom domain on every short link you publish.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange && onTabChange("domains")}
                  className="lp-text-link"
                  style={{ alignSelf: "flex-start", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Custom domains <ArrowUpRight size={13} />
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="profile-action-bar">
              <span className="profile-input-hint">
                {isDirty ? (
                  <span style={{ color: "var(--lp-accent)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span className="lp-live-dot" /> You have unsaved profile changes
                  </span>
                ) : (
                  "Profile attributes are up to date."
                )}
              </span>

              <button
                type="submit"
                disabled={saving || !profileForm.name.trim()}
                className="lp-btn"
                style={{ minHeight: 44, padding: "10px 22px" }}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Saving profile...</span>
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save profile changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
