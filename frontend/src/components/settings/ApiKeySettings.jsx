import { useState, useEffect } from "react";
import { Key, Plus, AlertCircle, CheckCircle2, Loader2, Copy, Check, Eye, EyeOff, Trash2, Bot, Sparkles, ArrowRight } from "lucide-react";
import API from "../../services/urlApi";

function ApiKeySettings() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  
  const [recentRawKey, setRecentRawKey] = useState("");
  const [showRawKey, setShowRawKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/api-keys");
      setKeys(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load API keys. Ensure your plan supports API Access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setRecentRawKey("");
    setGenerating(true);

    try {
      const response = await API.post("/api-keys", { label: newKeyLabel.trim() || undefined });
      const rawKey = response.data?.apiKey;
      const keyData = response.data?.data;

      if (rawKey) {
        setRecentRawKey(rawKey);
        setShowRawKey(true);
      }
      setSuccess(`API Key "${keyData.label || "Unnamed API Key"}" generated successfully.`);
      setNewKeyLabel("");
      setKeys((prev) => [keyData, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate API key.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this API key? Applications using it will immediately lose access.")) {
      return;
    }
    
    setError("");
    setSuccess("");
    setRevokingId(id);

    try {
      await API.delete(`/api-keys/${id}`);
      setSuccess("API Key revoked successfully.");
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (recentRawKey && id === recentRawKey.id) {
        setRecentRawKey("");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke API key.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text, id = null) => {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-[#E50914]" /> API Developer Keys
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Generate API keys to integrate PBUrls shortening capabilities into your custom software and applications.
        </p>
      </div>

      {/* AI & Claude MCP Quick Connect Banner */}
      <div className="mt-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Looking to connect with Claude or Cursor?</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> MCP Native
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Use our 1-Click MCP Setup to manage links and pull live analytics via AI chat.
            </p>
          </div>
        </div>

        <a
          href="/settings?tab=mcp"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow cursor-pointer"
        >
          <span>Open 1-Click Setup</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="mt-6 space-y-4">
        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated key display */}
      {recentRawKey && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>High Security Key Generated - Save It Now!</span>
          </div>
          <p className="text-xs text-slate-400">
            For security reasons, this key will only be displayed **once**. Copy and store it safely in your system parameters or password vault.
          </p>
          <div className="rounded-xl bg-slate-950/80 border border-white/5 p-4 flex items-center justify-between gap-4 font-mono text-sm">
            <div className="truncate select-all pr-4 text-white">
              {showRawKey ? recentRawKey : "••••••••••••••••••••••••••••••••••••••••••••••••"}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowRawKey((prev) => !prev)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300 transition duration-150 cursor-pointer"
                title={showRawKey ? "Hide API Key" : "Show API Key"}
              >
                {showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(recentRawKey)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300 transition duration-150 cursor-pointer"
                title="Copy API Key"
              >
                {copiedKey ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Form */}
      <form onSubmit={handleGenerateKey} className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Key description/label (e.g. Production server)"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            disabled={generating}
          />
        </div>
        <button
          type="submit"
          className="bg-[#E50914] hover:bg-[#F40B16] disabled:opacity-50 text-white rounded-2xl px-6 py-3 text-xs font-black tracking-widest uppercase transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>Generate Key</span>
        </button>
      </form>

      {/* API Keys List */}
      <div className="mt-8 space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Your API Keys</h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Synchronizing key registry...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-8 text-center text-xs text-slate-500">
            No active API keys registered.
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 flex items-center justify-between gap-4 hover:border-white/10 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">{key.label || "Unnamed API Key"}</span>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      Created: {new Date(key.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      {key.last_used_at && ` • Last used: ${new Date(key.last_used_at).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    disabled={revokingId === key.id}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 transition duration-150 cursor-pointer"
                    title="Revoke Key"
                  >
                    {revokingId === key.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiKeySettings;
