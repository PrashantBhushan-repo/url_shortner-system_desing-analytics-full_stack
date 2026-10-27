import { useState } from "react";
import { Shield, BarChart3, QrCode, Bot, Lock, Terminal, ChevronRight, Link2, ArrowRight, Copy, Clock, CreditCard, Tag, Server } from "lucide-react";

// SYSTEMATIC 8-MODULE FEATURE ARCHITECTURE WITH BRIGHT COLOR SCHEMES
const PLATFORM_MODULES = [
  {
    id: "routing",
    num: "01",
    title: "Link Shortening",
    shortDesc: "Create branded short links with custom aliases, password protection, expiration rules, and UTM tags.",
    icon: Link2,
    badge: "CORE ENGINE",
    style: {
      activeBorder: "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-950/30",
      badgeClass: "bg-blue-500 text-white font-black",
      pillBg: "bg-blue-500/20 text-blue-300 border-blue-400/40",
      textAccent: "text-blue-400",
      btnClass: "bg-blue-600 hover:bg-blue-500 text-white"
    },
    highlights: ["Custom Short URLs", "Password Protection", "UTM Auto-Injector", "TTL Expiration Rules"],
    subFeatures: [
      {
        id: "slugs",
        num: "1.1",
        name: "Custom Short URLs",
        summary: "Use memorable vanity links like pburls.online/my-brand.",
        detail: "Replace long URLs with custom branded back-halves for higher click-through rates and instant brand recognition.",
        visualType: "slug-preview",
        previewData: {
          original: "https://example.com/products/q4-enterprise-suite-special-offer",
          short: "pburls.online/q4-enterprise"
        }
      },
      {
        id: "passcode",
        num: "1.2",
        name: "Password Protection",
        summary: "Lock private links behind an encrypted passcode prompt.",
        detail: "Keep internal documents, staging builds, or private files secure until visitors enter the correct password.",
        visualType: "passcode-preview",
        previewData: {
          link: "pburls.online/secret-report",
          status: "AES-256 Encrypted Password Shield Active"
        }
      },
      {
        id: "ttl-quota",
        num: "1.3",
        name: "Link Expiration & Quotas",
        summary: "Set links to auto-expire by date or maximum click limit.",
        detail: "Schedule automatic deactivation dates or click limits for limited-time offers, flash sales, or promo campaigns.",
        visualType: "ttl-preview",
        previewData: {
          expires: "Dec 31, 2026 at 23:59 UTC",
          usedClicks: "1,420 / 2,000 max clicks (71% used)"
        }
      },
      {
        id: "utm-auto",
        num: "1.4",
        name: "UTM Parameter Injection",
        summary: "Automatically append Google Analytics campaign tracking tags.",
        detail: "Inject utm_source, utm_medium, and utm_campaign query parameters into destination URLs without manual formatting.",
        visualType: "utm-preview",
        previewData: {
          destination: "https://mycompany.com/page?utm_source=pburls&utm_medium=shortlink&utm_campaign=q4_launch"
        }
      }
    ]
  },
  {
    id: "telemetry",
    num: "02",
    title: "Live Analytics",
    shortDesc: "Real-time click tracking with location reports, device breakdowns, and traffic sources.",
    icon: BarChart3,
    badge: "REAL-TIME",
    style: {
      activeBorder: "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/30",
      badgeClass: "bg-emerald-500 text-black font-black",
      pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
      textAccent: "text-emerald-400",
      btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white"
    },
    highlights: ["Sub-Millisecond Speed", "Country Location Maps", "Device & OS Breakdown", "Referral Attribution"],
    subFeatures: [
      {
        id: "geo",
        num: "2.1",
        name: "Location Reports",
        summary: "See click origins by country and city with rank charts.",
        detail: "Understand where your traffic is coming from with country rankings, city data, and interactive world heatmaps.",
        visualType: "geo-preview",
        previewData: [
          { country: "🇺🇸 United States", clicks: "2,450", pct: "45%" },
          { country: "🇮🇳 India", clicks: "1,630", pct: "30%" },
          { country: "🇬🇧 United Kingdom", clicks: "815", pct: "15%" }
        ]
      },
      {
        id: "devices",
        num: "2.2",
        name: "Device & Browser Breakdown",
        summary: "View traffic split between Mobile, Desktop, and Browsers.",
        detail: "See if visitors use iOS, Android, Windows, or Mac, along with Safari, Chrome, and Firefox usage stats.",
        visualType: "device-preview",
        previewData: [
          { device: "📱 Mobile (iOS / Android)", pct: "62%" },
          { device: "💻 Desktop (Windows / macOS)", pct: "34%" },
          { device: "📟 Tablet & Other", pct: "4%" }
        ]
      },
      {
        id: "attribution",
        num: "2.3",
        name: "Traffic Attribution Sources",
        summary: "Identify traffic from social media, search engines, and direct visits.",
        detail: "Find out whether visitors came from LinkedIn, Twitter/X, email newsletters, or direct link clicks.",
        visualType: "source-preview",
        previewData: [
          { source: "LinkedIn", clicks: "1,840" },
          { source: "Twitter / X", clicks: "1,210" },
          { source: "Direct / Email", clicks: "940" }
        ]
      }
    ]
  },
  {
    id: "qrstudio",
    num: "03",
    title: "Custom QR Codes",
    shortDesc: "Generate high-res QR codes with brand neon colors, center logo embedding, and vector SVG exports.",
    icon: QrCode,
    badge: "DESIGN MATRIX",
    style: {
      activeBorder: "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] bg-purple-950/30",
      badgeClass: "bg-purple-500 text-white font-black",
      pillBg: "bg-purple-500/20 text-purple-300 border-purple-400/40",
      textAccent: "text-purple-400",
      btnClass: "bg-purple-600 hover:bg-purple-500 text-white"
    },
    highlights: ["Custom Neon Gradients", "Brand Logo Overlay", "SVG & HD PNG Export", "30% Error Correction"],
    subFeatures: [
      {
        id: "qr-colors",
        num: "3.1",
        name: "Custom QR Color Matrix",
        summary: "Customize QR foreground, background, and eye frame colors.",
        detail: "Match your company brand colors using custom hex codes and linear gradient themes.",
        visualType: "qr-preview",
        previewData: { title: "Cyan & Indigo QR Code Matrix", status: "Scannable ⚡" }
      },
      {
        id: "qr-logo",
        num: "3.2",
        name: "Center Logo Embedding",
        summary: "Place your company logo in the center of any QR code.",
        detail: "Built-in Level H error correction ensures your QR code scans 100% reliably even with your brand logo inside.",
        visualType: "qr-logo-preview",
        previewData: { logo: "pbUrls Center Logo", margin: "Level H Error Correction (30%)" }
      },
      {
        id: "qr-export",
        num: "3.3",
        name: "Vector SVG & HD PNG Export",
        summary: "Download print-ready vector files or digital HD PNG images.",
        detail: "Export high-resolution QR codes for print billboards, flyers, business cards, or web banners.",
        visualType: "export-preview",
        previewData: { formats: ["PNG (4K HD)", "SVG Vector", "WebP"] }
      }
    ]
  },
  {
    id: "assistant",
    num: "04",
    title: "AI Copilot Assistant",
    shortDesc: "Natural language AI assistant to ask traffic questions, create short links, and export chat notes.",
    icon: Bot,
    badge: "AI POWERED",
    style: {
      activeBorder: "border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] bg-cyan-950/30",
      badgeClass: "bg-cyan-500 text-black font-black",
      pillBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
      textAccent: "text-cyan-400",
      btnClass: "bg-cyan-600 hover:bg-cyan-500 text-white"
    },
    highlights: ["Natural Chat Interface", "Automated Actions", "User-Isolated Memory", "Markdown Export"],
    subFeatures: [
      {
        id: "ai-copilot",
        num: "4.1",
        name: "Conversational Assistant",
        summary: "Ask traffic questions or create short links in plain text chat.",
        detail: "Type requests like 'Shorten https://github.com' or 'Which country clicked my link today?' for instant answers.",
        visualType: "ai-preview",
        previewData: {
          prompt: "Which country clicked my link the most today?",
          reply: "🇺🇸 United States brought 45% of total traffic today (1,420 clicks), followed by 🇮🇳 India (30%)."
        }
      },
      {
        id: "ai-markdown",
        num: "4.2",
        name: "Chat History Export",
        summary: "Export assistant responses as clean Markdown files.",
        detail: "Save AI recommendations, traffic audits, and link summaries for team documentation or notes.",
        visualType: "ai-export-preview",
        previewData: { file: "pburls-traffic-summary.md", size: "4.2 KB" }
      }
    ]
  },
  {
    id: "billing",
    num: "05",
    title: "Plans & Billing",
    shortDesc: "Flexible pricing tiers, promo coupon code redemption, refund policies, and transaction invoices.",
    icon: CreditCard,
    badge: "MONETIZATION",
    style: {
      activeBorder: "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/30",
      badgeClass: "bg-emerald-500 text-black font-black",
      pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
      accent: "text-emerald-400",
      btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white"
    },
    highlights: ["Clear Plan Tiers", "Promo Code Engine", "Refund Requests", "Invoice Receipts"],
    subFeatures: [
      {
        id: "coupons",
        num: "5.1",
        name: "Promo Discount Coupons",
        summary: "Apply percentage or flat discount vouchers during upgrade.",
        detail: "Enter promo codes (e.g. WELCOME2026) at checkout for instant price discounts on Pro or Enterprise plans.",
        visualType: "coupon-preview",
        previewData: { code: "PROMO2026", discount: "25% OFF", status: "Applied Successfully ✓" }
      },
      {
        id: "refunds",
        num: "5.2",
        name: "Subscription & Refund Manager",
        summary: "Manage active subscriptions and review refund guarantees.",
        detail: "Transparent billing dashboard allowing one-click plan management and refund policy access.",
        visualType: "refund-preview",
        previewData: { status: "Active Subscription (Pro Tier)", refundStatus: "14-Day Money-Back Guarantee" }
      }
    ]
  },
  {
    id: "security",
    num: "06",
    title: "Security & 2FA",
    shortDesc: "Protect accounts with Google Authenticator 2FA, session audit logs, and Fast Pass visual captcha.",
    icon: Shield,
    badge: "ZERO-TRUST",
    style: {
      activeBorder: "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-red-950/30",
      badgeClass: "bg-red-500 text-white font-black",
      pillBg: "bg-red-500/20 text-red-300 border-red-400/40",
      accent: "text-red-400",
      btnClass: "bg-red-600 hover:bg-red-500 text-white"
    },
    highlights: ["Google 2FA TOTP", "Session Audit History", "Password Rotation", "Fast Pass Demo"],
    subFeatures: [
      {
        id: "mfa",
        num: "6.1",
        name: "Two-Factor Authentication (2FA)",
        summary: "Secure logins with rotating 6-digit authenticator app codes.",
        detail: "Use Google Authenticator or Authy to protect your account against unauthorized sign-ins.",
        visualType: "mfa-preview",
        previewData: { code: "849 - 201", rotatesIn: "Rotates in 18s" }
      },
      {
        id: "fastpass",
        num: "6.2",
        name: "Fast Pass Visual Captcha",
        badge: "PUZZLE BYPASS",
        summary: "Test platform features instantly using a simple visual photo puzzle.",
        detail: "Select matching photos in our quick captcha puzzle to explore demo sessions without entering credentials.",
        visualType: "fastpass-preview",
        previewData: { match: "Select matching photos", status: "Access Verified ⚡" }
      },
      {
        id: "audit-logs",
        num: "6.3",
        name: "Login History & Session Audit",
        summary: "Review active logins, IP locations, and signed-in devices.",
        detail: "Monitor account logins and log out of recognized device sessions remotely at any time.",
        visualType: "audit-preview",
        previewData: { ip: "198.51.100.42", device: "MacBook Pro (Chrome)", status: "Active Session" }
      }
    ]
  },
  {
    id: "api",
    num: "07",
    title: "Developer API",
    shortDesc: "Programmatic URL shortening with RESTful JSON endpoints, API keys, and cURL code examples.",
    icon: Terminal,
    badge: "DEVELOPER",
    style: {
      activeBorder: "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-950/30",
      badgeClass: "bg-amber-500 text-black font-black",
      pillBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
      accent: "text-amber-400",
      btnClass: "bg-amber-600 hover:bg-amber-500 text-white"
    },
    highlights: ["Scoped Bearer Keys", "Rate Limit Headers", "REST JSON API", "Code Snippets"],
    subFeatures: [
      {
        id: "api-keys",
        num: "7.1",
        name: "API Keys & Integrations",
        summary: "Generate API keys to shorten links programmatically.",
        detail: "Integrate short link generation into your web applications, mobile apps, or server scripts using standard API keys.",
        visualType: "api-preview",
        previewData: { key: "pb_live_8f92a10b4c...", rateLimit: "10,000 requests / hr" }
      }
    ]
  },
  {
    id: "admin",
    num: "08",
    title: "Server Health",
    shortDesc: "Real-time infrastructure health monitoring, DB response latency, and Redis cache status.",
    icon: Server,
    badge: "SYSTEM STATUS",
    style: {
      activeBorder: "border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-indigo-950/30",
      badgeClass: "bg-indigo-500 text-white font-black",
      pillBg: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
      accent: "text-indigo-400",
      btnClass: "bg-indigo-600 hover:bg-indigo-500 text-white"
    },
    highlights: ["Sub-1.2ms Latency", "Database Status", "Cache Uptime", "Live Metrics"],
    subFeatures: [
      {
        id: "health-monitor",
        num: "8.1",
        name: "Infrastructure Health Metrics",
        summary: "View live database and cache performance metrics.",
        detail: "Real-time monitoring ensures high availability and sub-millisecond response times across all services.",
        visualType: "admin-preview",
        previewData: { db: "Database Status: ONLINE (1.2ms)", redis: "Redis Cache: ONLINE (0.8ms)" }
      }
    ]
  }
];

