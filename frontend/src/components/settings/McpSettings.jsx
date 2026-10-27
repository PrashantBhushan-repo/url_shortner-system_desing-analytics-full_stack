import { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Copy,
  Check,
  Terminal,
  Loader2,
  CheckCircle2,
  Code2,
  Plus,
  Zap,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import API from "../../services/urlApi";

function McpSettings() {
  const [keys, setKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedTab, setCopiedTab] = useState(null);
  const [activePlatform, setActivePlatform] = useState("claude"); // 'claude' | 'cursor' | 'remote'
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [error, setError] = useState("");

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/api-keys");
      const fetchedKeys = response.data?.data || [];
      setKeys(fetchedKeys);
      if (fetchedKeys.length > 0 && !selectedKey) {
        setSelectedKey(fetchedKeys[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleQuickCreateKey = async () => {
    try {
      setGenerating(true);
      setError("");
      const response = await API.post("/api-keys", { label: "Claude Desktop MCP" });
      const rawKey = response.data?.apiKey;
      const keyData = response.data?.data;

      if (rawKey) {
        setGeneratedKey(rawKey);
      }
      setKeys((prev) => [keyData, ...prev]);
      setSelectedKey(keyData.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate MCP key.");
    } finally {
      setGenerating(false);
    }
  };

  const activeApiKeyPlaceholder = generatedKey ? generatedKey : "snap_your_api_key_here";

  const getClaudeConfig = () => {
    return JSON.stringify(
      {
        mcpServers: {
          pburls: {
            command: "node",
            args: ["c:/Users/prash/OneDrive/Desktop/url_shortner/backend/bin/pburls-mcp.js"],
            env: {
              PBURLS_API_KEY: activeApiKeyPlaceholder,
            },
          },
        },
      },
      null,
      2
    );
  };

  const getCursorConfig = () => {
    return JSON.stringify(
      {
        name: "pburls",
        type: "command",
        command: "node c:/Users/prash/OneDrive/Desktop/url_shortner/backend/bin/pburls-mcp.js",
        env: {
          PBURLS_API_KEY: activeApiKeyPlaceholder,
        },
      },
      null,
      2
    );
  };

  const getRemoteSseUrl = () => {
    const baseUrl = window.location.origin.replace(":5173", ":5000");
    return `${baseUrl}/api/v1/mcp/sse?apiKey=${activeApiKeyPlaceholder}`;
  };

  const copyConfig = async (text, tabName) => {
    await navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2500);
  };

  const examplePrompts = [
    {
      title: "Knowledge & FAQs (RAG)",
      prompt: "How does bot detection work in PBUrls, and how do I configure a custom domain CNAME?",
      category: "Knowledge",
    },
    {
      title: "High-Level Campaign Audit",
      prompt: "Run an audit on my link 'summer-sale', analyze bot traffic vs human clicks, and give me recommendations.",
      category: "Workflows",
    },
    {
      title: "Link Hygiene Inspection",
      prompt: "Scan all my workspace links and check if any destination URLs are dead or expiring soon.",
      category: "Workflows",
    },
    {
      title: "Action: Shorten & QR Code",
      prompt: "Create a short link for https://github.com/my-project with alias 'my-repo' and generate a QR code.",
      category: "Actions",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden settings-radius border settings-border bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/40 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-semibold settings-accent">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Enterprise AI Gateway & Product Assistant</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black settings-ink tracking-tight flex items-center gap-3">
              <Bot className="w-7 h-7 settings-accent" />
              PBUrls AI Assistant & MCP Gateway
            </h2>
            <p className="text-sm settings-ink leading-relaxed">
              Ask product & documentation questions via <strong>Knowledge RAG</strong>, trigger safe <strong>Link Actions</strong>, query live <strong>Telemetry</strong>, and execute composite <strong>Campaign Audits</strong> directly in Claude Desktop or Cursor.
            </p>
          </div>

          <div className="shrink-0">
            {generatedKey ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Active Key Embedded</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleQuickCreateKey}
                disabled={generating}
                className="w-full md:w-auto px-5 py-3 rounded-2xl settings-primary hover:bg-blue-500 settings-ink text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Generate Gateway Key</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* 1-Click Setup Interactive Playground */}
      <div className="settings-radius border settings-border settings-surface p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b settings-border pb-5">
          <div>
            <h3 className="text-lg font-bold settings-ink flex items-center gap-2">
              <Terminal className="w-5 h-5 settings-accent" /> 1-Click Client Configuration
            </h3>
            <p className="text-xs settings-muted mt-1">
              Select your AI client below to copy the ready-to-paste configuration.
            </p>
          </div>

          {/* Platform Switcher */}
          <div className="flex items-center p-1 rounded-2xl settings-surface border settings-border">
            <button
              type="button"
              onClick={() => setActivePlatform("claude")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activePlatform === "claude" ? "settings-primary settings-ink shadow" : "settings-muted hover:text-white"
              }`}
            >
              Claude Desktop
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform("cursor")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activePlatform === "cursor" ? "settings-primary settings-ink shadow" : "settings-muted hover:text-white"
              }`}
            >
              Cursor IDE
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform("remote")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activePlatform === "remote" ? "settings-primary settings-ink shadow" : "settings-muted hover:text-white"
              }`}
            >
              Remote SSE / Agent
            </button>
          </div>
        </div>

        {/* Configuration Code Box */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border settings-border settings-surface p-5 font-mono text-xs settings-ink">
            <div className="flex items-center justify-between pb-3 mb-3 border-b settings-border text-[11px] settings-muted">
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 settings-accent" />
                {activePlatform === "claude" && "claude_desktop_config.json"}
                {activePlatform === "cursor" && "Cursor Settings > Features > MCP"}
                {activePlatform === "remote" && "Server-Sent Events (SSE) Stream URL"}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (activePlatform === "claude") copyConfig(getClaudeConfig(), "claude");
                  else if (activePlatform === "cursor") copyConfig(getCursorConfig(), "cursor");
                  else copyConfig(getRemoteSseUrl(), "remote");
                }}
                className="px-3 py-1.5 rounded-lg settings-primary hover:bg-blue-500 settings-ink text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
              >
                {copiedTab === activePlatform ? (
                  <>
                    <Check className="w-3.5 h-3.5 settings-ink" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Config</span>
                  </>
                )}
              </button>
            </div>

            <pre className="overflow-x-auto text-emerald-400 select-all leading-relaxed">
              {activePlatform === "claude" && getClaudeConfig()}
              {activePlatform === "cursor" && getCursorConfig()}
              {activePlatform === "remote" && getRemoteSseUrl()}
            </pre>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl settings-surface border settings-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold settings-ink">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 settings-accent flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Open Settings</span>
              </div>
              <p className="text-[11px] settings-muted">
                In Claude Desktop, go to <strong>Settings ➔ Developer</strong> and click <strong>Edit config</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl settings-surface border settings-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold settings-ink">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 settings-accent flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Paste Configuration</span>
              </div>
              <p className="text-[11px] settings-muted">
                Paste the copied snippet into <code className="settings-ink">claude_desktop_config.json</code> and save.
              </p>
            </div>

            <div className="p-4 rounded-2xl settings-surface border settings-border space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold settings-ink">
                <span className="w-5 h-5 rounded-full bg-blue-600/20 settings-accent flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Relaunch Claude</span>
              </div>
              <p className="text-[11px] settings-muted">
                Restart Claude Desktop. The <strong>`pburls`</strong> gateway will connect with 13 active superpowers!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Example Prompts to Try */}
      <div className="settings-radius border settings-border settings-surface p-6 md:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold settings-ink flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Conversational Prompts & Workflows
            </h3>
            <p className="text-xs settings-muted mt-1">
              Once connected, ask Claude any of these knowledge or action prompts:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {examplePrompts.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl settings-surface border settings-border hover:border-blue-500/30 transition space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold settings-accent">{item.title}</span>
                  <span className="px-2 py-0.5 rounded-full settings-surface border settings-border text-[9px] font-bold settings-muted uppercase">
                    {item.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyConfig(item.prompt, `prompt-${idx}`)}
                  className="p-1.5 rounded-lg settings-surface hover:bg-slate-800 settings-muted hover:text-white border settings-border text-[10px] flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedTab === `prompt-${idx}` ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedTab === `prompt-${idx}` ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-xs settings-ink font-mono italic settings-surface p-2.5 rounded-xl border settings-border">
                "{item.prompt}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Gateway Capability Suite */}
      <div className="settings-radius border settings-border settings-surface p-6 md:p-8 shadow-xl space-y-6">
        <div>
          <h3 className="text-lg font-bold settings-ink flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Active Gateway Capability Suite (13 Capabilities)
          </h3>
          <p className="text-xs settings-muted mt-1">
            Engineered with Server-Side UserContext, Risk Classification, Idempotency Guards, and Structured Tracing.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-bold settings-accent uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3.5 h-3.5" /> 1. Knowledge & RAG Layer
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl settings-surface border settings-border space-y-1">
                <span className="text-xs font-mono font-bold settings-accent block">search_knowledge_base</span>
                <p className="text-[11px] settings-muted leading-snug">Answers documentation, bot detection, UTM guides, and pricing quotas.</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5" /> 2. High-Level AI Workflows
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl settings-surface border settings-border space-y-1">
                <span className="text-xs font-mono font-bold text-amber-400 block">audit_campaign_performance</span>
                <p className="text-[11px] settings-muted leading-snug">Multi-metric traffic analysis, bot anomaly detection, and AI recommendations.</p>
              </div>
              <div className="p-3.5 rounded-2xl settings-surface border settings-border space-y-1">
                <span className="text-xs font-mono font-bold text-amber-400 block">audit_link_hygiene</span>
                <p className="text-[11px] settings-muted leading-snug">Scans account links for failing health checks, dead targets, and upcoming expirations.</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> 3. Domain Action & Telemetry Tools
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "create_short_link", desc: "Shorten URLs with custom slugs (up to 64 chars), expiry, and password." },
                { name: "get_link_analytics", desc: "Query total/unique/bot clicks, countries, and referrers." },
                { name: "generate_qr_code", desc: "Create dynamic scannable QR codes with scan tracking." },
                { name: "list_links", desc: "List and search all workspace short links with pagination." },
                { name: "get_url_details", desc: "Retrieve metadata, expiration date, and target destination." },
                { name: "get_top_performing_links", desc: "Rank top performing links by traffic volume." },
                { name: "update_link_status", desc: "Update target destination, custom slug, or expiry." },
                { name: "check_link_health", desc: "Inspect target destination alive flag and uptime." },
                { name: "deactivate_link", desc: "Soft-delete or deactivate an active short code." },
                { name: "export_link_csv_data", desc: "Stream raw individual click telemetry logs as CSV." },
              ].map((tool, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl settings-surface border settings-border space-y-1">
                  <span className="text-xs font-mono font-bold text-emerald-400 block">{tool.name}</span>
                  <p className="text-[11px] settings-muted leading-snug">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default McpSettings;
