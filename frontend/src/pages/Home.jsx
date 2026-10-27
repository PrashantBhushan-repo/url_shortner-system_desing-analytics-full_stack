import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Bot, Braces, Check, ChevronDown, Code2, Copy, Download, Eye, Fingerprint, Globe2, KeyRound, Layers3, Link2, ListPlus, LockKeyhole, Menu, MousePointer2, Moon, Pause, Play, QrCode, Search, ShieldCheck, Sparkles, Sun, Users, Webhook, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import UrlForm from "../components/url/UrlForm";
import "./home.css";
import { signInPath } from "../routes/navigation";

const GITHUB_URL = "https://github.com/PrashantBhushan-repo/url_shortner-system_desing-analytics-full_stack";
const featuredTools = ["Short links", "QR code studio", "Real-time analytics", "Branded domains", "Protected links", "AI assistant & MCP"];

const tools = [
  { icon: Link2, title: "Short links", category: "Create", text: "Turn long destinations into memorable links. Edit, organize, or remove them from your dashboard." },
  { icon: Fingerprint, title: "Custom aliases", category: "Create", text: "Give every campaign a recognizable name with a short code of your own." },
  { icon: Globe2, title: "Branded domains", category: "Create", text: "Connect and verify your domain. Put your brand in every link you share." },
  { icon: QrCode, title: "QR code studio", category: "Create", text: "Customize colors, patterns, and logos. Export your code for screens or print." },
  { icon: ListPlus, title: "Bulk creation", category: "Create", text: "Create multiple short links in one request and keep campaign launches moving." },
  { icon: BarChart3, title: "Real-time analytics", category: "Understand", text: "Follow clicks, unique visitors, and QR scans with live dashboard updates." },
  { icon: Globe2, title: "Audience geography", category: "Understand", text: "Explore countries, regions, and cities to see where your audience comes from." },
  { icon: MousePointer2, title: "Traffic insights", category: "Understand", text: "Understand devices, browsers, operating systems, and referral sources." },
  { icon: Download, title: "CSV exports", category: "Understand", text: "Take your click data into your reporting workflow with downloadable exports." },
  { icon: Activity, title: "Link health checks", category: "Understand", text: "Check destination availability and audit inactive, expired, or unhealthy links." },
  { icon: ShieldCheck, title: "Bot traffic insights", category: "Understand", text: "Separate detected bot activity from human engagement for a clearer view of your traffic." },
  { icon: LockKeyhole, title: "Protected links", category: "Manage", text: "Add passwords and expiration dates to control access to your destinations." },
  { icon: Users, title: "Team workspaces", category: "Manage", text: "Invite your team and collaborate with owner, admin, and member permissions." },
  { icon: ShieldCheck, title: "Account security", category: "Manage", text: "Use two-factor authentication, session controls, and login history to protect your work." },
  { icon: KeyRound, title: "Developer API", category: "Automate", text: "Create API keys and connect link management to your own applications." },
  { icon: Webhook, title: "Event webhooks", category: "Automate", text: "Connect supported platform events to your services with configurable webhooks." },
  { icon: Bot, title: "AI assistant & MCP", category: "Automate", text: "Manage links, retrieve analytics, generate QR codes, and audit campaigns through AI tools." },
  { icon: Layers3, title: "Plans & billing", category: "Manage", text: "Manage subscriptions, billing cycles, and eligible coupons in one place." },
];
const questions = [
  ["What can I do with PBUrls?", "Create and manage short links, customize QR codes, and understand how people engage with your content. Paid plans unlock capabilities such as branded domains, detailed analytics, API access, and team collaboration."],
  ["Can I use my own domain?", "Yes. Eligible plans let you add a custom domain in Settings, configure its DNS record, and verify it before creating branded short links."],
  ["Can I customize and track QR codes?", "The QR studio supports custom colors, patterns, and logos, plus downloadable exports. QR scans are tracked separately from ordinary link clicks. QR availability depends on your plan."],
  ["How do the AI and developer tools work?", "Use the in-app AI assistant or connect an MCP client using an API key. Available tools include link creation and management, analytics, QR generation, and campaign performance audits. API access and permissions depend on your plan."],
  ["Can my team work together?", "Team workspaces support invitations and owner, admin, and member roles. See the current Business plan for seat limits and available collaboration features."],
  ["Is there a free plan?", "Yes. You can create a free account to start shortening links. The pricing page shows current prices, link quotas, retention periods, and the features included in each plan."],
];

