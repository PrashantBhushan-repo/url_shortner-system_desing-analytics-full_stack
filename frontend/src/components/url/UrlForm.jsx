import { useState } from "react";
import API from "../../services/urlApi";

function UrlForm() {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLongUrl, setEditLongUrl] = useState("");
  const [editCustomAlias, setEditCustomAlias] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleShorten = async (e) => {
    e.preventDefault();

    if (!longUrl.trim()) {
      setError("Please enter a valid URL");
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

      setShortUrl("");
      setShortCode("");
      setEditLongUrl("");
      setEditCustomAlias("");
      setEditExpiresAt("");
      setIsEditing(false);
      setEditSuccess("Short link deactivated successfully.");
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

  return (
    <section className="px-4 pb-16">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <form onSubmit={handleShorten} className="space-y-4">
          <div>
            <label htmlFor="longUrl" className="block text-sm font-medium text-slate-700 mb-1">
              Long URL
            </label>
            <input
              id="longUrl"
              type="url"
              placeholder="https://example.com/very-long-url"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="customAlias" className="block text-sm font-medium text-slate-700 mb-1">
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
              className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Generating..." : "Shorten URL"}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4 bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {shortUrl && (
          <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-3">Your short link</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={shortUrl}
                readOnly
                aria-label="Generated short URL"
                className="flex-1 bg-white border border-slate-300 rounded-lg p-3 text-sm"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition text-sm font-medium"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 text-white px-4 py-3 rounded-lg text-center hover:bg-slate-900 transition text-sm font-medium"
              >
                Visit
              </a>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing((value) => !value);
                  setEditError("");
                  setEditSuccess("");
                }}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
              >
                {isEditing ? "Cancel edit" : "Edit link"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleteLoading ? "Deactivating..." : "Delete link"}
              </button>
            </div>

            {isEditing && (
              <form onSubmit={handleUpdate} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Updated long URL</label>
                  <input
                    type="url"
                    value={editLongUrl}
                    onChange={(e) => setEditLongUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Updated custom alias</label>
                  <input
                    type="text"
                    value={editCustomAlias}
                    onChange={(e) => setEditCustomAlias(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to keep current alias"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry date</label>
                  <input
                    type="datetime-local"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {editLoading ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}

            {editError && (
              <div className="mt-3 bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="mt-3 bg-green-50 text-green-700 border border-green-200 p-3 rounded-lg text-sm">
                {editSuccess}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default UrlForm;
