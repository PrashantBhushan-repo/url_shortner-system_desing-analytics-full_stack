import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import API from "../../services/urlApi";
import { useAuth } from "../../context/AuthContext";
import QRCustomizer from "./QRCustomizer";

function UrlForm({ onLinkCreated, onLinkUpdated, onLinkDeleted }) {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generateQr, setGenerateQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLongUrl, setEditLongUrl] = useState("");
  const [editCustomAlias, setEditCustomAlias] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { token } = useAuth();

  const handleShorten = async (e) => {
    e.preventDefault();

    if (!longUrl.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    if (!token) {
      setShowAuthModal(true);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setCopied(false);
      setEditError("");
      setEditSuccess("");

      const response = await API.post("/urls", {
        long_url: longUrl.trim(),
        custom_alias: customAlias.trim() || undefined,
      });

      const createdUrl = response.data.data;
      setShortCode(createdUrl.shortCode);
      setShortUrl(createdUrl.shortUrl);
      setEditLongUrl(createdUrl.longUrl || "");
      setEditCustomAlias(createdUrl.customAlias || "");
      setEditExpiresAt(createdUrl.expiresAt ? createdUrl.expiresAt.slice(0, 16) : "");
      setIsEditing(false);
      setLongUrl("");
      setCustomAlias("");

      if (generateQr) {
        generateQrCode(createdUrl.shortUrl);
      }

      onLinkCreated?.(createdUrl);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Something went wrong";
      const details = err?.response?.data?.details;

      if (status === 429) {
        setError("Rate limit exceeded. Free tier allows 5 URLs per day — try again tomorrow.");
      } else if (status === 409) {
        setError("That custom alias is already taken. Please choose another.");
      } else if (status === 400 && Array.isArray(details)) {
        setError(details.map((d) => d.message).join(". "));
      } else if (status === 400) {
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!shortCode) {
      setEditError("Create a short link first.");
      return;
    }

    const payload = {};

    if (editLongUrl.trim()) {
      payload.longUrl = editLongUrl.trim();
    }

    if (editCustomAlias.trim()) {
      payload.customAlias = editCustomAlias.trim();
    }

    if (editExpiresAt) {
      payload.expiresAt = new Date(editExpiresAt).toISOString();
    } else {
      payload.expiresAt = null;
    }

    try {
      setEditLoading(true);
      setEditError("");
      setEditSuccess("");

      const response = await API.patch(`/urls/${shortCode}`, payload);
      const updatedUrl = response.data.data;

      setShortUrl(updatedUrl.shortUrl);
      setEditLongUrl(updatedUrl.longUrl || "");
      setEditCustomAlias(updatedUrl.customAlias || "");
      setEditExpiresAt(updatedUrl.expiresAt ? updatedUrl.expiresAt.slice(0, 16) : "");
      setEditSuccess("Short link updated successfully.");
      setIsEditing(false);
      onLinkUpdated?.(updatedUrl);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || "Unable to update the short link.";
      const details = err?.response?.data?.details;

      if (status === 409) {
        setEditError("That custom alias is already taken. Please choose another.");
      } else if (status === 400 && Array.isArray(details)) {
        setEditError(details.map((d) => d.message).join(". "));
      } else if (status === 400) {
        setEditError(message);
      } else {
        setEditError(message);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shortCode) {
      return;
    }

    try {
      setDeleteLoading(true);
      setEditError("");
      setEditSuccess("");
      await API.delete(`/urls/${shortCode}`);

      const codeToDelete = shortCode;
      setShortUrl("");
      setShortCode("");
      setEditLongUrl("");
      setEditCustomAlias("");
      setEditExpiresAt("");
      setIsEditing(false);
      setEditSuccess("Short link deactivated successfully.");
      onLinkDeleted?.(codeToDelete);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to deactivate the short link.";
      setEditError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQrCode = async (url) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code", err);
    }
  };

  useEffect(() => {
    if (generateQr && shortUrl) {
      generateQrCode(shortUrl);
    } else {
      setQrDataUrl("");
    }
  }, [generateQr, shortUrl]);

  return (
    <section className="px-4 pb-16">
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-slate-900/80 p-6 md:p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.15)] backdrop-blur-md relative overflow-hidden">
        
        <form onSubmit={handleShorten} className="space-y-4">
          <div>
            <label htmlFor="longUrl" className="block text-sm font-semibold text-slate-300 mb-1.5">
              Long URL
            </label>
            <input
              id="longUrl"
              type="url"
              placeholder="https://example.com/very-long-url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label htmlFor="customAlias" className="block text-sm font-semibold text-slate-300 mb-1.5">
              Custom alias <span className="text-slate-400 font-normal">(optional, 3–10 characters)</span>
            </label>
            <input
              id="customAlias"
              type="text"
              placeholder="mylink"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              pattern="[a-zA-Z0-9]{3,10}"
              title="Letters and numbers only, 3 to 10 characters"
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateQr}
                onChange={(e) => setGenerateQr(e.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              Generate QR code for the short URL
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Generating..." : "Shorten URL"}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
              <line x1="12" y1="12" x2="12" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {shortUrl && (
          <div className="mt-6 bg-slate-950/60 rounded-xl p-4 border border-white/5">
            <h3 className="font-semibold text-slate-200 mb-3">Your short link</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={shortUrl}
                readOnly
                aria-label="Generated short URL"
                className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-3 text-sm text-white"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition text-sm font-medium cursor-pointer"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 text-white px-4 py-3 rounded-lg text-center hover:bg-slate-700 transition text-sm font-medium"
              >
                Visit
              </a>
            </div>

            {generateQr && (
              <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <h4 className="text-sm font-semibold text-slate-200">Short URL QR code</h4>
                {qrDataUrl ? (
                  <div className="mt-3 flex flex-col items-center gap-3">
                    <img src={qrDataUrl} alt="Short URL QR code" className="h-52 w-52 rounded-xl border border-white/10 bg-white p-2" />
                    <div className="flex gap-2">
                      <a
                        href={qrDataUrl}
                        download="short-url-qr.png"
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition"
                      >
                        Download QR
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowCustomizer(true)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition cursor-pointer"
                      >
                        Customize QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Generating QR code…</p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing((value) => !value);
                  setEditError("");
                  setEditSuccess("");
                }}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition cursor-pointer"
              >
                {isEditing ? "Cancel edit" : "Edit link"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading ? "Deactivating..." : "Delete link"}
              </button>
            </div>

            {isEditing && (
              <form onSubmit={handleUpdate} className="mt-4 space-y-3 border-t border-white/5 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Updated long URL</label>
                  <input
                    type="url"
                    value={editLongUrl}
                    onChange={(e) => setEditLongUrl(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Updated custom alias</label>
                  <input
                    type="text"
                    value={editCustomAlias}
                    onChange={(e) => setEditCustomAlias(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                    placeholder="Leave blank to keep current alias"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Expiry date</label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 p-3 text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    {editLoading ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}

            {editError && (
              <div className="mt-3 bg-rose-500/10 text-rose-300 border border-rose-500/20 p-3 rounded-lg text-sm">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mt-3 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 p-3 rounded-lg text-sm">
                {editSuccess}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] transition-all duration-300">
            
            {/* Close button */}
            <div className="relative flex flex-col items-center text-center pb-4 border-b border-white/5">
              <button 
                onClick={() => setShowAuthModal(false)} 
                className="absolute top-0 right-0 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200 cursor-pointer"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              {/* Lock Icon */}
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-8 ring-blue-500/5 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>

              <p className="text-xs uppercase tracking-[0.25em] text-blue-400 font-semibold">Authentication Required</p>
              <h2 className="mt-1 text-xl font-bold text-white">Sign In to Shorten URL</h2>
              <p className="mt-1.5 text-xs text-slate-400 max-w-[280px]">
                You need to be logged in to shorten long URLs and customize your link analytics.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Link 
                to="/auth?mode=login" 
                className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/35 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                Sign In
              </Link>
              <Link 
                to="/auth?mode=register" 
                className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition duration-200 cursor-pointer"
              >
                Create an Account (Sign Up)
              </Link>
            </div>
          </div>
        </div>
      )}
      {showCustomizer && <QRCustomizer url={shortUrl} onClose={() => setShowCustomizer(false)} />}
    </section>
  );
}

export default UrlForm;