// Keep discovery grounded in the screens and integrations the product provides.
const toolDestinations = {
  "Short links": ["Dashboard → Create link", "/dashboard"],
  "Custom aliases": ["Link studio → Custom alias", "#link-studio"],
  "Branded domains": ["Settings → Custom Domains", "/settings/domains"],
  "QR code studio": ["Dashboard → Link → QR code", "/dashboard"],
  "Bulk creation": ["AI & MCP → Bulk link tools", "/settings/integrations"],
  "Real-time analytics": ["Dashboard → Link → Analytics", "/dashboard"],
  "Audience geography": ["Link analytics → Geography", "/dashboard"],
  "Traffic insights": ["Link analytics → Audience", "/dashboard"],
  "CSV exports": ["Link analytics → Export", "/dashboard"],
  "Link health checks": ["AI & MCP → Link audit", "/settings/integrations"],
  "Bot traffic insights": ["AI assistant → Traffic analysis", "/settings/integrations"],
  "Protected links": ["Link studio → Advanced options", "#link-studio"],
  "Team workspaces": ["Settings → Team Space", "/settings/team"],
  "Account security": ["Settings → Security", "/settings/security"],
  "Developer API": ["Settings → API Developer Keys", "/settings/api-keys"],
  "Event webhooks": ["Settings → Outgoing Webhooks", "/settings/webhooks"],
  "AI assistant & MCP": ["Settings → AI & MCP Integration", "/settings/integrations"],
  "Plans & billing": ["Billing → Plans & payments", "/billing"],
};

function FeatureDestination({ title, signedIn }) {
  const [label, destination] = toolDestinations[title];
  if (destination.startsWith("#")) return <a className="lp-tool-destination" href={destination}>{label}<ArrowUpRight size={15} /></a>;
  return <Link className="lp-tool-destination" to={signedIn ? destination : signInPath(destination, 'register')}><span>{label}<small>{signedIn ? "Open in workspace" : "Sign up to explore"}</small></span><ArrowUpRight size={15} /></Link>;
}

function Github({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7a5.44 5.44 0 0 0-1.5-3.78 5.07 5.07 0 0 0-.09-3.74S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.74a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22" /></svg>;
}

function Brand() {
  return <span className="lp-brand"><span className="lp-brand-mark"><Link2 size={21} strokeWidth={2.8} /></span>pb<span className="lp-brand-light">urls</span><span className="lp-brand-dot">.</span></span>;
}

// Project points on a rotating sphere without a WebGL dependency.
function LinkUniverse({ paused, light }) {
  const canvasRef = useRef(null);
  const angleRef = useRef(0.35);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame, angle = angleRef.current, visible = true, width = 500, height = 500;
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio; canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cancelAnimationFrame(frame);
      draw();
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) draw();
    });
    observer.observe(canvas);
    const points = Array.from({ length: 480 }, (_, index) => {
      const phi = Math.acos(1 - 2 * (index + 0.5) / 480);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index;
      return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
    });
    const draw = () => {
      if (visible && !document.hidden) {
        context.clearRect(0, 0, width, height);
        const radius = Math.min(width, height) * 0.37;
        const projected = points.map(([x, y, z]) => ({ x: width / 2 + (x * Math.cos(angle) - z * Math.sin(angle)) * radius, y: height / 2 + y * radius, z: x * Math.sin(angle) + z * Math.cos(angle) }));
        projected.forEach((point, index) => {
          const alpha = (point.z + 1.5) / 3;
          context.fillStyle = `rgba(${light ? "30,105,69" : "166,229,183"},${alpha * 0.65})`;
          context.beginPath(); context.arc(point.x, point.y, point.z > 0 ? 1.25 : 0.65, 0, Math.PI * 2); context.fill();
          if (index % 7 === 0 && point.z > 0) {
            const next = projected[(index + 21) % projected.length];
            context.strokeStyle = `rgba(${light ? "30,105,69" : "153,218,171"},${alpha * 0.13})`;
            context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(next.x, next.y); context.stroke();
          }
        });
        if (!paused && !motion.matches) angle += 0.0025;
        angleRef.current = angle;
      }
      if (visible && !document.hidden && !paused && !motion.matches) frame = requestAnimationFrame(draw);
    };
    const restart = () => { cancelAnimationFrame(frame); draw(); };
    document.addEventListener("visibilitychange", restart);
    motion.addEventListener("change", restart);
    draw();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); document.removeEventListener("visibilitychange", restart); motion.removeEventListener("change", restart); };
  }, [paused, light]);
  return <div className="lp-universe" aria-label="Animated 3D visualization of connected links around a globe" role="img">
    <div className="lp-orbit lp-orbit-one" /><div className="lp-orbit lp-orbit-two" /><canvas ref={canvasRef} aria-hidden="true" />
    <div className="lp-link-sculpture" aria-hidden="true"><div className="lp-chain lp-chain-one" /><div className="lp-chain lp-chain-two" /></div>
    <div className="lp-float lp-float-link"><span className="lp-mini-icon"><Link2 size={17} /></span><div><small>ONE LINK. EVERY POSSIBILITY.</small><strong>pburls.online / your-next-big-thing</strong></div><ArrowUpRight size={17} /></div>
    <div className="lp-float lp-float-click"><span className="lp-live-dot" /><span>A click. A connection.</span><MousePointer2 size={16} /></div>
    <span className="lp-orbit-label">CREATE · CONNECT · UNDERSTAND</span><span className="lp-star lp-star-one">+</span><span className="lp-star lp-star-two">+</span>
  </div>;
}

