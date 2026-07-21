import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import API from "../../services/urlApi";
import { useAuth } from "../../context/AuthContext";
import QRCustomizer from "./QRCustomizer";
import { 
  Copy, 
  ExternalLink, 
  Check, 
  Sparkles, 
  QrCode, 
  Download, 
  Sliders, 
  Edit3, 
  Trash2, 
  Clock, 
  Calendar,
  AlertCircle
} from "lucide-react";

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
    if (editLongUrl.trim()) payload.longUrl = editLongUrl.trim();
    if (editCustomAlias.trim()) payload.customAlias = editCustomAlias.trim();
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

  const generateQrCode = async (text) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code:", err.message);
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
    <div className="w-full">
      {/* Shortener input form */}
      <form onSubmit={handleShorten} className="space-y-5">
        
        {/* Row 1: Long URL and custom alias aligned grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          <div className="md:col-span-9">
            <label htmlFor="longUrl" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Destination URL
            </label>
            <input
              id="longUrl"
              type="url"
              placeholder="https://example.com/very-long-landing-page-url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="customAlias" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Alias <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="customAlias"
              type="text"
              placeholder="mylink"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              pattern="[a-zA-Z0-9]{3,10}"
              title="Letters and numbers only, 3 to 10 characters"
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

        </div>

        {/* Row 2: Checkbox on left, Button on right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          
          <label className="flex items-center gap-3 cursor-pointer group text-sm text-slate-300">
            <input
              type="checkbox"
              checked={generateQr}
              onChange={(e) => setGenerateQr(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-white/10 bg-slate-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
            />
            <span className="group-hover:text-white transition duration-200">Automatically generate styling-ready QR Code</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer text-center"
          >
            {loading ? "Generating..." : "Shorten URL"}
          </button>

        </div>
      </form>

      {/* Error alert wrapper */}
      {error && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Output short URL details container (widescreen grid) */}
      {shortUrl && (
        <div className="mt-8 bg-slate-950/50 border border-white/5 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Short link string, action buttons, and edits (7 cols) */}
          <div className="md:col-span-7 space-y-6">
            
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Your Short URL is active
              </span>
              
              {/* URL Display and Action group */}
              <div className="flex gap-2">
                <input
                  value={shortUrl}
                  readOnly
                  aria-label="Generated short URL"
                  className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-indigo-300 font-mono font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl transition duration-200 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-3 rounded-xl transition duration-200 text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Visit
                </a>
              </div>
            </div>

            {/* Quick Metadata summary */}
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-400 shrink-0">Long URL Target:</span>
                <span className="truncate font-mono text-slate-300">{editLongUrl}</span>
              </div>
              
              {editExpiresAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-400 shrink-0">Expires:</span>
                  <span className="text-slate-300 font-medium">
                    {new Date(editExpiresAt).toLocaleDateString([], { dateStyle: "medium" })}
                  </span>
                </div>
              )}
            </div>

            {/* Link Custom Action panel */}
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing((value) => !value);
                    setEditError("");
                    setEditSuccess("");
                  }}
                  className="flex items-center gap-2 bg-slate-900 border border-white/10 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  {isEditing ? "Cancel editing" : "Edit target settings"}
                </button>
                
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-rose-500/25 transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleteLoading ? "Deactivating..." : "Deactivate short code"}
                </button>
              </div>

              {/* Edit forms */}
              {isEditing && (
                <form onSubmit={handleUpdate} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Update destination URL</label>
                    <input
                      type="url"
                      value={editLongUrl}
                      onChange={(e) => setEditLongUrl(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Update custom alias</label>
                    <input
                      type="text"
                      value={editCustomAlias}
                      onChange={(e) => setEditCustomAlias(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                      placeholder="No custom alias set"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Update Expiry Date</label>
                    <input
                      type="datetime-local"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={editLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition cursor-pointer"
                  >
                    {editLoading ? "Saving..." : "Save changes"}
                  </button>
                </form>
              )}

              {/* Status reports */}
              {editError && (
                <div className="bg-rose-500/10 text-rose-300 border border-rose-500/20 p-3 rounded-xl text-xs">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 p-3 rounded-xl text-xs">
                  {editSuccess}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: QR Code visual center (5 cols) */}
          <div className="md:col-span-5 bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col items-center justify-between gap-4 self-stretch">
            
            {/* Visual Header */}
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block w-full text-left">Link QR Code</span>
            
            {/* QR block content */}
            {generateQr && qrDataUrl ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="bg-white p-3.5 rounded-2xl border border-white/10 shadow-lg">
                  <img src={qrDataUrl} alt="Short URL QR code" className="h-44 w-44 object-contain" />
                </div>
                <div className="flex gap-2 w-full">
                  <a
                    href={qrDataUrl}
                    download="short-url-qr.png"
                    className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1.5 border border-white/5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowCustomizer(true)}
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-white" /> Customize QR
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 px-4 space-y-3">
                <QrCode className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-300">No QR Code generated yet</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tick the checkbox above during shorten or hit compile to make styling custom QR graphics.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setGenerateQr(true);
                    generateQrCode(shortUrl);
                  }}
                  className="rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  Generate Now
                </button>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] transition-all duration-300">
            
            <div className="relative flex flex-col items-center text-center pb-4 border-b border-white/5">
              <button 
                onClick={() => setShowAuthModal(false)} 
                className="absolute top-0 right-0 rounded-full p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-200 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-8 ring-blue-500/5 mb-3">
                <Sliders className="w-6 h-6 text-blue-400" />
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

      {/* QR Styles Modal mount */}
      {showCustomizer && (
        <QRCustomizer 
          url={shortUrl} 
          onClose={() => setShowCustomizer(false)} 
        />
      )}

    </div>
  );
}

export default UrlForm;
