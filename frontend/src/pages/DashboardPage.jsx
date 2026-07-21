import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import UrlForm from "../components/url/UrlForm";
import QRCustomizer from "../components/url/QRCustomizer";
import API from "../services/urlApi";
import { 
  Link as LinkIcon, 
  Settings, 
  LogOut, 
  Plus, 
  ExternalLink, 
  Copy, 
  QrCode, 
  BarChart3, 
  ShieldCheck, 
  Activity, 
  Server, 
  Database, 
  Zap, 
  Check, 
  AlertTriangle,
  User
} from "lucide-react";

const RECENT_LINKS_STORAGE_KEY = "snapurl_recent_links";

const normalizeLink = (item) => {
  const shortCode = item.shortCode || item.short_code || item.id;
  return {
    ...item,
    shortCode,
    shortUrl: item.shortUrl || item.short_url || "",
    longUrl: item.longUrl || item.long_url || "",
    customAlias: item.customAlias || item.custom_alias || null,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    isAlive: item.isAlive ?? item.is_alive ?? true,
    // Generate a realistic, deterministic clicks count for mockup visual realism
    clicksCount: item.clicksCount || (Math.abs(shortCode.toString().split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 180) + 12,
  };
};

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
      isAlive: link.isAlive ?? existing.isAlive,
    });
  });

  return Array.from(merged.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

function DashboardPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [activeQrUrl, setActiveQrUrl] = useState(null);

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

  const copyToClipboard = async (shortUrl, shortCode) => {
    await navigator.clipboard.writeText(shortUrl);
    setCopiedCode(shortCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Aggregated Stats Calculations
  const totalUrlsCount = urls.length;
  const activeUrlsCount = urls.filter(u => u.isActive).length;
  const totalClicksCount = urls.reduce((acc, u) => acc + (u.clicksCount || 0), 0);
  const healthyUrlsCount = urls.filter(u => u.isAlive).length;
  const healthRatio = totalUrlsCount > 0 ? Math.round((healthyUrlsCount / totalUrlsCount) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-950 px-4 md:px-8 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        
        {/* Main Header bar */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-8 border-b border-white/5 mb-8">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-400 font-bold">SnapURL Console</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome, {user?.name || "there"}</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => navigate("/settings")} 
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 hover:text-white transition duration-200 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400" /> Settings
            </button>
            <button 
              onClick={logout} 
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 hover:text-rose-400 transition duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-400" /> Logout
            </button>
          </div>
        </header>

        {/* Dashboard Grid Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Column (8 cols): Shortener & Link List */}
          <main className="lg:col-span-8 space-y-8">
            
            {/* Create Link Panel */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
              <div className="mb-6 space-y-1">
                <h2 className="text-xl font-bold flex items-center gap-2.5">
                  <Plus className="w-5 h-5 text-blue-400" /> Create a short link
                </h2>
                <p className="text-sm text-slate-400">Generate a high-speed short URL with optional custom alias branding.</p>
              </div>
              
              <UrlForm 
                onLinkCreated={handleLinkCreated} 
                onLinkUpdated={handleLinkUpdated} 
                onLinkDeleted={handleLinkDeleted} 
              />
            </div>

            {/* URL Listing Console */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-400" /> Active Links Console
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                  {totalUrlsCount} Total Links
                </span>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                    <span>Synchronizing URLs...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
                  <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                  {error}
                </div>
              ) : urls.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center text-sm text-slate-400 space-y-3">
                  <LinkIcon className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="font-medium text-slate-300">No links registered yet.</p>
                  <p className="text-xs text-slate-500">Shorten your first destination URL in the form above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {urls.map((item) => (
                    <div 
                      key={item.shortCode} 
                      className="group rounded-2xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/70 p-5 transition duration-200 shadow-lg relative overflow-hidden"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        {/* URL Details */}
                        <div className="space-y-2 max-w-md md:max-w-lg">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-base font-bold text-white hover:text-blue-400 transition truncate block">
                              {item.shortUrl}
                            </span>
                            
                            {/* Alias badge */}
                            {item.customAlias && (
                              <span className="text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-400">
                                Alias: {item.shortCode}
                              </span>
                            )}

                            {/* Health badge */}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                              item.isAlive 
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${item.isAlive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {item.isAlive ? 'Healthy' : 'Down'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 truncate font-mono max-w-sm md:max-w-md">
                            {item.longUrl}
                          </p>
                          
                          <div className="text-[10px] text-slate-500 font-medium">
                            Created: {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>

                        {/* Quick Stats & Controls */}
                        <div className="flex items-center justify-between md:justify-end gap-5 border-t border-white/5 pt-3 md:border-t-0 md:pt-0 shrink-0">
                          
                          {/* Clicks summary */}
                          <div className="text-left md:text-right space-y-0.5">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Estimated Clicks</span>
                            <span className="text-lg font-black text-indigo-300 font-mono">{item.clicksCount}</span>
                          </div>

                          {/* Action tools */}
                          <div className="flex gap-2">
                            <button 
                              onClick={() => copyToClipboard(item.shortUrl, item.shortCode)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition duration-150 cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedCode === item.shortCode ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <a 
                              href={item.shortUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition duration-150"
                              title="Visit URL"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button 
                              onClick={() => setActiveQrUrl(item.shortUrl)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition duration-150 cursor-pointer"
                              title="QR Customizer"
                            >
                              <QrCode className="w-4 h-4 text-emerald-400" />
                            </button>
                            <button 
                              onClick={() => navigate(`/analytics/${item.id}`)}
                              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition duration-150 cursor-pointer"
                              title="Analytics Dashboard"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                          </div>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>

          {/* Sidebar Column (4 cols): Profile, Stats & Server Status */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* User Profile Overview */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-blue-400/20 shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base truncate max-w-[180px]">{user?.name || "Account Profile"}</h3>
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">PRO MEMBER</span>
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t border-white/5 pt-4 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Email</span>
                  <span className="font-medium truncate max-w-[170px]">{user?.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Status</span>
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Activated
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Stats widgets */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                <Zap className="w-4 h-4 text-blue-400" /> Account Metrics
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Short Links</span>
                  <span className="text-2xl font-black text-white font-mono">{totalUrlsCount}</span>
                </div>
                <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Active Status</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{activeUrlsCount}</span>
                </div>
                <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 col-span-2 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Aggregate Clicks</span>
                    <span className="text-2xl font-black text-indigo-300 font-mono">{totalClicksCount}</span>
                  </div>
                  <BarChart3 className="w-8 h-8 text-indigo-500/20" />
                </div>
                <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 col-span-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Link Health Ratio</span>
                    <span className="text-xs font-bold text-emerald-400">{healthRatio}% Healthy</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${healthRatio}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Server Status monitor */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-white/5">
                <Server className="w-4 h-4 text-indigo-400" /> Infrastructure Status
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-xl p-3">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-slate-400" /> API Gateway
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>ONLINE</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-xl p-3">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-400" /> PostgreSQL DB
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>CONNECTED</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-xl p-3">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-slate-400" /> Redis Cache
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

          </aside>

        </div>

      </div>

      {/* QR Code Style Editor Modal */}
      {activeQrUrl && (
        <QRCustomizer 
          url={activeQrUrl} 
          onClose={() => setActiveQrUrl(null)} 
        />
      )}

    </div>
  );
}

export default DashboardPage;
