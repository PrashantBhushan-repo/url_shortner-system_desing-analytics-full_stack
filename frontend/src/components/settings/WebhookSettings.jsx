import { useState, useEffect } from "react";
import { Activity, Plus, AlertCircle, CheckCircle2, Loader2, Copy, Check, Trash2, ShieldAlert } from "lucide-react";
import API from "../../services/urlApi";

function WebhookSettings() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Form states
  const [targetUrl, setTargetUrl] = useState("");
  const [eventType, setEventType] = useState("click.created");
  const [secret, setSecret] = useState(() => {
    // Generate a random string as key secret on render
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/webhooks");
      setWebhooks(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load webhooks. Ensure your plan supports Webhooks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleRegisterWebhook = async (e) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await API.post("/webhooks", {
        targetUrl: targetUrl.trim(),
        event: eventType,
        secret: secret.trim(),
      });
      setSuccess("Webhook listener registered successfully.");
      setTargetUrl("");
      // Refresh secret key for next webhook creation
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      setSecret(Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
      setWebhooks((prev) => [response.data.data, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register webhook.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!window.confirm("Are you sure you want to delete this webhook listener? Webhook events will stop firing immediately.")) {
      return;
    }
    
    setError("");
    setSuccess("");
    setDeletingId(id);

    try {
      await API.delete(`/webhooks/${id}`);
      setSuccess("Webhook deleted successfully.");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete webhook.");
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" /> Outgoing Webhooks
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Subscribe to real-time events. PBUrls will dispatch payload notifications using POST requests to your endpoints.
        </p>
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

      {/* Register Webhook Form */}
      <form onSubmit={handleRegisterWebhook} className="mt-6 space-y-4 border-b border-white/5 pb-8">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Register Webhook Target</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Target URL */}
          <div className="md:col-span-8">
            <label className="mb-2 block text-xs font-semibold text-slate-400">Payload Destination URL</label>
            <input
              type="url"
              placeholder="e.g. https://api.mycompany.com/v1/pburls-webhooks"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              disabled={submitting}
              required
            />
          </div>

          {/* Event selection */}
          <div className="md:col-span-4">
            <label className="mb-2 block text-xs font-semibold text-slate-400">Subscribed Event</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 appearance-none"
              disabled={submitting}
            >
              <option value="click.created">click.created</option>
            </select>
          </div>

          {/* Webhook Secret */}
          <div className="md:col-span-12">
            <label className="mb-2 block text-xs font-semibold text-slate-400">Signature Secret (For security verification)</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white font-mono outline-none focus:border-blue-500"
                disabled={submitting}
                required
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl px-6 py-3 text-xs font-black tracking-widest uppercase transition duration-150 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Register</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Webhooks List */}
      <div className="mt-8 space-y-4">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Configured Listeners</h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Synchronizing webhooks...</span>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-8 text-center text-xs text-slate-500">
            No active webhooks configured.
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((hook) => (
              <div
                key={hook.id}
                className="rounded-2xl border border-white/5 bg-slate-950/40 p-5 space-y-4 hover:border-white/10 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-white block truncate">{hook.target_url}</span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        Subscribed to: <code className="text-indigo-400 font-mono font-bold">{hook.event}</code>
                        {hook.created_at && ` • Configured: ${new Date(hook.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteWebhook(hook.id)}
                      disabled={deletingId === hook.id}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 transition duration-150 cursor-pointer"
                      title="Delete Webhook"
                    >
                      {deletingId === hook.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {hook.secret && (
                  <div className="rounded-xl bg-slate-900/60 p-3 border border-white/5 text-[11px] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="truncate pr-4">
                      <span className="text-slate-500 block uppercase text-[9px] font-sans font-bold tracking-wider mb-0.5">Verification Signature Secret</span>
                      <span className="text-slate-300 font-mono select-all">{hook.secret}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(hook.secret, hook.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition duration-150 cursor-pointer shrink-0"
                      title="Copy Secret"
                    >
                      {copiedId === hook.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WebhookSettings;
