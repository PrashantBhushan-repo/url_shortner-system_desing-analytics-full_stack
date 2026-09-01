import { useMemo, useRef, useState } from "react";
import { 
  User, 
  Mail, 
  Upload, 
  Trash2, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Lock, 
  KeyRound, 
  Check, 
  X,
  ArrowRight,
  ShieldCheck,
  Camera
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

function ProfileSettings({
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
  onEmailConfirm
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

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError("");

    if (!file.type.startsWith("image/")) {
      setImageError("Please select a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image size must be 2 MB or smaller.");
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
    <div className="space-y-8 font-sans text-slate-200">
      
      {/* Top Banner Alert Messages */}
      {(message || error) && (
        <div className="space-y-3">
          {message && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300 flex items-center gap-2.5 font-mono">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs text-rose-300 flex items-center gap-2.5 font-mono">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: IDENTITY CARD & AVATAR MANAGEMENT */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-xl relative overflow-hidden space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Profile &amp; Identity
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400">
                OPERATOR PROFILE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage your personal credentials, identity photo, and contact channels.
            </p>
          </div>

          {memberSince && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-zinc-900 px-3.5 py-1.5 rounded-xl border border-zinc-800 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Member since: <strong className="text-slate-200">{memberSince}</strong></span>
            </div>
          )}
        </div>

        {/* Avatar Presentation & Upload Controls */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/90">
          
          {/* Avatar Container */}
          <div className="relative shrink-0 group">
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt="Profile Avatar"
                className="h-24 w-24 rounded-2xl border-2 border-indigo-500/50 object-cover shadow-lg ring-4 ring-indigo-500/10 transition group-hover:scale-102"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-zinc-700 bg-gradient-to-br from-slate-900 to-indigo-950 text-2xl font-black font-mono text-indigo-300 shadow-lg ring-4 ring-white/5">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg border-2 border-zinc-950 transition cursor-pointer"
              title="Upload new avatar image"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Avatar Info & Actions */}
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {profileForm.name || user?.name || "Operator"}
                </h4>
                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-mono font-bold uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  {user?.role || "USER"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                JPG, PNG, or WebP up to 2 MB. Square aspect ratio is recommended for best clarity.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-slate-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Upload New Image</span>
              </button>

              {profileImagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30 text-xs font-bold text-rose-300 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {imageError && (
              <p className="text-xs text-rose-400 font-mono flex items-center gap-1 mt-2 justify-center sm:justify-start">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{imageError}</span>
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

        </div>

      </div>

      {/* SECTION 2: EDITABLE PROFILE PARAMETERS FORM */}
      <form onSubmit={onSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-xl space-y-6">
        
        <div className="pb-4 border-b border-zinc-800">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            Account Parameters
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how your name and identity appear across links, telemetry logs, and dashboards.
          </p>
        </div>

        <div className="space-y-6 max-w-2xl">
          
          {/* Display Name Input */}
          <div className="space-y-2">
            <label htmlFor="profile-name" className="block text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
              Display Name
            </label>
            <div className="relative">
              <input
                id="profile-name"
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Prashant Bhushan"
                maxLength={50}
                required
                className="w-full rounded-xl border border-zinc-750 bg-zinc-900/90 px-4 py-3 text-sm text-white font-mono placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-inner"
              />
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Letters, spaces, hyphens, and apostrophes only. Maximum 50 characters.
            </p>
          </div>

          {/* Email Address & Change Email Action */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="profile-email" className="block text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
                Primary Account Email
              </label>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                <Check className="w-3 h-3 text-emerald-400" /> Verified Email
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm font-mono text-slate-400 cursor-not-allowed outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(!showEmailForm);
                  setEmailStep(1);
                }}
                className="px-4 py-3 rounded-xl border border-blue-500/40 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 text-xs font-bold font-mono uppercase tracking-wider transition shrink-0 cursor-pointer active:scale-95"
              >
                {showEmailForm ? "Cancel Edit" : "Change Email"}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              This email address is your primary login username and notification endpoint.
            </p>
          </div>

          {/* Expandable Email Verification Wizard */}
          {showEmailForm && (
            <div className="rounded-2xl border border-blue-500/30 bg-zinc-900/90 p-5 space-y-4 shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    {emailStep === 1 ? "Step 1: Request Email Change" : "Step 2: Enter Verification Code"}
                  </h4>
                </div>
                <span className="text-[9px] font-mono bg-blue-500/15 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase">
                  {emailStep === 1 ? "Credentials Verify" : "OTP Code"}
                </span>
              </div>

              {emailMessage && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2.5 text-xs text-emerald-300 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{emailMessage}</span>
                </div>
              )}
              {emailError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-3.5 py-2.5 text-xs text-rose-300 font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}

              {emailStep === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">New Email Address</label>
                    <input
                      type="email"
                      required
                      value={emailForm.newEmail}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                      placeholder="e.g. new-email@domain.com"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-mono text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Confirm Current Password</label>
                    <input
                      type="password"
                      required
                      value={emailForm.currentPassword}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs font-mono text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={onEmailRequest}
                    disabled={loadingEmailChange || !emailForm.newEmail || !emailForm.currentPassword}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase font-mono tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    {loadingEmailChange ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP Verification...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit OTP Code</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1 text-center">
                    <label className="text-[10px] font-mono font-bold text-slate-300 uppercase">Enter 6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className="w-full max-w-xs mx-auto rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-center font-mono text-lg font-bold text-white tracking-[0.5em] outline-none focus:border-blue-500 transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Check your new email inbox for the verification token.</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEmailStep(1)}
                      className="w-1/3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-bold uppercase font-mono transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={onEmailConfirm}
                      disabled={loadingEmailChange || emailOtp.length !== 6}
                      className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase font-mono tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      {loadingEmailChange ? "Confirming..." : "Confirm & Update Email"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Save Changes Action Bar */}
        <div className="pt-6 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-mono">
            Unsaved changes will be stored on this device.
          </p>

          <button
            type="submit"
            disabled={saving || !profileForm.name.trim()}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase font-mono tracking-wider transition shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}

export default ProfileSettings;