function Trend({ compact = false }) {
  const id = compact ? "lp-fill-small" : "lp-fill";
  return <svg className={`lp-trend ${compact ? "lp-trend-small" : ""}`} viewBox="0 0 760 190" role="img" aria-label="Illustrative click activity increasing over a week">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--lp-accent)" stopOpacity=".25" /><stop offset="100%" stopColor="var(--lp-accent)" stopOpacity="0" /></linearGradient></defs>
    {[35, 85, 135, 185].map(y => <path key={y} d={`M0 ${y}H760`} stroke="currentColor" strokeOpacity=".08" strokeDasharray="3 5" />)}
    <path d="M0 157L30 151 58 161 90 126 120 139 150 117 180 125 210 91 240 109 270 101 300 123 330 78 360 91 390 60 420 85 450 68 480 90 510 42 540 55 570 38 600 63 630 27 660 42 690 17 720 33 760 8V190H0Z" fill={`url(#${id})`} />
    <path className="lp-chart-line" d="M0 157L30 151 58 161 90 126 120 139 150 117 180 125 210 91 240 109 270 101 300 123 330 78 360 91 390 60 420 85 450 68 480 90 510 42 540 55 570 38 600 63 630 27 660 42 690 17 720 33 760 8" fill="none" stroke="var(--lp-accent)" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>;
}

