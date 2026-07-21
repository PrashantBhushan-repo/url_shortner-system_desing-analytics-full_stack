import { useMemo, useRef, useState } from "react";

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

function ProfileSettings({ user, profileForm, setProfileForm, onSubmit, saving, message, error }) {
  const fileInputRef = useRef(null);
  const [imageError, setImageError] = useState("");

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
      setImageError("Please choose a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 2 MB or smaller.");
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
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="border-b border-white/10 pb-6">
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-slate-400">Update your display name and profile photo.</p>
      </div>

      <div className="mt-6 space-y-4">
        {message ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-8">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt="Profile"
                className="h-24 w-24 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-2xl font-semibold text-slate-200">
                {initials}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-white">Profile photo</p>
              <p className="mt-1 text-sm text-slate-400">Upload a square image. JPG, PNG, or WebP up to 2 MB.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Upload photo
              </button>
              {profileImagePreview ? (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {imageError ? <p className="text-sm text-rose-300">{imageError}</p> : null}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} className="hidden" />
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-medium text-slate-300">
              Display name
            </label>
            <input
              id="profile-name"
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Your name"
              maxLength={50}
              required
              className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
            <p className="mt-2 text-xs text-slate-500">Letters, spaces, hyphens, and apostrophes only.</p>
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-medium text-slate-300">
              Email address
            </label>
            <input
              id="profile-email"
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full max-w-xl cursor-not-allowed rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">Email changes are managed from account security settings.</p>
          </div>

          {memberSince ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
              Member since <span className="font-medium text-slate-200">{memberSince}</span>
            </div>
          ) : null}
        </section>

        <div className="flex items-center gap-3 border-t border-white/10 pt-6">
          <button
            type="submit"
            disabled={saving || !profileForm.name.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProfileSettings;
