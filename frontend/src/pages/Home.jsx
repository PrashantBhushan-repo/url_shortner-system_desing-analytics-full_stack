import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/url/Navbar";
import UrlForm from "../components/url/UrlForm";
import Footer from "../components/url/Footer";
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
  Server
} from "lucide-react";

function Home() {
  const { token } = useAuth();
  const [metricLinks, setMetricLinks] = useState(1284729);
  const [metricLatency, setMetricLatency] = useState(1.42);

  // Subtle ticks to make metrics feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricLinks(prev => prev + Math.floor(Math.random() * 3));
      setMetricLatency(() => parseFloat((1.3 + Math.random() * 0.2).toFixed(2)));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 antialiased selection:bg-cyan-500 selection:text-black font-sans relative overflow-hidden">
      
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
              <span className="hidden sm:inline">MEAN LATENCY: <span className="text-[#00F0FF] font-bold">{metricLatency}ms</span></span>
              <span>ACTIVE WORKERS: <span className="text-indigo-400 font-bold">12 ONLINE</span></span>
              <span>NODE: <span className="text-slate-200">AP-SOUTH-1</span></span>
            </div>
          </div>
        </div>

        {/* Hero Area */}
        <section className="pt-16 pb-16 md:pt-24 md:pb-24">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
            
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/20 text-[#00F0FF] text-[10px] font-mono uppercase tracking-widest animate-pulse">
                <Terminal className="w-3.5 h-3.5" />
                <span>SNAPURL TELEMETRY PLATFORM ACTIVE</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-none">
              Shorten links.<br />
              <span className="bg-gradient-to-r from-[#00F0FF] via-indigo-400 to-indigo-600 bg-clip-text text-transparent">Scale Redirect Performance.</span>
            </h1>

            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed font-sans">
              An industrial-grade link manager designed for high throughput. Featuring asynchronous ingestion queues via BullMQ, real-time WebSocket metrics, and custom QR generation vector suites.
            </p>

            {/* Quick Stats Dashboard Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto bg-black/40 border border-[#1b1e25] p-4 rounded-2xl font-mono text-left">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Redirects Routed</div>
                <div className="text-lg md:text-xl font-black text-white mt-0.5">{metricLinks.toLocaleString()}</div>
              </div>
              <div className="border-l border-[#1b1e25] pl-4">
                <div className="text-[10px] text-slate-500 uppercase">Ingestion Queue</div>
                <div className="text-lg md:text-xl font-black text-[#00FF87] mt-0.5">0ms DELAY</div>
              </div>
              <div className="border-l border-[#1b1e25] pl-4">
                <div className="text-[10px] text-slate-500 uppercase">Cache Layer Hits</div>
                <div className="text-lg md:text-xl font-black text-[#00F0FF] mt-0.5">99.2%</div>
              </div>
              <div className="border-l border-[#1b1e25] pl-4 font-mono">
                <div className="text-[10px] text-slate-500 uppercase">Status</div>
                <div className="text-lg md:text-xl font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-400" /> SECURE
                </div>
              </div>
            </div>

            {/* Shortener Console Form */}
            <div className="mt-8 rounded-3xl border border-[#1b1e25] bg-[#0A0D14]/90 p-6 md:p-8 shadow-2xl relative">
              <div className="absolute top-3 left-4 flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF0055]/30"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#00FF87]/30"></span>
              </div>
              <div className="absolute top-2.5 right-4 text-[9px] font-mono text-slate-600 uppercase">INPUT CONSOLE v1.0.4</div>
              
              <div className="mt-4">
                <UrlForm />
              </div>
            </div>
          </div>
        </section>

        {/* Feature telemetry specs Grid */}
        <section className="border-t border-[#1b1e25] bg-[#06080D] py-20 relative">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.25em] text-[#00F0FF] uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" /> PLATFORM ARCHITECTURE
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Engineered for Micro-Latency</h2>
              <p className="text-slate-400 text-xs md:text-sm">Built to handle high loads without compromising performance, metrics, or stability.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Card 1 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-cyan-500/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-center text-[#00F0FF]">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#00F0FF] transition">Real-time WebSocket Feed</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Visualize click volumes, devices, locations, and referrer logs instantly. Data pushes to admin and user panels via robust sockets with zero page reloading.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-indigo-500/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition">Asynchronous Job Pipeline</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Uses BullMQ and Redis to decouple links routing from analytics database operations. Ensures redirection threads resolve in under 5 milliseconds.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-[#FF0055]/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-rose-950/20 border border-[#FF0055]/30 flex items-center justify-center text-[#FF0055]">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#FF0055] transition">Harden Security Middleware</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Includes mandatory step-up password confirmation for sensitive tasks, short session lifetimes, login telemetry auditing, and IP block allowlisting.
                </p>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-amber-500/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition">Dual-Reconciliation Ledger</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Reconciles financial transactions and payment states against Razorpay webhooks, automatically flags transaction discrepancies, and isolates sync failures.
                </p>
              </div>

              {/* Card 5 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-[#00FF87]/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/20 border border-[#00FF87]/30 flex items-center justify-center text-[#00FF87]">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-[#00FF87] transition">Cron URL Health Scans</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Automated daemon bots check destination URL responsiveness. Safely labels broken links offline after multiple failures to protect redirects traffic.
                </p>
              </div>

              {/* Card 6 */}
              <div className="rounded-2xl border border-[#1b1e25] bg-black/40 p-6 space-y-4 hover:border-purple-500/40 transition duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition">QR Vector Customizers</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Generates vector QR codes directly. Admins and users can edit patterns, eye designs, and colors, backed by automated contrast validation checks.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* CTA section with high-tech look */}
        <section className="py-20 border-t border-[#1b1e25] bg-black/30 relative">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative">
            <Server className="w-10 h-10 mx-auto text-[#00F0FF] animate-bounce" />
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">Deploy Production Short Links Now</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Get started with our free tier or access premium domains, advanced analytics, and priority ingestion pipelines today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {token ? (
                <Link to="/dashboard" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98] transition cursor-pointer">
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link to="/auth?mode=register" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98] transition cursor-pointer">
                  <span>Deploy Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link to="/pricing" className="px-6 py-3 rounded-xl border border-[#1b1e25] bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-semibold transition cursor-pointer">
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