function ProductPreview({ active, setActive, start }) {
  const [color, setColor] = useState("#a9e9b9");
  const [qr, setQr] = useState("");
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL("https://pburls.online/", { margin: 1, width: 180, color: { dark: color, light: "#141a18" } }).then(data => { if (!cancelled) setQr(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [color]);
  return <div className="lp-product" id="product-preview">
    <div className="lp-window-bar"><div className="lp-window-dots"><i /><i /><i /></div><span><LockKeyhole size={11} /> PBUrls workspace</span><span className="lp-sample">Interactive preview · sample data</span></div>
    <div className="lp-product-body"><aside className="lp-preview-sidebar"><Brand /><span className="lp-workspace-name"><span>P</span> Your workspace <ChevronDown size={13} /></span><small>WORKSPACE</small>{[["Overview", Layers3], ["Links", Link2], ["QR studio", QrCode], ["Analytics", BarChart3]].map(([label, Icon]) => <button key={label} aria-pressed={active === label} className={active === label ? "is-selected" : ""} onClick={() => setActive(label)}><Icon size={16} />{label}</button>)}<div className="lp-sidebar-bottom"><ShieldCheck size={15} /> Built for your next big idea.</div></aside>
      <div className="lp-preview-main"><div className="lp-preview-top"><span>Workspace <span>/</span> {active}</span><span className="lp-avatar">P</span></div>
        <div className="lp-preview-heading"><div><p className="lp-eyebrow">YOUR LINKS, AT A GLANCE</p><h3>{active === "QR studio" ? "Offline meets online." : active === "Links" ? "Small links. Big possibilities." : "Every connection counts."}</h3></div><Link to={start} className="lp-btn lp-btn-small"><span>+</span> Create a link</Link></div>
        {active === "QR studio" ? <div className="lp-qr-preview"><div className="lp-qr-image">{qr && <img src={qr} width="180" height="180" alt="Working QR code linking to the PBUrls website" />}</div><div><span className="lp-pill">TRY THE STUDIO</span><h4>Make it unmistakably yours.</h4><p>Pick a color. Scan the code. Take your link into the real world.</p><div className="lp-swatches">{["#a9e9b9", "#b8a4ff", "#ffb89c", "#ffffff"].map(value => <button key={value} aria-label={`Set QR color to ${value}`} aria-pressed={color === value} onClick={() => setColor(value)} style={{ background: value }}>{color === value && <Check size={15} />}</button>)}</div>{qr && <a className="lp-text-link" href={qr} download="pburls-preview-qr.png">Download sample QR <Download size={15} /></a>}</div></div> : <>
        {active !== "Links" && <><div className="lp-metric-grid">{[["Total clicks", "24,892", "+18.6%", MousePointer2], ["Unique visitors", "18,204", "+12.4%", Users], ["Active links", "128", "+8 this week", Link2], ["QR scans", "3,641", "+24.2%", QrCode]].map(([label, value, growth, Icon]) => <div key={label}><span>{label}<Icon size={14} /></span><strong>{value}</strong><small>{growth} <span>vs. last period</span></small></div>)}</div><div className="lp-chart-heading"><strong>Click activity</strong><span><i /> Clicks <span className="lp-chart-period">Last 7 days <ChevronDown size={12} /></span></span></div><Trend /><div className="lp-chart-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div></>}
        {active === "Analytics" ? <div className="lp-audience-strip">{[["Top location", "India", "42%"], ["Top device", "Mobile", "68%"], ["Top source", "Direct", "36%"]].map(([label, value, percent]) => <div key={label}><small>{label}</small><strong>{value} <span>{percent}</span></strong></div>)}</div> : <div className="lp-preview-links"><div className="lp-table-title"><strong>Your recent links</strong><Link to="/dashboard">View all <ArrowUpRight size={13} /></Link></div>{[["Summer collection", "pburls.online/summer", "8,429"], ["The weekly edit", "pburls.online/newsletter", "6,218"], ...(active === "Links" ? [["Product launch", "pburls.online/launch", "4,102"], ["Community invite", "pburls.online/community", "2,502"]] : [])].map(([label, url, clicks]) => <div className="lp-link-row" key={label}><span className="lp-row-icon"><Link2 size={15} /></span><div><strong>{label}</strong><small>{url}</small></div><span className="lp-link-clicks">{clicks} <small>clicks</small></span><span className="lp-active-status">Active</span></div>)}</div>}
        </>}
      </div>
    </div>
  </div>;
}

export default function Home() {
  const { token } = useAuth();
  const { theme, setTheme } = useTheme();
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [category, setCategory] = useState("All tools");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [previewTab, setPreviewTab] = useState("Overview");
  const [allTools, setAllTools] = useState(false);
  const root = useRef(null);
  const copyTimer = useRef(null);
  const start = token ? "/dashboard" : "/auth?mode=register";
  const explorePreview = (tab) => setPreviewTab(tab);
  useEffect(() => {
    const elements = root.current.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    elements.forEach(element => observer.observe(element));
    return () => { observer.disconnect(); clearTimeout(copyTimer.current); };
  }, []);
  const snippet = [
    'curl -X POST https://pburls.online/api/urls \\',
    '  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\',
    '  -H "Content-Type: application/json" \\',
    '  -d \'{"longUrl":"https://example.com/your-next-big-thing"}\'',
  ].join("\n");
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setCopyError(""); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2200); }
    catch { setCopyError("Copy unavailable. Select the code below to copy it manually."); }
  };
  const matchingTools = tools.filter(tool => (category === "All tools" || tool.category === category) && `${tool.title} ${tool.text}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleTools = category === "All tools" && !query.trim() && !allTools ? featuredTools.map(title => tools.find(tool => tool.title === title)) : matchingTools;
  return <div ref={root} className={`lp-page ${isDark ? "lp-dark" : "lp-light"} ${paused ? "lp-paused" : ""}`}>
    <a className="lp-skip" href="#main-content">Skip to content</a>
    <header className="lp-header"><div className="lp-container lp-nav"><Link to="/" aria-label="PBUrls home"><Brand /></Link><nav id="landing-navigation" aria-label="Main navigation" className={menu ? "lp-nav-links lp-menu-open" : "lp-nav-links"}>{[["Demo", "#demo-showcase"], ["Features", "#tools"], ["Developers", "#developers"], ["Pricing", "/pricing"]].map(([label, href]) => <Link key={label} to={href} onClick={() => setMenu(false)}>{label}</Link>)}<a className="lp-mobile-github" href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Github size={16} /> View on GitHub <ArrowUpRight size={14} /></a></nav><div className="lp-nav-actions"><a className="lp-icon-button lp-github-nav" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="View PBUrls on GitHub (opens in a new tab)" title="View source on GitHub"><Github size={18} /></a><button className="lp-icon-button lp-theme-toggle" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(isDark ? "light" : "dark")}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="lp-motion-button" aria-label={paused ? "Resume animations" : "Pause animations"} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button><Link className="lp-login" to={token ? "/dashboard" : "/auth?mode=login"}>{token ? "Dashboard" : "Log in"}</Link><Link className="lp-btn lp-btn-small" to={start}>{token ? "Open workspace" : "Get started"}<ArrowUpRight size={15} /></Link><button className="lp-menu-toggle" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} aria-controls="landing-navigation" onKeyDown={event => { if (event.key === "Escape") setMenu(false); }} onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</button></div></div></header>
    <main id="main-content">
      <section className="lp-hero lp-container"><div className="lp-hero-copy"><a href="#tools" className="lp-announcement"><span className="lp-live-dot" /> SHORT LINKS · QR CODES · ANALYTICS <ArrowUpRight size={13} /></a><h1>Shorten a link.<br />Share it anywhere.<br /><span>See what clicks.</span></h1><p>Create short links and custom QR codes. Measure every click. Keep your brand on every link.</p><div className="lp-hero-buttons"><a href="#link-studio" className="lp-btn">Create a short link<ArrowUpRight size={18} /></a><Link className="lp-btn lp-btn-secondary" to="/demo"><Eye size={16} /> Explore demo</Link></div><span className="lp-hero-note"><Check size={13} /> Free plan available <span>·</span> Account required to save links</span><div className="lp-hero-highlights" aria-label="Explore key features"><a href="#link-studio"><Link2 size={15} /> Short links</a><a href="#product-preview" onClick={() => explorePreview("QR studio")}><QrCode size={15} /> QR studio</a><a href="#product-preview" onClick={() => explorePreview("Analytics")}><BarChart3 size={15} /> Click insights</a></div></div><LinkUniverse paused={paused} light={!isDark} /><a href="#platform" className="lp-scroll-note"><span>CREATE. SHARE. UNDERSTAND.</span><ArrowDown size={14} /></a></section>
      <section className="lp-demo-showcase lp-container" id="demo-showcase" aria-labelledby="demo-showcase-title">
        <div className="lp-demo-intro"><div><span className="lp-eyebrow">STEP INSIDE. NO SIGN-UP NEEDED.</span><h2 id="demo-showcase-title">See the product.<br /><span>From both sides.</span></h2></div><p>Explore a sample workspace and the administration behind it. Fictional records, real interface interactions, and no changes to live data.</p></div>
        <div className="lp-demo-options">
          <Link to="/demo" className="lp-demo-option"><div className="lp-demo-option-top"><span className="lp-demo-option-icon"><Layers3 size={25} /></span><span className="lp-demo-label">WORKSPACE DEMO</span><ArrowUpRight size={19} /></div><h3>Create. Share. Understand.</h3><p>Inspect sample campaigns, explore audience insights, and try QR colors.</p><div className="lp-demo-tags"><span><Link2 size={13} /> Links</span><span><QrCode size={13} /> QR studio</span><span><BarChart3 size={13} /> Analytics</span></div><span className="lp-demo-open">Explore workspace<ArrowRight size={17} /></span></Link>
          <Link to="/demo/admin" className="lp-demo-option lp-demo-option-admin"><div className="lp-demo-option-top"><span className="lp-demo-option-icon"><ShieldCheck size={25} /></span><span className="lp-demo-label">ADMIN CONSOLE DEMO</span><ArrowUpRight size={19} /></div><h3>The view behind the platform.</h3><p>Explore sample accounts, moderation, invoices, operations, and audit trails.</p><div className="lp-demo-tags"><span><Users size={13} /> Users</span><span><Layers3 size={13} /> Billing</span><span><ShieldCheck size={13} /> Audit log</span></div><span className="lp-demo-open">Explore admin console<ArrowRight size={17} /></span></Link>
        </div><p className="lp-demo-disclosure"><LockKeyhole size={14} />Public demos are read-only. Real accounts and admin actions require authentication.</p>
      </section>
      <section className="lp-getting-started lp-container" id="how-it-works" aria-labelledby="getting-started-title">
        <div className="lp-guide-heading"><span className="lp-eyebrow">FROM LONG URL TO USEFUL INSIGHTS</span><h2 id="getting-started-title">Three steps. One workspace.</h2><a href="#tools" className="lp-text-link">Browse every feature <ArrowUpRight size={16} /></a></div>
        <ol className="lp-step-grid">
          <li><span className="lp-step-number">01</span><Link2 size={23} /><h3>Create your link</h3><p>Paste a URL, then choose an alias or add protection with an eligible plan.</p><a href="#link-studio">Open link studio <ArrowUpRight size={15} /></a></li>
          <li><span className="lp-step-number">02</span><QrCode size={23} /><h3>Share it your way</h3><p>Copy your short link for any channel, or customize a QR code for print and screens.</p><a href="#product-preview" onClick={() => explorePreview("QR studio")}>Try a sample QR code <ArrowUpRight size={15} /></a></li>
          <li><span className="lp-step-number">03</span><BarChart3 size={23} /><h3>Learn from every click</h3><p>Open a link’s analytics to explore engagement. Unlock audience detail on eligible plans.</p><a href="#product-preview" onClick={() => explorePreview("Analytics")}>Preview analytics <ArrowUpRight size={15} /></a></li>
        </ol>
      </section>
      <section className="lp-link-studio lp-container" id="link-studio"><div className="lp-section-intro" data-reveal><div><span className="lp-eyebrow">01 / CREATE YOUR FIRST LINK</span><h2>A shorter link.<br /><span>A better place to start.</span></h2></div><p>Paste a destination URL below. Sign in to create and save your link; advanced options depend on your plan.</p></div><div className="lp-live-form"><div className="lp-form-header"><span><Link2 size={17} /> Link studio</span><span>{token ? "CONNECTED TO YOUR ACCOUNT" : "SIGN IN TO CREATE AND SAVE LINKS"}</span></div><UrlForm /></div></section>
      <section className="lp-platform lp-container" id="platform"><div className="lp-section-intro" data-reveal><div><span className="lp-eyebrow">TAKE A LOOK INSIDE</span><h2>Your links, QR codes<br /><span>and insights. Together.</span></h2></div><p>Switch between Links, QR studio, and Analytics below. Try QR colors and download a sample. Preview numbers are illustrative.</p></div><div data-reveal><ProductPreview active={previewTab} setActive={setPreviewTab} start={start} /></div><div className="lp-capability-strip"><span><Link2 size={16} /> Branded short links</span><span><QrCode size={16} /> Custom QR codes</span><span><Activity size={16} /> Live analytics</span><span><Users size={16} /> Team workspaces</span><span><Bot size={16} /> AI & MCP ready</span></div></section>
      <section className="lp-story lp-container" id="features"><div className="lp-centered-heading" data-reveal><span className="lp-eyebrow">BRAND. MEASURE. COLLABORATE.</span><h2>More control over<br /><span>every link you share.</span></h2></div><div className="lp-feature-mosaic">
        <article className="lp-story-card lp-brand-card" data-reveal><span className="lp-card-number">01 / MAKE IT YOURS</span><h3>Your domain.<br />Your signature.</h3><p>Leave the long URLs behind. Use custom aliases and your own domain to make every touchpoint feel like you.</p><div className="lp-brand-demo"><div><Globe2 size={16} /><span>yourbrand.com / <b>something-great</b></span><Check size={16} /></div><span className="lp-domain-chip"><ShieldCheck size={12} /> YOUR DOMAIN. YOUR IDENTITY.</span></div><a href="#link-studio" className="lp-text-link">Create your next connection <ArrowUpRight size={16} /></a></article>
        <article className="lp-story-card lp-analytics-card" data-reveal><span className="lp-card-number">02 / SEE THE BIGGER PICTURE</span><h3>Every click.<br />A clearer picture.</h3><p>Discover where your audience comes from, what they use, and which links bring them back.</p><div className="lp-mini-chart"><div><span>Sample click activity</span><strong>24,892 <small>↗ 18.6%</small></strong></div><Trend compact /></div><a href="#product-preview" onClick={() => explorePreview("Analytics")} className="lp-text-link">Explore the analytics preview <ArrowUpRight size={16} /></a></article>
        <article className="lp-story-card lp-qr-card" data-reveal><div><span className="lp-card-number">03 / BRIDGE BOTH WORLDS</span><h3>From print<br />to your destination.</h3><p>Packaging. Posters. Your next event. Turn any surface into a connection with a custom QR code.</p><a href="#product-preview" onClick={() => explorePreview("QR studio")} className="lp-text-link">Try the QR studio <ArrowUpRight size={16} /></a></div><div className="lp-qr-art" aria-hidden="true"><QrCode size={112} strokeWidth={1.4} /><span>SCAN INTO SOMETHING GOOD ↗</span></div></article>
        <article className="lp-story-card lp-team-card" data-reveal><span className="lp-card-number">04 / BETTER, TOGETHER</span><div className="lp-team-art" aria-hidden="true"><span>JD</span><span>AK</span><span>PB</span><span>+</span></div><h3>Shared links.<br />Clear roles.</h3><p>Shared workspaces, clear roles, and invitations that keep everyone moving together.</p><Link to={start} className="lp-text-link">Find your workspace <ArrowUpRight size={16} /></Link></article>
      </div></section>
      <section className="lp-tools-section" id="tools"><div className="lp-container"><div className="lp-section-intro" data-reveal><div><span className="lp-eyebrow">THE WHOLE TOOLKIT</span><h2>Your complete toolkit.<br /><span>One clear place.</span></h2></div><p>Browse by task, search a feature, and see exactly where it lives. Some tools require an eligible paid plan.</p></div><div className="lp-tool-controls"><div role="group" aria-label="Filter tools by purpose" className="lp-tool-filters">{["All tools", "Create", "Understand", "Manage", "Automate"].map(label => <button key={label} aria-pressed={category === label} className={category === label ? "is-selected" : ""} onClick={() => { setCategory(label); setAllTools(false); }}>{label}</button>)}</div><label className="lp-tool-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a tool…" aria-label="Search platform tools" /></label></div><p className="lp-tool-count" role="status">Showing {visibleTools.length} of {matchingTools.length} features{category !== "All tools" ? ` in ${category}` : ""}</p><div className="lp-tools-grid" id="feature-results">{visibleTools.map(({ icon: Icon, title, text, category: type }) => <article className={`lp-tool ${featuredTools.slice(0, 3).includes(title) ? "lp-tool-featured" : ""}`} data-category={type.toLowerCase()} key={title}><div className="lp-tool-top"><span className="lp-tool-icon"><Icon size={23} strokeWidth={1.7} /></span><span>{featuredTools.slice(0, 3).includes(title) ? "Essential · " : ""}{type}</span></div><h3>{title}</h3><p>{text}</p><FeatureDestination title={title} signedIn={!!token} /></article>)}</div>{visibleTools.length === 0 && <div className="lp-empty"><p>No features match “{query}” in {category.toLowerCase()}.</p><button className="lp-btn lp-btn-secondary" onClick={() => { setQuery(""); setCategory("All tools"); }}>Clear filters</button></div>}{category === "All tools" && !query.trim() && <div className="lp-show-tools"><button className="lp-btn lp-btn-secondary" aria-expanded={allTools} aria-controls="feature-results" onClick={() => setAllTools(!allTools)}>{allTools ? "Show fewer features" : `Explore all ${tools.length} features`}<ChevronDown size={16} style={{ transform: allTools ? "rotate(180deg)" : undefined }} /></button></div>}<p className="lp-tools-note">Feature availability and usage limits vary by plan. <Link to="/pricing">Compare plans <ArrowUpRight size={12} /></Link></p></div></section>
      <section className="lp-developers lp-container" id="developers"><div className="lp-developer-copy" data-reveal><span className="lp-eyebrow">LESS MANUAL. MORE POSSIBLE.</span><h2>Connect your apps.<br /><span>Automate your links.</span></h2><p>Bring PBUrls into the tools you already use. Build with the API, connect your AI through MCP, and let webhooks keep your systems in sync.</p><div className="lp-dev-tags"><span><Braces size={14} /> REST API</span><span><Sparkles size={14} /> MCP tools</span><span><Webhook size={14} /> Webhooks</span></div><Link to={token ? "/settings/api-keys" : "/auth?mode=register"} className="lp-text-link">Set up API access <ArrowUpRight size={17} /></Link><Link to={token ? "/settings/integrations" : "/auth?mode=register"} className="lp-text-link lp-mcp-link">Connect an AI tool with MCP <ArrowUpRight size={17} /></Link><a className="lp-source-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Github size={17} /> Explore the source on GitHub <ArrowUpRight size={15} /></a><p className="lp-api-note">The example uses an account access token. Connect MCP clients with a developer API key from Settings.</p></div><div className="lp-code-window" data-reveal><div className="lp-code-tabs"><span><Code2 size={15} /> create-a-connection.sh</span><button onClick={copyCode} aria-label="Copy API example">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></div><pre><code><span className="lp-code-comment"># Create a short link with an account access token</span>{"\n\n"}{snippet}</code></pre><div className="lp-code-result"><span><Check size={14} /> EXAMPLE RESPONSE</span><code>{'{ "shortUrl": "https://pburls.online/r/aB3xYz" }'}</code></div><div className="lp-ai-prompt"><span className="lp-ai-icon"><Sparkles size={17} /></span><div><small>OR, ASK YOUR CONNECTED AI</small><p>“Create a link for my launch and show its analytics.”</p></div></div>{copyError && <p className="lp-copy-error" role="status">{copyError}</p>}</div></section>
      <section className="lp-security lp-container" data-reveal><div className="lp-security-emblem"><ShieldCheck size={33} strokeWidth={1.3} /></div><div><span className="lp-eyebrow">CONFIDENCE, BUILT IN.</span><h3>Your connections deserve a strong foundation.</h3></div><div className="lp-security-items"><span><Check size={13} /> Two-factor authentication</span><span><Check size={13} /> Role-based access</span><span><Check size={13} /> Session management</span><span><Check size={13} /> Password-protected links</span></div></section>
      <section className="lp-pricing lp-container" id="pricing"><div className="lp-centered-heading" data-reveal><span className="lp-eyebrow">ROOM FOR YOUR NEXT BIG THING</span><h2>Start small.<span> Grow from there.</span></h2><p>A personal project. A growing audience. A whole team.<br />There’s a plan for wherever you’re headed.</p></div><div className="lp-plan-grid">{[
        { title: "Free", label: "MAKE YOUR FIRST CONNECTION", text: "A home for your everyday links.", items: ["Core link shortening", "Personal link dashboard", "Basic click analytics"], action: "Start for free", href: start },
        { title: "Starter", label: "GIVE YOUR IDEAS MORE ROOM", text: "More space for a growing audience.", items: ["Expanded link limits", "Longer analytics retention", "Simple subscription management"], action: "Explore Starter", href: "/pricing" },
        { title: "Pro", label: "PUT YOUR BRAND OUT THERE", text: "Your brand, with deeper insights.", items: ["Custom domains & aliases", "QR studio & detailed analytics", "API, exports & webhooks"], action: "Explore Pro", href: "/pricing", featured: true },
        { title: "Business", label: "BRING EVERYONE TOGETHER", text: "A shared platform for your team.", items: ["Team workspaces & roles", "Extended analytics history", "Higher API limits"], action: "Explore Business", href: "/pricing" },
      ].map(plan => <article className={`lp-plan ${plan.featured ? "lp-plan-featured" : ""}`} key={plan.title}>{plan.featured && <span className="lp-plan-badge"><Sparkles size={12} /> FOR YOUR NEXT CHAPTER</span>}<span className="lp-card-number">{plan.label}</span><h3>{plan.title}</h3><p>{plan.text}</p><ul>{plan.items.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul><Link to={plan.href} className={`lp-btn ${plan.featured ? "" : "lp-btn-secondary"}`}>{plan.action}<ArrowUpRight size={15} /></Link></article>)}</div><p className="lp-tools-note">See current prices, billing options, and exact feature limits on the <Link to="/pricing">pricing page <ArrowUpRight size={12} /></Link>.</p></section>
      <section className="lp-faq lp-container" id="faq"><div data-reveal><span className="lp-eyebrow">GOOD TO KNOW</span><h2>A few good<br /><span>questions.</span></h2><p>Accounts, QR codes, plan access,<br />and getting started.</p></div><div className="lp-questions">{questions.map(([question, answer], index) => <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><h3>{question}</h3><ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div></section>
      <section className="lp-final-cta"><div className="lp-container" data-reveal><span className="lp-eyebrow">A SMALL LINK CAN START SOMETHING BIG.</span><h2>Your next link.<br /><span>All under control.</span></h2><Link to={start} className="lp-btn">{token ? "Go to your workspace" : "Create your free account"}<ArrowUpRight size={18} /></Link><p>Start with short links. Explore more as you grow.</p><div className="lp-cta-orbit" aria-hidden="true" /></div></section>
    </main>
    <footer className="lp-footer lp-container"><div className="lp-footer-top"><div><Link to="/" aria-label="PBUrls home"><Brand /></Link><p>Short links. Custom QR codes.<br />Insights that help you improve.</p></div><div><h3>Platform</h3><Link to="/demo">Workspace demo</Link><Link to="/demo/admin">Admin console demo</Link><a href="#features">Features</a><a href="#tools">All tools</a><a href="#link-studio">Link studio</a></div><div><h3>Build & grow</h3><a href="#developers">API & MCP</a><Link to="/pricing">Pricing & plans</Link><Link to={start}>Team workspaces</Link><a href="#faq">Common questions</a><a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="lp-footer-github"><Github size={15} /> GitHub <ArrowUpRight size={13} /></a></div><div><h3>Your workspace</h3><Link to={token ? "/dashboard" : "/auth?mode=login"}>Dashboard</Link><Link to="/settings">Account & security</Link><Link to="/billing">Billing</Link><Link to={start}>{token ? "Manage your links" : "Create an account"}</Link></div></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} PBUrls. Every connection matters.</span><span>MADE FOR WHAT’S NEXT <ArrowUpRight size={13} /></span><a href="#main-content">Back to top ↑</a></div></footer>
  </div>;
}
