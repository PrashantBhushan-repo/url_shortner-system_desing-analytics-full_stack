import { useState } from "react";
import API from "../../services/urlApi";

function UrlForm() {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
      setShortUrl("");

      const response = await API.post("/urls", {
        long_url: longUrl.trim(),
        custom_alias: customAlias.trim() || undefined,
      });

      setShortUrl(response.data.data.shortUrl);
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
          </div>
        )}
      </div>
    </section>
  );
}

export default UrlForm;
