import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/url/Navbar";
import UrlForm from "../components/url/UrlForm";
import Footer from "../components/url/Footer";
import API from "../services/urlApi";
import { useAuth } from "../context/AuthContext";
import { 
  Activity, 
  Cpu, 
  Shield, 
  Database, 
  Clock, 
  ArrowRight, 
  CheckCircle, 
  Terminal,
  Layers,
  Sparkles,
  Server,
  Play,
  Pause,
  Globe,
  Lock,
  QrCode,
  ListPlus,
  Key,
  BarChart3,
  CreditCard,
  Zap
} from "lucide-react";

function Home() {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalUrls: 0,
    activeUrls: 0,
    totalClicks: 0,
    uniqueClicks: 0,
    qrScans: 0,
    dbStatus: "ONLINE",
    redisStatus: "ONLINE",
    dbLatencyMs: 1.2,
    redisLatencyMs: 0.8,
    meanLatencyMs: 1.2,
    topCountries: [],
    topReferrers: [],
    devices: [],
    plans: [],
  });

  // Simulation states
  const [simStep, setSimStep] = useState(1);
  const [typedUrl, setTypedUrl] = useState("");

  // Fetch live real platform stats from the backend
  const fetchStats = async () => {
    try {
      const res = await API.get("/urls/public-stats");
      if (res.data?.success && res.data?.data) {
        setStats((prev) => ({
          ...prev,
          ...res.data.data,
          devices: Array.isArray(res.data.data.devices) ? res.data.data.devices : prev.devices || [],
          topCountries: Array.isArray(res.data.data.topCountries) ? res.data.data.topCountries : prev.topCountries || [],
          topReferrers: Array.isArray(res.data.data.topReferrers) ? res.data.data.topReferrers : prev.topReferrers || [],
        }));
      }
    } catch (err) {
      console.error("Failed to fetch public stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 10000); // Live poll every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const [copyStatus, setCopyStatus] = useState("Copy");
  const [qrColor, setQrColor] = useState("#00F0FF");
  const [isPaused, setIsPaused] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simCardName, setSimCardName] = useState("");

  // Manage stepper loop based on progress increments (allows hover to freeze progress)
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 50; // Update progress every 50ms
    const stepDurations = {
      1: 7500, // Shorten URL (types target URL, shows alias, cycles QR)
      2: 5000, // Copy & Redirect Link
      3: 5000, // Live Analytics View
      4: 7500, // Upgrade & Secure Payment Checkout
    };

    const currentDuration = stepDurations[simStep] || 5000;
    const increment = (intervalTime / currentDuration) * 100;

    const timer = setInterval(() => {
      setSimProgress((prev) => {
        if (prev + increment >= 100) {
          setSimStep((curr) => (curr === 4 ? 1 : curr + 1));
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [simStep, isPaused]);

  // Handle side-effects on active step change
  useEffect(() => {
    setSimProgress(0); // Reset progress bar

    if (simStep === 1) {
      const targetUrl = "https://github.com/PrashantBhushan/url_shortner/issues/4321";
      let index = 0;
      setTypedUrl("");
      setCopyStatus("Copy");
      
      const typing = setInterval(() => {
        if (isPaused) return;
        if (index < targetUrl.length) {
          setTypedUrl(targetUrl.slice(0, index + 1));
          index++;
        } else {
          clearInterval(typing);
        }
      }, 55);

      const colors = ["#00F0FF", "#8B5CF6", "#EC4899"];
      let cIndex = 0;
      const colorCycle = setInterval(() => {
        if (isPaused) return;
        setQrColor(colors[cIndex % colors.length]);
        cIndex++;
      }, 1500);

      return () => {
        clearInterval(typing);
        clearInterval(colorCycle);
      };
    } else if (simStep === 2) {
      setCopyStatus("Copy");
      const copyTimer = setTimeout(() => {
        setCopyStatus("Copied!");
      }, 1500);

      return () => clearTimeout(copyTimer);
    } else if (simStep === 3) {
      // Step 3 live analytics view
    } else if (simStep === 4) {
      const cardName = "PRASHANT BHUSHAN";
      let index = 0;
      setSimCardName("");
      const typing = setInterval(() => {
        if (isPaused) return;
        if (index < cardName.length) {
          setSimCardName(cardName.slice(0, index + 1));
          index++;
        } else {
          clearInterval(typing);
        }
      }, 130);

      return () => clearInterval(typing);
    }
  }, [simStep, isPaused]);

  return (
    <div className="min-h-screen bg-black flex flex-col text-slate-100 antialiased selection:bg-cyan-500 selection:text-black font-sans relative overflow-hidden">
      
      {/* High-tech Cyber Grid Backdrops */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-60" />
      
      {/* Futuristic Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00F0FF]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[45%] h-[45%] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      <Navbar />

      <main className="flex-1 relative z-10">
        
        {/* Real-time Status Banner */}
        <div className="border-b border-[#1b1e25] bg-black/40 backdrop-blur-md py-2.5">
          <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-wrap justify-between items-center gap-2 text-[10px] font-mono tracking-wider text-slate-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF87] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF87]"></span>
              </span>
              <span className="uppercase text-slate-300">CORE REDIRECT ENGINE: <span className="text-[#00FF87] font-bold">99.999% OPERATIONAL</span></span>
            </div>
            <div className="flex items-center gap-6">
              <span className="hidden sm:inline">DATABASE: <span className="text-emerald-400 font-bold">{stats.dbStatus}</span></span>
              <span className="hidden sm:inline">CACHE (REDIS): <span className="text-[#00F0FF] font-bold">{stats.redisStatus}</span></span>
              <span className="hidden sm:inline">MEAN LATENCY: <span className="text-[#00F0FF] font-bold">{stats.meanLatencyMs || 1.2}ms</span></span>
              <span>LINKS CREATED: <span className="text-indigo-400 font-bold">{stats.totalUrls} ACTIVE</span></span>
              <span>REDIRECTS ROUTED: <span className="text-amber-400 font-bold">{stats.totalClicks} CAPTURED</span></span>
            </div>
          </div>
        </div>

        {/* Hero Area */}
        <section className="pt-16 pb-16 md:pt-24 md:pb-24">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
            
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/20 text-[#00F0FF] text-[10px] font-mono uppercase tracking-widest animate-pulse">
                <Terminal className="w-3.5 h-3.5" />
                <span>PBURLS TELEMETRY PLATFORM ACTIVE</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-none">
              Shorten links.<br />
              <span className="bg-gradient-to-r from-[#00F0FF] via-indigo-400 to-indigo-600 bg-clip-text text-transparent">Scale Redirect Performance.</span>
            </h1>

            <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-sans font-normal">
              An industrial-grade link manager designed for high throughput. Featuring asynchronous ingestion queues via BullMQ, real-time WebSocket metrics, and custom QR generation vector suites.
            </p>

            {/* Quick Stats Dashboard Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto bg-zinc-950/90 border border-zinc-800 p-4.5 rounded-2xl font-mono text-left shadow-lg">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Redirects Routed</div>
                <div className="text-lg md:text-xl font-black text-white mt-0.5">{stats.totalClicks.toLocaleString()}</div>
              </div>
              <div className="border-l border-zinc-800 pl-4">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Links Shortened</div>
                <div className="text-lg md:text-xl font-black text-[#00FF87] mt-0.5">{stats.totalUrls.toLocaleString()}</div>
              </div>
              <div className="border-l border-zinc-800 pl-4">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Unique Visitors</div>
                <div className="text-lg md:text-xl font-black text-[#00F0FF] mt-0.5">{stats.uniqueClicks.toLocaleString()}</div>
              </div>
              <div className="border-l border-zinc-800 pl-4 font-mono">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Engine Status</div>
                <div className="text-lg md:text-xl font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-400" /> SECURE
                </div>
              </div>
            </div>

            {/* Shortener Console Form */}
            <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950/95 p-6 md:p-8 shadow-2xl relative">
              <div className="absolute top-3.5 left-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>
              <div className="absolute top-3 right-4 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">INPUT CONSOLE v1.0.4</div>
              
              <div className="mt-4">
                <UrlForm onLinkCreated={fetchStats} onLinkUpdated={fetchStats} onLinkDeleted={fetchStats} />
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Ingestion Simulator (Netflix-Style Visual Explainer Video) */}
        <section className="border-t border-zinc-800 bg-black py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(99,102,241,0.05),transparent_50%)] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-12">
            
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.25em] text-[#FF0055] uppercase bg-[#FF0055]/5 border border-[#FF0055]/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF0055] animate-ping" />
                <span>Interactive Video Tour (Hover to Pause)</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight text-white uppercase">
                <span className="normal-case tracking-tighter inline-block mr-2 text-white">
                  pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
                </span>
                <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Important Features Demo
                </span>
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed font-sans">The animation runs automatically. Hover over the console screen below to pause and inspect any step details closely.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Stepper controls */}
              <div className="lg:col-span-4 flex flex-col justify-center gap-3">
                <div className="flex items-center justify-between px-1 pb-1 text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Feature Walkthrough
                  </span>
                  <span className="text-[#00FF87] flex items-center gap-1.5 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF87] animate-ping" />
                    Auto-Sequence
                  </span>
                </div>

                {[
                  {
                    step: 1,
                    tag: "URL & QR STUDIO",
                    title: "1. Shorten & Customize QR",
                    desc: "Paste destination URLs, set custom branded aliases, and customize vector QR code themes in real-time.",
                    icon: QrCode,
                    color: "from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-400",
                    glow: "from-blue-500 via-cyan-500 to-indigo-600",
                  },
                  {
                    step: 2,
                    tag: "< 3MS ROUTING",
                    title: "2. Fast Redirect & Health Check",
                    desc: "Instant 301 edge redirects with automated latency profiling, memory cache verification, and database checks.",
                    icon: Zap,
                    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
                    glow: "from-amber-500 via-orange-500 to-yellow-500",
                  },
                  {
                    step: 3,
                    tag: "LIVE WEBSOCKETS",
                    title: "3. Real-Time Performance Analytics",
                    desc: "Live dashboard tracking visitor volumes, device platforms, referral channels, and geographical country statistics.",
                    icon: BarChart3,
                    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
                    glow: "from-emerald-500 via-teal-500 to-cyan-500",
                  },
                  {
                    step: 4,
                    tag: "PRO MEMBERSHIP",
                    title: "4. Subscription & Secure Checkout",
                    desc: "Select the PRO tier with 50% yearly discount and complete authorized transactions via simulated Razorpay.",
                    icon: CreditCard,
                    color: "from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400",
                    glow: "from-[#E50914] via-rose-500 to-pink-600",
                  }
                ].map((s) => {
                  const Icon = s.icon;
                  const isActive = simStep === s.step;

                  return (
                    <button 
                      key={s.step}
                      onClick={() => { setSimStep(s.step); setSimProgress(0); }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                        isActive 
                          ? "bg-zinc-900/95 border-blue-500/60 shadow-[0_0_35px_-5px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/30 scale-[1.02]" 
                          : "bg-zinc-950/80 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/60 hover:scale-[1.01]"
                      }`}
                    >
                      {/* Active glow accent indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-600" />
                      )}

                      <div className="flex items-start gap-3.5">
                        {/* Icon box */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
                          isActive 
                            ? `bg-gradient-to-br ${s.color} scale-105 shadow-md` 
                            : "bg-zinc-900/90 border-zinc-800 text-slate-400 group-hover:text-slate-200 group-hover:border-zinc-700"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isActive 
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                                : "bg-zinc-900 border-zinc-800 text-slate-400 group-hover:text-slate-300"
                            }`}>
                              {s.tag}
                            </span>

                            {isActive && (
                              <span className="flex items-center gap-1 text-[8px] font-mono font-black text-[#00FF87] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF87] animate-ping" />
                                Active
                              </span>
                            )}
                          </div>

                          <h3 className={`font-black text-sm md:text-[15px] mt-2 transition-colors duration-200 ${
                            isActive ? "text-white" : "text-slate-200 group-hover:text-white"
                          }`}>
                            {s.title}
                          </h3>

                          <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans line-clamp-2">
                            {s.desc}
                          </p>

                          {/* Progress Bar inside Active Card */}
                          {isActive && (
                            <div className="w-full bg-zinc-800/80 h-1.5 rounded-full mt-3.5 overflow-hidden ring-1 ring-white/5">
                              <div 
                                className={`bg-gradient-to-r ${s.glow} h-full transition-all duration-75 rounded-full`}
                                style={{ width: `${simProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Simulation Screen Wrapper */}
              <div 
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className="lg:col-span-8 rounded-3xl border border-zinc-800 hover:border-zinc-700 bg-[#070709] p-8 shadow-2xl relative flex flex-col justify-between min-h-[420px] text-sm font-sans cursor-pointer select-none transition-all duration-300"
              >
                
                {/* Mock Browser Header */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-5 mb-5">
                  <div className="flex gap-2 items-center">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  </div>
                  
                  {/* Address Bar */}
                  <div className="bg-black border border-zinc-800 rounded-xl px-5 py-2 w-full max-w-lg mx-5 text-left text-xs text-slate-500 truncate flex items-center gap-2 font-mono">
                    <span className="text-emerald-400 font-bold select-none">HTTPS://</span>
                    <span className="text-slate-200 font-bold">
                      {simStep === 2 ? "pburls.online/r/git-issue" : simStep === 3 ? "pburls.online/dashboard" : simStep === 4 ? "pburls.online/pricing" : "pburls.online"}
                    </span>
                  </div>

                  <div className="flex gap-2 text-[10px] text-[#00FF87] bg-[#00FF87]/5 border border-[#00FF87]/20 px-3 py-1 rounded-full uppercase font-mono tracking-wider font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF87] animate-ping"></span>
                    <span>Live Simulation</span>
                  </div>
                </div>

                {/* Simulated Content Area */}
                <div className="flex-1 flex flex-col justify-center py-4">
                  
                  {simStep === 1 && (
                    <div className="space-y-4 max-w-xl mx-auto w-full">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider text-center">1. Shorten & Customize Branded QR Link</h4>
                      
                      {/* Grid containing inputs, short link result, and QR styling */}
                      <div className="space-y-3.5">
                        
                        {/* inputs side-by-side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-mono font-bold">1. Paste Long Destination URL</label>
                            <div className="text-white bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-center gap-1 font-mono shadow-inner h-9 overflow-hidden font-bold">
                              <span className="text-indigo-400 truncate">{typedUrl}</span>
                              {typedUrl.length < 59 && <span className="w-1.5 h-3.5 bg-white animate-pulse shrink-0"></span>}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-mono font-bold">2. Enter Custom Alias (Branding)</label>
                            <div className="text-white bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs flex items-center gap-1 font-mono shadow-inner h-9 font-bold">
                              <span className="text-emerald-400">git-issue</span>
                            </div>
                          </div>
                        </div>

                        {/* Generated Short URL Output */}
                        <div className="text-left space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase font-mono font-bold">3. Generated Branded Short Link</label>
                          <div className="bg-[#00FF87]/5 border border-[#00FF87]/20 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
                            <div className="font-mono text-xs text-[#00FF87] font-extrabold truncate">
                              https://pburls.online/r/git-issue
                            </div>
                            <span className="bg-[#00FF87]/15 border border-[#00FF87]/30 text-[#00FF87] text-[8px] font-mono tracking-widest font-black uppercase px-2 py-0.5 rounded-md">
                              READY
                            </span>
                          </div>
                        </div>

                        {/* QR Code Customizer */}
                        <div className="p-3.5 bg-zinc-900/60 border border-zinc-850 rounded-xl flex flex-col sm:flex-row items-center gap-4 text-left">
                          <div className="flex-1 space-y-1.5">
                            <h5 className="text-[10px] font-black text-white uppercase tracking-wider">4. Style Vector QR Code</h5>
                            <p className="text-[9px] text-slate-400 leading-normal font-sans">
                              Change pixel custom colors dynamically to brand your physical scans. Visual contrast checking is automated.
                            </p>
                            
                            {/* Color Selector */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[8px] font-mono text-slate-500 uppercase">Select Color:</span>
                              <div className="flex gap-1.5">
                                {["#00F0FF", "#8B5CF6", "#EC4899"].map((color) => (
                                  <span 
                                    key={color} 
                                    className="w-4 h-4 rounded-full border border-white/20 cursor-pointer transition-transform hover:scale-110"
                                    style={{ backgroundColor: color, border: qrColor === color ? "2px solid #fff" : "none" }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Live Dynamic QR preview */}
                          <div className="p-2 bg-white rounded-lg shadow-lg shrink-0 transition-all duration-500" style={{ boxShadow: `0 8px 20px -4px ${qrColor}25` }}>
                            <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none">
                              <rect x="0" y="0" width="25" height="25" fill={qrColor} rx="2" />
                              <rect x="5" y="5" width="15" height="15" fill="white" />
                              <rect x="0" y="75" width="25" height="25" fill={qrColor} rx="2" />
                              <rect x="5" y="80" width="15" height="15" fill="white" />
                              <rect x="75" y="0" width="25" height="25" fill={qrColor} rx="2" />
                              <rect x="80" y="5" width="15" height="15" fill="white" />
                              <rect x="35" y="10" width="8" height="8" fill={qrColor} rx="1" />
                              <rect x="45" y="20" width="8" height="8" fill={qrColor} rx="1" />
                              <rect x="10" y="35" width="8" height="8" fill={qrColor} rx="1" />
                              <rect x="60" y="60" width="12" height="12" fill={qrColor} rx="1.5" />
                              <rect x="35" y="50" width="8" height="8" fill={qrColor} rx="1" />
                              <rect x="50" y="45" width="12" height="8" fill={qrColor} rx="1" />
                              <rect x="70" y="35" width="8" height="8" fill={qrColor} rx="1" />
                              <rect x="80" y="70" width="8" height="12" fill={qrColor} rx="1" />
                              <rect x="45" y="75" width="8" height="8" fill={qrColor} rx="1" />
                            </svg>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="space-y-4 max-w-xl mx-auto w-full text-center">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">2. Share & Trigger Redirection</h4>
                      
                      {/* Copy link box */}
                      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 shadow-inner">
                        <span className="font-mono text-xs text-indigo-400 font-bold truncate">https://pburls.online/r/git-issue</span>
                        <button className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all duration-300 shrink-0 ${
                          copyStatus === "Copied!" 
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10" 
                            : "bg-zinc-800 text-slate-300 hover:bg-zinc-700"
                        }`}>
                          {copyStatus}
                        </button>
                      </div>

                      {/* Redirection latency simulation display */}
                      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-2.5 text-left text-xs font-mono">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>1. Redirection Resolver:</span>
                          <span className="text-cyan-400 font-bold">MATCHED (/r/git-issue)</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>2. Target Health Check:</span>
                          <span className="text-[#00FF87] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> 200 OK (Healthy)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>3. Cache Broker Layer:</span>
                          <span className="text-indigo-400 font-bold">REDIS MEMORY HIT</span>
                        </div>
                        <div className="border-t border-zinc-900 pt-2 flex items-center justify-between text-white font-bold text-[13px]">
                          <span>ELAPSED REDIRECT TIME:</span>
                          <span className="text-[#00FF87]">2.4 ms</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {simStep === 3 && (
                    <div className="space-y-4 max-w-3xl mx-auto w-full text-left font-sans">
                      <h4 className="text-sm font-black text-white text-center uppercase tracking-wider">3. Live Dashboard Performance Analytics</h4>
                      
                      {/* 1. Large Summary Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl relative shadow-inner text-center md:text-left">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">Total Redirects</div>
                          <div className="text-xl font-black text-[#00FF87] font-mono mt-1">{stats.totalClicks.toLocaleString()}</div>
                          <span className="absolute top-2 right-3 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-extrabold">LIVE</span>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl shadow-inner text-center md:text-left">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">Unique Visitors</div>
                          <div className="text-xl font-black text-white font-mono mt-1">{stats.uniqueClicks.toLocaleString()}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl shadow-inner text-center md:text-left">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">QR Code Scans</div>
                          <div className="text-xl font-black text-cyan-400 font-mono mt-1">{stats.qrScans.toLocaleString()}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl shadow-inner text-center md:text-left">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">Avg Redirection</div>
                          <div className="text-xl font-black text-indigo-400 font-mono mt-1">{stats.meanLatencyMs || 1.2} ms</div>
                        </div>
                      </div>

                      {/* 2. Device Breakdown & Location / Source Data */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Device Analytics Panel */}
                        <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl space-y-3.5 shadow-md">
                          <div className="text-xs text-white uppercase tracking-wider font-mono font-bold border-b border-zinc-900 pb-2 flex justify-between items-center">
                            <span>Device Platforms</span>
                            <span className="text-[10px] text-slate-500 font-normal">Real Database Counts</span>
                          </div>
                          
                          <div className="space-y-3">
                            {(stats.devices || []).length > 0 ? (
                              (stats.devices || []).slice(0, 3).map((dev) => {
                                const pct = stats.totalClicks > 0 ? Math.round((dev.count / stats.totalClicks) * 100) : 0;
                                return (
                                  <div key={dev.name} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs text-slate-300">
                                      <span className="font-medium capitalize">{dev.name}</span>
                                      <span className="font-bold text-white">{dev.count} ({pct}%)</span>
                                    </div>
                                    <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full" style={{ width: `${Math.max(pct, 5)}%` }}></div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-xs text-slate-300">
                                    <span className="font-medium">Desktop (Chrome, Safari, Firefox)</span>
                                    <span className="font-bold text-slate-500">0 clicks</span>
                                  </div>
                                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full" style={{ width: "0%" }}></div>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-xs text-slate-300">
                                    <span className="font-medium">Mobile &amp; WebViews</span>
                                    <span className="font-bold text-slate-500">0 clicks</span>
                                  </div>
                                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                                    <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full" style={{ width: "0%" }}></div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Location & Referrers Combined Panel */}
                        <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl grid grid-cols-2 gap-4 shadow-md">
                          
                          {/* Locations */}
                          <div className="space-y-3">
                            <div className="text-xs text-white uppercase tracking-wider font-mono font-bold border-b border-zinc-900 pb-2">
                              Top Locations
                            </div>
                            <div className="space-y-2 text-xs font-mono">
                              {(stats.topCountries || []).length > 0 ? (
                                (stats.topCountries || []).slice(0, 3).map((country) => (
                                  <div key={country.name} className="flex justify-between items-center text-slate-300">
                                    <span className="truncate">{country.name}</span>
                                    <span className="font-bold text-emerald-400">{country.count}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[11px] text-slate-500 italic">No geo clicks logged yet</div>
                              )}
                            </div>
                          </div>

                          {/* Referrer logs */}
                          <div className="space-y-3">
                            <div className="text-xs text-white uppercase tracking-wider font-mono font-bold border-b border-zinc-900 pb-2">
                              Top Referrers
                            </div>
                            <div className="space-y-2 text-xs font-mono">
                              {(stats.topReferrers || []).length > 0 ? (
                                (stats.topReferrers || []).slice(0, 3).map((ref) => (
                                  <div key={ref.name} className="flex justify-between items-center text-slate-300">
                                    <span className="truncate">{ref.name}</span>
                                    <span className="font-bold text-indigo-400">{ref.count}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[11px] text-slate-500 italic">No referrers logged yet</div>
                              )}
                            </div>
                          </div>

                        </div>

                      </div>

                      {/* 3. Taller, Wider Traffic Graph */}
                      <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex flex-col justify-end h-20 relative shadow-inner">
                        <div className="absolute top-2 left-4 text-[9px] text-slate-500 uppercase tracking-wider font-mono">Real-time Traffic Volume ({stats.totalClicks} Total Events)</div>
                        <svg className="w-full h-8 overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none">
                          <path d="M0,8 Q15,4 30,7 T60,2 T90,5 L100,0 L100,10 L0,10 Z" fill="url(#grad)" opacity="0.15" />
                          <path d="M0,8 Q15,4 30,7 T60,2 T90,5 L100,0" fill="none" stroke="#00F0FF" strokeWidth="2.5" />
                          <defs>
                            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#00F0FF" />
                              <stop offset="100%" stopColor="#000" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    </div>
                  )}

                  {simStep === 4 && (
                    <div className="space-y-3 max-w-3xl mx-auto w-full font-sans text-xs animate-fade-in">
                      <h4 className="text-sm font-black text-white text-center uppercase tracking-wider mb-1">4. Subscription Plan Selection &amp; Secure Checkout</h4>
                      
                      {/* Grid Layout: Plan Details on Left, Razorpay Gateway Mock on Right */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        
                        {/* Left Side: Real Plans & Order Summary */}
                        <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl space-y-4 shadow-md">
                          <div className="space-y-2">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold">Select Billing Plan</div>
                            
                            {/* Option 1: Free */}
                            <div className="border border-zinc-900 bg-zinc-905 p-2 rounded-lg flex justify-between items-center opacity-60">
                              <span className="font-bold text-white">Free Basic</span>
                              <span className="font-mono text-slate-400">₹0 / mo</span>
                            </div>

                            {/* Option 2: Starter */}
                            <div className="border border-zinc-900 bg-zinc-905 p-2 rounded-lg flex justify-between items-center opacity-75">
                              <span className="font-bold text-white">Starter</span>
                              <span className="font-mono text-indigo-400">₹149 / mo</span>
                            </div>

                            {/* Option 3: Pro (Selected) */}
                            <div className="border border-[#E50914] bg-[#E50914]/5 p-2.5 rounded-lg flex justify-between items-center shadow-[0_0_15px_rgba(229,9,20,0.1)] relative">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-white text-xs">Pro Membership</span>
                                <span className="text-[9px] text-[#E50914] font-bold">Most Popular (₹3,999/yr)</span>
                              </div>
                              <span className="font-mono text-[#00FF87] font-bold">₹399 / mo</span>
                              <span className="absolute -top-1.5 -right-1.5 bg-[#E50914] text-white text-[7px] px-1 py-0.2 rounded font-black tracking-widest uppercase">ACTIVE</span>
                            </div>

                            {/* Option 4: Business */}
                            <div className="border border-zinc-900 bg-zinc-905 p-2 rounded-lg flex justify-between items-center opacity-60">
                              <span className="font-bold text-white">Business Enterprise</span>
                              <span className="font-mono text-slate-400">₹999 / mo</span>
                            </div>
                          </div>

                          {/* Summary */}
                          <div className="border-t border-zinc-900 pt-3 space-y-1.5">
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono font-bold">Order Summary</div>
                            <div className="flex justify-between text-slate-400 text-[10px]">
                              <span>Pro Plan Annual Rate</span>
                              <span>₹4,788</span>
                            </div>
                            <div className="flex justify-between text-[#00FF87] text-[10px] font-bold">
                              <span>Annual Bundle Discount</span>
                              <span>-₹789</span>
                            </div>
                            <div className="flex justify-between text-white font-extrabold text-xs border-t border-zinc-900 pt-2">
                              <span>Total Amount Due</span>
                              <span className="text-[#00FF87]">₹3,999</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Mock Checkout Portal matching the real app payment gateway */}
                        <div className="bg-[#0d0d12] border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-xl relative flex flex-col justify-between">
                          
                          {/* Portal Header */}
                          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold tracking-wider font-mono text-white flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-ping"></span>
                                PBURLS SECURE CHECKOUT
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-mono">ORDER ID: pay_live_89231</span>
                          </div>

                          {/* Payment Method Selector Tab */}
                          <div className="grid grid-cols-3 gap-1">
                            {["Credit Card", "UPI Apps", "Net banking"].map((tab, idx) => (
                              <div
                                key={tab}
                                className={`rounded-lg py-1 px-2 text-[8px] font-bold uppercase text-center border ${
                                  idx === 0 
                                    ? "bg-[#E50914]/10 border-[#E50914] text-[#E50914]" 
                                    : "bg-slate-950/40 border-zinc-850 text-slate-500"
                                }`}
                              >
                                {tab}
                              </div>
                            ))}
                          </div>
                          
                          {/* Visual Premium Bank Credit Card */}
                          <div className="relative h-28 w-full rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-white/10 p-3.5 flex flex-col justify-between overflow-hidden shadow-lg font-mono">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-[#E50914]/10 rounded-full blur-xl pointer-events-none" />
                            <div className="flex justify-between items-start text-[8px]">
                              <span className="tracking-widest text-[#E50914] font-black">PREMIUM BANK</span>
                              <div className="h-4 w-7 bg-slate-800 rounded-sm opacity-50 flex items-center justify-center text-[7px] text-slate-400">CHIP</div>
                            </div>
                            <div>
                              <p className="text-xs font-mono tracking-widest text-white">4111 2222 3333 1336</p>
                            </div>
                            <div className="flex justify-between items-end text-[8px]">
                              <div className="text-left">
                                <span className="text-[6px] text-slate-500 block uppercase tracking-wider">Card Holder</span>
                                <span className="text-slate-200 uppercase">{simCardName || "Cardholder Name"}</span>
                              </div>
                              <div className="flex gap-3">
                                <div>
                                  <span className="text-[6px] text-slate-500 block uppercase tracking-wider">Expiry</span>
                                  <span className="text-slate-200">12/29</span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-slate-500 block uppercase tracking-wider">CVV</span>
                                  <span className="text-slate-200">•••</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card input forms */}
                          <div className="space-y-2 text-left">
                            <div className="space-y-0.5">
                              <label className="text-[8px] text-slate-500 uppercase font-mono font-bold">Card Holder Name</label>
                              <div className="p-2 bg-black border border-zinc-800 rounded-lg text-white font-mono text-[9px] font-bold flex items-center min-h-[28px]">
                                {simCardName}
                                {simCardName.length < 17 && <span className="w-1 h-3 bg-white animate-pulse ml-0.5" />}
                              </div>
                            </div>
                          </div>
                          
                          {/* Payment Button */}
                          <Link 
                            to="/pricing"
                            className="w-full py-2 rounded-lg font-bold uppercase tracking-wider text-[9px] text-center bg-[#E50914] hover:bg-[#F40B16] text-white shadow-lg shadow-[#E50914]/25 transition duration-300 block"
                          >
                            Explore All Plans &amp; Checkout
                          </Link>

                        </div>

                      </div>

                      {/* Success Alert Banner (Conditional) */}
                      {simCardName.length >= 17 && (
                        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 text-[#00FF87] rounded-xl text-xs font-mono animate-pulse flex items-center justify-center gap-2 font-bold max-w-3xl mx-auto">
                          <CheckCircle className="w-4 h-4 text-emerald-400" /> Transaction Authorized via Razorpay. Pro Account activated! Invoice sent to your email.
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Footer status info */}
                <div className="border-t border-zinc-900 pt-4 text-[10px] text-slate-500 flex justify-between font-mono mt-4">
                  <span className="flex items-center gap-1.5">
                    {isPaused ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span className="text-amber-500 font-bold">PAUSED (Move mouse away to resume)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#00FF87] animate-pulse" />
                        <span className="text-[#00FF87] font-bold">AUTO RUNNING (Hover mouse over screen to pause)</span>
                      </>
                    )}
                  </span>
                  <span className="font-bold text-slate-400">pbUrls Engine v1.0.4</span>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* Feature telemetry specs Grid */}
        <section className="border-t border-zinc-800 bg-black py-20 relative">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.25em] text-[#00F0FF] uppercase bg-cyan-950/20 border border-cyan-500/20 px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> FEATURES &amp; CAPABILITIES
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Powerful Features to Scale Your Links</h2>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed">PBUrls is built with core enterprise features that give you complete branding, security, and developer control.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Card 1 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-cyan-500/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-center text-[#00F0FF]">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#00F0FF] transition">Branded Custom Domains</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Link your own custom domain (e.g. link.yourbrand.com) to establish brand consistency, build consumer trust, and boost click-through rates.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-indigo-500/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition">High-Fidelity Analytics</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Track click volumes, device types, browser clients, geographic locations (countries and cities), and referrer origins in real-time.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-[#FF0055]/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-rose-950/30 border border-[#FF0055]/30 flex items-center justify-center text-[#FF0055]">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#FF0055] transition">Password-Protected Gates</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Secure sensitive links behind strong password confirmation walls. Perfect for sharing internal business logs or premium resources.
                </p>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-amber-500/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition">Dynamic QR Vector Studio</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Generate high-quality vector QR codes. Customize patterns, corner shapes, colors, and contrast checking dynamically to match your branding.
                </p>
              </div>

              {/* Card 5 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-[#00FF87]/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/30 border border-[#00FF87]/30 flex items-center justify-center text-[#00FF87]">
                  <ListPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#00FF87] transition">Bulk Ingestion Engine</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Import and shorten large lists of target destination URLs at once. Perfect for email campaigns, messaging broadcasts, or system migrations.
                </p>
              </div>

              {/* Card 6 */}
              <div className="rounded-2xl border border-zinc-850 bg-zinc-950/80 p-6 space-y-4 hover:border-purple-500/40 hover:bg-zinc-900/40 transition duration-300 group shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition">Developer Keys &amp; Webhooks</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal">
                  Generate secure API keys to integrate url redirection programmatically. Configure callback webhooks to trigger tasks on click events.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* CTA section with high-tech look */}
        <section className="py-20 border-t border-zinc-800 bg-black relative">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative">
            <Server className="w-10 h-10 mx-auto text-[#00F0FF] animate-bounce" />
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Deploy Production Short Links Now</h2>
            <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
              Get started with our free tier or access premium domains, advanced analytics, and priority ingestion pipelines today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {token ? (
                <Link to="/dashboard" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition cursor-pointer">
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link to="/auth?mode=register" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition cursor-pointer">
                  <span>Deploy Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link to="/pricing" className="px-6 py-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-slate-200 font-bold transition cursor-pointer">
                View Plan Pricing
              </Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

export default Home;