export default function PburlsFeatures({ onSelectMode, onCloseModal }) {
  const [selectedModuleId, setSelectedModuleId] = useState("routing");
  const [selectedSubIndex, setSelectedSubIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeModule = PLATFORM_MODULES.find((m) => m.id === selectedModuleId) || PLATFORM_MODULES[0];
  const activeSubFeature = activeModule.subFeatures[selectedSubIndex] || activeModule.subFeatures[0];

  const handleCopyDemo = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full text-left font-sans animate-fade-in space-y-6">
      
      {/* 🌟 BRIGHT, HIGH-CONTRAST TOP HERO BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-zinc-900 to-slate-900 rounded-3xl border border-zinc-700 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-xs font-black tracking-wider shadow-sm">
              <span>PBURLS PLATFORM FEATURES</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              pb<span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Urls</span> Features & Tools
            </h2>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed max-w-2xl font-medium">
              Explore link shortening, live analytics, custom QR codes, AI assistant, security, and developer API tools.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onSelectMode && (
              <button 
                type="button"
                onClick={() => onSelectMode("puzzle")}
                className="px-5 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs md:text-sm transition shadow-lg shadow-yellow-500/25 cursor-pointer flex items-center justify-center transform active:scale-95"
              >
                <span>Fast Pass Instant Demo</span>
              </button>
            )}
            {onCloseModal && (
              <button 
                onClick={onCloseModal}
                className="px-4 py-3 text-xs md:text-sm font-bold text-slate-200 hover:text-white bg-zinc-800 border border-zinc-700 rounded-2xl hover:bg-zinc-700 transition cursor-pointer"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION GRID */}
      <div>
        <div className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
          <span>Select Feature Module:</span>
          <span className="text-blue-400 font-mono">8 Core Modules</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {PLATFORM_MODULES.map((module) => {
            const Icon = module.icon;
            const isSelected = module.id === selectedModuleId;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => {
                  setSelectedModuleId(module.id);
                  setSelectedSubIndex(0);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-full group relative overflow-hidden ${
                  isSelected
                    ? `${module.style.activeBorder} bg-zinc-900 ring-2 ring-blue-500/40 scale-[1.03]`
                    : "bg-zinc-900/90 border-zinc-700/80 hover:border-zinc-500 hover:bg-zinc-800/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-black text-slate-400 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                      {module.num}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${module.style.badgeClass}`}>
                      {module.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    <div className={`p-1.5 rounded-xl border ${
                      isSelected ? module.style.pillBg : "bg-zinc-800 text-slate-200 border-zinc-700"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className={`text-xs md:text-sm font-extrabold leading-snug ${isSelected ? "text-white" : "text-slate-100"}`}>
                      {module.title}
                    </h3>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{module.subFeatures.length} Items</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? `${module.style.textAccent} translate-x-1` : "text-zinc-500"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🖥️ MAIN SYSTEMATIC 2-PANE SHOWCASE PANEL */}
      <div className="bg-zinc-900/95 rounded-3xl border border-zinc-700 p-5 md:p-8 shadow-2xl">
        
        {/* Module Header Bar */}
        <div className="pb-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-sm ${activeModule.style.pillBg}`}>
                MODULE #{activeModule.num}: {activeModule.title}
              </span>
              <span className="text-xs text-emerald-400 font-black bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
              {activeModule.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-200 leading-relaxed max-w-2xl">
              {activeModule.shortDesc}
            </p>
          </div>

          {/* Highlights Pills */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeModule.highlights.map((h, i) => (
              <span 
                key={i} 
                className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-emerald-400/70 text-xs sm:text-sm font-black text-white shadow-md hover:border-emerald-300 transition-colors"
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* 2-Column Grid: Left Sub-Feature Selector | Right Live Visual Preview */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Numbered Sub-Features List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2 flex justify-between items-center">
              <span>Sub-Features:</span>
              <span className="text-blue-400 font-mono">({activeModule.subFeatures.length} Items)</span>
            </div>

            {activeModule.subFeatures.map((sub, idx) => {
              const isSubActive = idx === selectedSubIndex;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubIndex(idx)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                    isSubActive
                      ? "bg-blue-600/20 border-blue-500 shadow-md ring-2 ring-blue-500/40 scale-[1.01]"
                      : "bg-zinc-950/90 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-black text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                        {sub.num}
                      </span>
                      <h4 className={`text-xs md:text-sm font-black ${isSubActive ? "text-white" : "text-slate-100"}`}>
                        {sub.name}
                      </h4>
                      {sub.badge && (
                        <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded font-black">
                          {sub.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-snug">
                      {sub.summary}
                    </p>
                  </div>
                  
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${isSubActive ? "text-blue-400 translate-x-1.5" : "text-zinc-500"}`} />
                </button>
              );
            })}
          </div>

          {/* Right Column: Brighter Visual Preview Window */}
          <div className="lg:col-span-7 bg-zinc-950 rounded-3xl border border-zinc-700 p-5 md:p-6 flex flex-col justify-between min-h-[360px] shadow-inner">
            <div className="space-y-4">
              {/* Preview Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                  Live Preview: {activeSubFeature.name}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  LIVE PREVIEW
                </span>
              </div>

              <div>
                <h4 className="text-lg md:text-xl font-black text-white">
                  {activeSubFeature.name}
                </h4>
                <p className="text-xs md:text-sm text-slate-200 mt-1.5 leading-relaxed bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
                  {activeSubFeature.detail}
                </p>
              </div>

              {/* Dynamic Visual Mockup Container */}
              <div className="p-4 md:p-5 rounded-2xl bg-black border border-zinc-700 shadow-xl">
                
                {/* 1. Custom Slug Preview */}
                {activeSubFeature.visualType === "slug-preview" && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-300">Original Destination Link:</div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-slate-300 truncate">
                      {activeSubFeature.previewData.original}
                    </div>

                    <div className="text-xs font-black text-blue-400 flex items-center gap-1">
                      <span>↓ Shortened Branded URL:</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-blue-950/60 border border-blue-500/60 flex items-center justify-between gap-3 shadow-md">
                      <span className="text-sm md:text-base font-black text-white font-mono">
                        {activeSubFeature.previewData.short}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyDemo(activeSubFeature.previewData.short)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedLink ? "Copied!" : "Test Copy"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Passcode Preview */}
                {activeSubFeature.visualType === "passcode-preview" && (
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-700 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="text-base font-black text-white">Password Protected Link</div>
                    <div className="text-xs font-bold text-slate-300">{activeSubFeature.previewData.status}</div>
                    <div className="flex gap-2 max-w-xs mx-auto">
                      <input 
                        type="password" 
                        readOnly 
                        value="••••••••" 
                        className="flex-1 bg-black border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white text-center font-mono"
                      />
                      <button type="button" className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black">
                        Unlock
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. TTL Preview */}
                {activeSubFeature.visualType === "ttl-preview" && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 flex justify-between items-center">
                      <span className="text-slate-300 font-bold">Scheduled Expiration:</span>
                      <span className="text-yellow-400 font-black flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {activeSubFeature.previewData.expires}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700">
                      <div className="flex justify-between text-slate-200 font-black mb-2">
                        <span>Click Quota Limit:</span>
                        <span className="text-blue-400">{activeSubFeature.previewData.usedClicks}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-black overflow-hidden border border-zinc-700">
                        <div className="h-full bg-blue-500 w-[71%]"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. UTM Preview */}
                {activeSubFeature.visualType === "utm-preview" && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="text-slate-300 font-bold">Destination with UTM Campaign Tracking:</div>
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 break-all leading-relaxed font-bold">
                      {activeSubFeature.previewData.destination}
                    </div>
                  </div>
                )}

                {/* 5. Geo Preview */}
                {activeSubFeature.visualType === "geo-preview" && (
                  <div className="space-y-2 font-mono text-xs">
                    {activeSubFeature.previewData.map((g, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-700">
                        <span className="font-black text-white text-sm">{g.country}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-300 font-bold">{g.clicks} clicks</span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40">
                            {g.pct}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. Device Preview */}
                {activeSubFeature.visualType === "device-preview" && (
                  <div className="space-y-3 text-xs font-mono">
                    {activeSubFeature.previewData.map((d, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-slate-200 font-black">
                          <span>{d.device}</span>
                          <span className="text-emerald-400">{d.pct}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: d.pct }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 7. Source Preview */}
                {activeSubFeature.visualType === "source-preview" && (
                  <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                    {activeSubFeature.previewData.map((s, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-center">
                        <div className="text-slate-300 font-bold text-xs mb-1">{s.source}</div>
                        <div className="text-base font-black text-blue-400">{s.clicks}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 8. QR Color Preview */}
                {activeSubFeature.visualType === "qr-preview" && (
                  <div className="flex items-center justify-center gap-6 p-4">
                    <div className="w-24 h-24 rounded-2xl bg-black border-2 border-cyan-400 p-2 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                      <QrCode className="w-20 h-20 text-cyan-400" />
                    </div>
                    <div className="text-xs space-y-1.5">
                      <div className="font-black text-white text-sm">Custom Styling:</div>
                      <div className="text-slate-200 font-bold">✓ Cyan Neon Matrix</div>
                      <div className="text-slate-200 font-bold">✓ Dark Theme Background</div>
                    </div>
                  </div>
                )}

                {/* 9. QR Logo Preview */}
                {activeSubFeature.visualType === "qr-logo-preview" && (
                  <div className="flex items-center justify-center gap-6 p-4">
                    <div className="relative w-24 h-24 rounded-2xl bg-white p-2 flex items-center justify-center shadow-lg">
                      <QrCode className="w-20 h-20 text-black" />
                      <div className="absolute inset-0 m-auto w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow">
                        pb
                      </div>
                    </div>
                    <div className="text-xs space-y-1.5">
                      <div className="font-black text-white text-sm">Center Logo Overlay:</div>
                      <div className="text-slate-200 font-bold">✓ pbUrls Center Brand Logo</div>
                      <div className="text-emerald-400 font-black">✓ {activeSubFeature.previewData.margin}</div>
                    </div>
                  </div>
                )}

                {/* 10. Export Preview */}
                {activeSubFeature.visualType === "export-preview" && (
                  <div className="flex gap-3">
                    {activeSubFeature.previewData.formats.map((fmt, i) => (
                      <div key={i} className="flex-1 p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-center text-xs font-black text-purple-300 shadow">
                        {fmt}
                      </div>
                    ))}
                  </div>
                )}

                {/* 11. AI Chat Preview */}
                {activeSubFeature.visualType === "ai-preview" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-slate-200">
                      <strong className="text-white">👤 User:</strong> "{activeSubFeature.previewData.prompt}"
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 font-medium">
                      <strong className="text-cyan-300">🤖 pbUrls Assistant:</strong> {activeSubFeature.previewData.reply}
                    </div>
                  </div>
                )}

                {/* 12. AI Export Preview */}
                {activeSubFeature.visualType === "ai-export-preview" && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-cyan-300 flex justify-between items-center font-bold">
                    <span>📄 File: {activeSubFeature.previewData.file}</span>
                    <span className="text-slate-300">{activeSubFeature.previewData.size}</span>
                  </div>
                )}

                {/* 13. Coupon Preview */}
                {activeSubFeature.visualType === "coupon-preview" && (
                  <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-black text-white text-sm flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        Code: {activeSubFeature.previewData.code}
                      </div>
                      <div className="text-emerald-400 font-bold mt-0.5">{activeSubFeature.previewData.status}</div>
                    </div>
                    <div className="text-base font-black text-emerald-400">{activeSubFeature.previewData.discount}</div>
                  </div>
                )}

                {/* 14. Refund Preview */}
                {activeSubFeature.visualType === "refund-preview" && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs space-y-1 font-mono">
                    <div className="text-emerald-400 font-black">✓ {activeSubFeature.previewData.status}</div>
                    <div className="text-slate-300 font-bold">{activeSubFeature.previewData.refundStatus}</div>
                  </div>
                )}

                {/* 15. MFA Preview */}
                {activeSubFeature.visualType === "mfa-preview" && (
                  <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-700 text-center space-y-2 font-mono">
                    <div className="text-xs font-bold text-slate-300">Google Authenticator Code:</div>
                    <div className="text-3xl font-black text-red-400 tracking-widest">
                      {activeSubFeature.previewData.code}
                    </div>
                    <div className="text-xs text-slate-400 font-bold">{activeSubFeature.previewData.rotatesIn}</div>
                  </div>
                )}

                {/* 16. Fast Pass Preview */}
                {activeSubFeature.visualType === "fastpass-preview" && (
                  <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/40 text-xs space-y-2">
                    <div className="font-black text-yellow-300 text-sm">⚡ Fast Pass Visual Puzzle Bypass</div>
                    <div className="text-slate-200 font-bold">{activeSubFeature.previewData.match}</div>
                    <div className="text-emerald-400 font-black">{activeSubFeature.previewData.status}</div>
                  </div>
                )}

                {/* 17. Audit Preview */}
                {activeSubFeature.visualType === "audit-preview" && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono flex justify-between items-center font-bold">
                    <div className="text-white">IP: {activeSubFeature.previewData.ip}</div>
                    <div className="text-slate-300">{activeSubFeature.previewData.device}</div>
                    <div className="text-emerald-400">{activeSubFeature.previewData.status}</div>
                  </div>
                )}

                {/* 18. API Preview */}
                {activeSubFeature.visualType === "api-preview" && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-amber-400 space-y-1 font-bold">
                    <div>Bearer Key: {activeSubFeature.previewData.key}</div>
                    <div className="text-slate-300">Rate Limit: {activeSubFeature.previewData.rateLimit}</div>
                  </div>
                )}

                {/* 19. Admin Preview */}
                {activeSubFeature.visualType === "admin-preview" && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-emerald-400 font-black">
                      ✓ {activeSubFeature.previewData.db}
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-indigo-300 font-black">
                      ⚡ {activeSubFeature.previewData.redis}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* CTA Footer */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs md:text-sm text-slate-200 font-bold">
                Ready to try <strong className="text-white">{activeSubFeature.name}</strong>?
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {onSelectMode && (
                  <button
                    type="button"
                    onClick={() => onSelectMode("register")}
                    className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl ${activeModule.style.btnClass} font-black text-xs md:text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2 transform active:scale-95`}
                  >
                    <span>Sign Up Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {onSelectMode && (
                  <button
                    type="button"
                    onClick={() => onSelectMode("puzzle")}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-black text-xs md:text-sm transition cursor-pointer flex items-center justify-center transform active:scale-95"
                  >
                    <span>Fast Pass Demo</span>
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
