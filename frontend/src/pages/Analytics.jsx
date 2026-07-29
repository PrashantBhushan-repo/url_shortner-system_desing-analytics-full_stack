import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { getAccessToken } from "../services/urlApi";
import API from "../services/urlApi";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  Globe,
  Laptop,
  Smartphone,
  Eye,
  AlertCircle,
  Download,
  Activity,
  Clock,
  MousePointerClick,
  Compass
} from "lucide-react";

// Curated harmonious HSL/Hex color palette for charts
const COLORS = ["#3b82f6", "#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444"];

function Analytics() {
  const { urlId } = useParams();
  const navigate = useNavigate();
  const token = getAccessToken();

  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Data States
  const [urlInfo, setUrlInfo] = useState(null);
  const [overview, setOverview] = useState({ totalClicks: 0, uniqueClicks: 0, botClicks: 0, growth: { total: 0, unique: 0 } });
  const [timeseries, setTimeseries] = useState([]);
  const [geo, setGeo] = useState({ countries: [], cities: [] });
  const [devices, setDevices] = useState({ devices: [], browsers: [], platforms: [] });
  const [referrers, setReferrers] = useState({ referrers: [], siteLocations: [], sources: [] });
  
  // Real-time states
  const [liveTicks, setLiveTicks] = useState([]);
  const [liveClicks, setLiveClicks] = useState(0);

  // Fetch function
  const fetchAnalyticsData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const [infoRes, overviewRes, timeseriesRes, geoRes, devicesRes, referrersRes] = await Promise.all([
        API.get(`/urls/id/${urlId}`),
        API.get(`/analytics/${urlId}/overview?range=${range}`),
        API.get(`/analytics/${urlId}/timeseries?range=${range}`),
        API.get(`/analytics/${urlId}/geo?range=${range}`),
        API.get(`/analytics/${urlId}/devices?range=${range}`),
        API.get(`/analytics/${urlId}/referrers?range=${range}`)
      ]);

      setUrlInfo(infoRes.data?.data);
      setOverview(overviewRes.data?.data);
      if (overviewRes.data?.data?.liveClicks !== undefined) {
        setLiveClicks(overviewRes.data?.data.liveClicks);
      }
      if (overviewRes.data?.data?.recentClicks) {
        setLiveTicks(overviewRes.data?.data.recentClicks);
      }
      setTimeseries(timeseriesRes.data?.data || []);
      setGeo(geoRes.data?.data || { countries: [], cities: [] });
      setDevices(devicesRes.data?.data || { devices: [], browsers: [], platforms: [] });
      setReferrers(referrersRes.data?.data || { referrers: [], siteLocations: [], sources: [] });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to synchronise analytics statistics.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [urlId, range]);

  // Trigger load when range/ID changes
  useEffect(() => {
    if (urlId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAnalyticsData();
    }
  }, [urlId, range, fetchAnalyticsData]);

  // Set up WebSockets for real-time click tracking
  useEffect(() => {
    if (!urlId || !token) return;

    const socketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace("/api", "") 
      : "http://localhost:5000";

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("🔌 Connected to Analytics Websocket");
      socket.emit("join-url", urlId);
    });

    socket.on("click-tick", (data) => {
      // Add incoming tick to rolling list (limit to 10 items)
      setLiveTicks((prev) => [data, ...prev].slice(0, 10));
      // Increment live clicks ticker
      setLiveClicks((prev) => prev + 1);
      // Silently refresh analytics to keep charts and tables in sync without flashing spinners
      fetchAnalyticsData(true);
    });

    socket.on("connect_error", (err) => {
      console.error("Websocket Connection Error:", err.message);
    });

    return () => {
      socket.emit("leave-url", urlId);
      socket.disconnect();
    };
  }, [urlId, token, fetchAnalyticsData]);

  const handleExport = async () => {
    try {
      const response = await API.get(`/analytics/${urlId}/export?range=${range}`, {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `clicks-export-${urlId}-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("Failed to export clicks: " + (err.response?.data?.message || err.message));
    }
  };

  const renderPieChart = (title, icon, data, colorOffset = 0) => {
    const total = data ? data.reduce((sum, item) => sum + item.count, 0) : 0;

    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest flex items-center gap-2">
            {icon} {title}
          </h3>
          <span className="text-[10px] font-semibold text-slate-500 font-mono">{total} Total</span>
        </div>
        
        {!data || data.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-slate-500 text-xs">No {title.toLowerCase()} data available</div>
        ) : (
          <div className="h-44 w-full flex items-center justify-center text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="name"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + colorOffset) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px", color: "#fff" }} 
                  formatter={(value, name) => {
                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                    return [`${value} (${percentage}%)`, name];
                  }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: "9px" }} 
                  formatter={(value) => {
                    const item = data.find(d => d.name === value);
                    const count = item ? item.count : 0;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return `${value} (${percentage}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 md:px-8 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/dashboard")} 
              className="p-2.5 rounded-xl border border-white/10 bg-slate-900 hover:bg-slate-800 hover:text-white transition duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-blue-400 font-bold">Analytics Engine</span>
              <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">Link Performance Console</h1>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Range selection keys */}
            <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1 text-xs font-semibold">
              {[
                { id: "24h", label: "24 Hours" },
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                    range === r.id ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-400" /> Export CSV
            </button>
          </div>
        </div>

        {/* URL Target Quick Info Card */}
        {urlInfo && (
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="text-base font-bold text-blue-400 font-mono truncate">{urlInfo.shortUrl}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                  urlInfo.isAlive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${urlInfo.isAlive ? 'bg-emerald-400 bg-emerald-500' : 'bg-rose-400 bg-rose-500'}`} />
                  {urlInfo.isAlive ? 'Link Healthy' : 'Link Dead'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate font-mono">{urlInfo.longUrl}</p>
            </div>
            {urlInfo.lastCheckedAt && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start md:self-center">
                <Clock className="w-3.5 h-3.5" /> 
                Last Checked: {new Date(urlInfo.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-300">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Performance Cards (Total, Unique, Bots, Live) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <MousePointerClick className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Total Click Volume</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono">{overview.totalClicks}</span>
                {overview.growth.total !== 0 && (
                  <span className={`text-xs font-bold ${overview.growth.total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {overview.growth.total >= 0 ? "+" : ""}{overview.growth.total}%
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">vs previous {range === "24h" ? "24h" : range} period</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Eye className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Unique Visitors</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono">{overview.uniqueClicks}</span>
                {overview.growth.unique !== 0 && (
                  <span className={`text-xs font-bold ${overview.growth.unique >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {overview.growth.unique >= 0 ? "+" : ""}{overview.growth.unique}%
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Unique IP address sessions</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 space-y-3 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <AlertCircle className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Spam / Bot Hits</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono">{overview.botClicks}</span>
                <span className="text-xs text-slate-500 font-semibold">
                  ({overview.totalClicks > 0 ? Math.round((overview.botClicks / overview.totalClicks) * 100) : 0}% ratio)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">Filtered crawler & rate limit clicks</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-blue-500/30 rounded-3xl p-6 space-y-3 relative overflow-hidden shadow-lg shadow-blue-500/5">
            <div className="absolute top-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-500/30">
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Live Clicks (15m)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black font-mono text-blue-400">{liveClicks}</span>
              </div>
              <span className="text-[10px] text-blue-400 block mt-1 font-semibold animate-pulse">Real-time tracking active</span>
            </div>
          </div>

        </div>

        {/* Dashboard charts and details grid */}
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-24 text-center">
            <Activity className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading industrial analytics engine metrics...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column (8 cols): Primary charts */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Chart 1: Time Series graph (Line with Gradient Area) */}
              <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" /> Clicks Over Time
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">Bucket: {range === "24h" ? "Hourly" : "Daily"}</span>
                </div>
                
                {timeseries.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-slate-500 text-xs">No chart logs available for the chosen date range</div>
                ) : (
                  <div className="h-72 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorUniques" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                        <XAxis dataKey="label" stroke="#94a3b860" tickLine={false} />
                        <YAxis stroke="#94a3b860" tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #ffffff10", borderRadius: "12px", color: "#fff" }} 
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Area name="Total Clicks" type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClicks)" />
                        <Area name="Unique Clicks" type="monotone" dataKey="unique" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorUniques)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Location Detection (Country & City Lists, no graph) */}
              <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-4.5 h-4.5 text-emerald-400" /> Geography breakdown
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 font-mono">Location Ingestion</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Top Countries */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Countries</h4>
                    {!geo.countries || geo.countries.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-slate-500 text-xs bg-slate-950/20 border border-white/5 rounded-2xl">No country logs available</div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1 text-xs">
                        {(() => {
                          const totalCountryClicks = geo.countries.reduce((sum, c) => sum + c.count, 0);
                          return geo.countries.map((c, idx) => {
                            const percentage = totalCountryClicks > 0 ? Math.round((c.count / totalCountryClicks) * 100) : 0;
                            return (
                              <div key={idx} className="bg-slate-950/30 border border-white/5 p-3 rounded-2xl hover:border-emerald-500/20 transition duration-150">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                                    <span className="text-slate-500 font-mono">#{idx + 1}</span>
                                    {c.country || "Unknown Country"}
                                  </span>
                                  <span className="font-bold text-emerald-400">{c.count} clicks ({percentage}%)</span>
                                </div>
                                <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-2">
                                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Top Cities */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Cities</h4>
                    {!geo.cities || geo.cities.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-slate-500 text-xs bg-slate-950/20 border border-white/5 rounded-2xl">No city logs available</div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1 text-xs">
                        {(() => {
                          const totalCityClicks = geo.cities.reduce((sum, c) => sum + c.count, 0);
                          return geo.cities.map((c, idx) => {
                            const percentage = totalCityClicks > 0 ? Math.round((c.count / totalCityClicks) * 100) : 0;
                            return (
                              <div key={idx} className="bg-slate-950/30 border border-white/5 p-3 rounded-2xl hover:border-blue-500/20 transition duration-150">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                                    <span className="text-slate-500 font-mono">#{idx + 1}</span>
                                    {c.city || "Unknown City"}, {c.country || "Unknown"}
                                  </span>
                                  <span className="font-bold text-blue-400">{c.count} clicks ({percentage}%)</span>
                                </div>
                                <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-2">
                                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Referrers table */}
              <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Compass className="w-4 h-4 text-indigo-400" /> Traffic Referrers
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 font-mono font-bold">Referrer Sites</span>
                </div>
                
                {referrers.referrers.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-slate-500 text-xs bg-slate-950/20 border border-white/5 rounded-2xl">No referrer links detected</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {referrers.referrers.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-950/40 border border-white/5 p-3 rounded-2xl hover:border-indigo-500/20 transition duration-150">
                        <span className="font-mono text-slate-300 truncate max-w-[190px]">{r.host}</span>
                        <span className="font-bold text-indigo-300">{r.count} clicks</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clicks by Site & Country Table */}
              <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-400" /> Clicks by Site & Country
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500 font-mono">Referral Geo-Distribution</span>
                </div>
                
                {!referrers.siteLocations || referrers.siteLocations.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-slate-500 text-xs bg-slate-950/20 border border-white/5 rounded-2xl">No referral geo data available</div>
                ) : (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold">
                          <th className="py-2.5 px-3">Referrer Site</th>
                          <th className="py-2.5 px-3 text-center">Country</th>
                          <th className="py-2.5 px-3 text-right">Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrers.siteLocations.map((item, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-slate-950/20 transition duration-150">
                            <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {item.site}
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300 font-mono font-semibold">{item.country}</td>
                            <td className="py-3 px-3 text-right font-bold text-indigo-300">{item.count} clicks</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column (4 cols): Secondary charts & Live Activity */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Distinct Pie Charts */}
              {renderPieChart("Device Types", <Smartphone className="w-4 h-4 text-indigo-400" />, devices.devices, 0)}
              {renderPieChart("Browsers", <Compass className="w-4 h-4 text-blue-400" />, devices.browsers, 2)}
              {renderPieChart("Operating Systems", <Laptop className="w-4 h-4 text-purple-400" />, devices.platforms, 4)}

              {/* Live WebSocket click activity ticker */}
              <div className="bg-slate-900/60 border border-blue-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-blue-500" /> Live Click Ticker
                  </h3>
                  <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/25 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> LIVE STREAM
                  </span>
                </div>

                {liveTicks.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-2 py-4">
                    <Clock className="w-6 h-6 text-slate-700 animate-spin" />
                    <span>Waiting for redirects...</span>
                    <span className="text-[10px] text-slate-600">Clicks will register in real-time</span>
                  </div>
                ) : (
                  <div className="h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                    {liveTicks.map((tick, index) => (
                      <div 
                        key={index} 
                        className="bg-slate-950/60 border border-white/5 p-3 rounded-xl flex items-center justify-between animate-fade-in"
                      >
                        <div className="space-y-1">
                          <span className="font-bold text-white flex items-center gap-1">
                            <Globe className="w-3 h-3 text-emerald-400" /> {tick.country || "Unknown Country"}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 capitalize">
                            <Smartphone className="w-3 h-3 text-indigo-400" /> {tick.device || "desktop"} client
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(tick.timestamp).toLocaleTimeString([], { hour12: false })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default Analytics;
