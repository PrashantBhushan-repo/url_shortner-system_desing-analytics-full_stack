import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import UrlForm from "../components/url/UrlForm";
import API from "../services/urlApi";

const RECENT_LINKS_STORAGE_KEY = "snapurl_recent_links";

const normalizeLink = (item) => ({
  ...item,
  shortCode: item.shortCode || item.short_code || item.id,
  shortUrl: item.shortUrl || item.short_url || "",
  longUrl: item.longUrl || item.long_url || "",
  customAlias: item.customAlias || item.custom_alias || null,
  createdAt: item.createdAt || item.created_at || new Date().toISOString(),
});

const mergeLinks = (serverLinks = [], localLinks = []) => {
  const merged = new Map();

  [...localLinks, ...serverLinks].forEach((item) => {
    const link = normalizeLink(item);
    if (!link.shortCode) return;

    if (!merged.has(link.shortCode)) {
      merged.set(link.shortCode, link);
      return;
    }

    const existing = merged.get(link.shortCode);
    merged.set(link.shortCode, {
      ...existing,
      ...link,
      shortUrl: link.shortUrl || existing.shortUrl,
      longUrl: link.longUrl || existing.longUrl,
      customAlias: link.customAlias ?? existing.customAlias,
      createdAt: link.createdAt || existing.createdAt,
    });
  });

  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedLinks = window.localStorage.getItem(RECENT_LINKS_STORAGE_KEY);
      if (savedLinks) {
        const parsed = JSON.parse(savedLinks);
        if (Array.isArray(parsed)) {
          setUrls(mergeLinks(parsed));
        }
      }
    } catch {
      window.localStorage.removeItem(RECENT_LINKS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (urls.length) {
      window.localStorage.setItem(RECENT_LINKS_STORAGE_KEY, JSON.stringify(urls));
    } else {
      window.localStorage.removeItem(RECENT_LINKS_STORAGE_KEY);
    }
  }, [urls]);

  useEffect(() => {
    const loadUrls = async () => {
      try {
        setLoading(true);
        const response = await API.get("/urls/me");
        const serverLinks = Array.isArray(response.data?.data) ? response.data.data : [];
        setUrls((prevLinks) => mergeLinks(serverLinks, prevLinks));
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load your links.");
      } finally {
        setLoading(false);
      }
    };

    loadUrls();
  }, []);

  const handleLinkCreated = (createdLink) => {
    const normalizedLink = normalizeLink(createdLink);
    setUrls((prevLinks) => mergeLinks([normalizedLink], prevLinks));
  };

  const handleLinkUpdated = (updatedLink) => {
    const normalizedLink = normalizeLink(updatedLink);
    setUrls((prevLinks) => mergeLinks([normalizedLink], prevLinks));
  };

  const handleLinkDeleted = (shortCode) => {
    setUrls((prevLinks) => prevLinks.filter((link) => link.shortCode !== shortCode));
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-900/80 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-blue-300">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">Welcome, {user?.name || "there"}</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/settings")} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Settings</button>
            <button onClick={logout} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Logout</button>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-slate-800/70 p-6">
          <p className="text-sm text-slate-400">Your account is connected to the backend auth and URL systems.</p>
          <p className="mt-2 text-sm text-slate-300">Email: {user?.email || "—"}</p>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-slate-800/70 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Create a short link</h2>
            <p className="mt-1 text-sm text-slate-400">Generate a new short URL and optionally add a custom alias.</p>
          </div>
          <UrlForm onLinkCreated={handleLinkCreated} onLinkUpdated={handleLinkUpdated} onLinkDeleted={handleLinkDeleted} />
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your links</h2>
            <span className="text-sm text-slate-400">{urls.length} total</span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/70 p-6 text-sm text-slate-400">Loading your links…</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">{error}</div>
          ) : urls.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-800/70 p-6 text-sm text-slate-400">No links yet. Create one above to get started.</div>
          ) : (
            <div className="space-y-3">
              {urls.map((item) => (
                <div key={item.shortCode} className="rounded-xl border border-white/10 bg-slate-800/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{item.shortUrl}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.longUrl}</p>
                    </div>
                    <div className="text-sm text-slate-400">
                      <span className="rounded-full border border-white/10 px-2 py-1">{item.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
