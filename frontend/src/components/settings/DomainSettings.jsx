import { useState, useEffect, useCallback } from "react";
import { Globe, Plus, AlertCircle, CheckCircle2, Loader2, Copy, Check, Info } from "lucide-react";
import API from "../../services/urlApi";

function DomainSettings() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/domains");
      setDomains(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load custom domains. Please check if your plan supports custom domains.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchDomains(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchDomains]);

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await API.post("/domains", { domain: newDomain.trim() });
      setSuccess(`Domain "${newDomain}" registered! Please set up the TXT record to verify ownership.`);
      setNewDomain("");
      setDomains((prev) => [response.data.data, ...prev]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add domain.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDomain = async (id) => {
    setError("");
    setSuccess("");
    setVerifyingId(id);

    try {
      const response = await API.post(`/domains/${id}/verify`);
      setSuccess(response.data?.message || "Domain verified successfully.");
      setDomains((prev) =>
        prev.map((d) => (d.id === id ? { ...d, verified: true } : d))
      );
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. Ensure the TXT record is propagated.");
    } finally {
      setVerifyingId(null);
    }
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="settings-radius border settings-border settings-surface p-6 shadow-xl">
      <div className="border-b settings-border pb-5">
        <h2 className="text-xl font-bold settings-ink flex items-center gap-2">
          <Globe className="w-5 h-5 settings-accent" /> Custom Domains
        </h2>
        <p className="mt-1 text-xs settings-muted">
          Brand your short links with your own custom domain. (e.g. <code className="settings-accent font-mono">link.yourbrand.com</code>)
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

      {/* Add Domain Form */}
      <form onSubmit={handleAddDomain} className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="e.g. link.mycompany.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="w-full rounded-2xl border settings-border settings-surface px-4 py-3 text-sm settings-ink outline-none focus:border-blue-500"
            disabled={submitting}
            required
          />
        </div>
        <button
          type="submit"
          className="settings-primary hover:bg-blue-500 disabled:opacity-50 settings-ink rounded-2xl px-6 py-3 text-xs font-black tracking-widest uppercase transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>Add Domain</span>
        </button>
      </form>

      {/* Domain Instructions */}
      <div className="mt-6 rounded-2xl border settings-border settings-surface p-4 text-xs settings-muted space-y-2">
        <div className="flex items-center gap-1.5 font-bold settings-ink uppercase text-[10px] tracking-wider">
          <Info className="w-3.5 h-3.5 settings-accent" /> Setup Instructions
        </div>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Add a DNS <code className="settings-ink font-mono settings-surface px-1 rounded">CNAME</code> record pointing your subdomain to <code className="settings-ink font-mono settings-surface px-1 rounded">localhost</code> (or your deployment gateway).</li>
          <li>Add a DNS <code className="settings-ink font-mono settings-surface px-1 rounded">TXT</code> record on your domain containing the verification token shown below.</li>
          <li>Click <code className="settings-ink font-mono">Verify DNS</code> to activate your domain.</li>
        </ol>
      </div>

      {/* Domains List */}
      <div className="mt-8 space-y-4">
        <h3 className="text-xs uppercase tracking-wider settings-muted font-bold">Registered Domains</h3>

        {loading ? (
          <div className="p-8 text-center text-xs settings-muted flex flex-col items-center gap-2 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin settings-accent" />
            <span>Synchronizing domain records...</span>
          </div>
        ) : domains.length === 0 ? (
          <div className="rounded-2xl border settings-border settings-surface p-8 text-center text-xs settings-muted">
            No custom domains added yet.
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="rounded-2xl border settings-border settings-surface p-5 space-y-4 hover:border-white/10 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl settings-surface border settings-border flex items-center justify-center settings-muted">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold settings-ink block">{domain.domain}</span>
                      <span className="text-[10px] settings-muted font-medium">Domain identifier: {domain.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        domain.verified
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                      }`}
                    >
                      {domain.verified ? "Verified" : "Pending Verification"}
                    </span>

                    {!domain.verified && (
                      <button
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={verifyingId === domain.id}
                        className="px-3.5 py-1.5 settings-primary hover:bg-blue-500 disabled:opacity-50 settings-ink rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {verifyingId === domain.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Verify DNS
                      </button>
                    )}
                  </div>
                </div>

                {!domain.verified && domain.verificationToken && (
                  <div className="rounded-xl settings-surface p-3 border settings-border text-[11px] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="truncate pr-4">
                      <span className="settings-muted block uppercase text-[9px] font-sans font-bold tracking-wider mb-0.5">TXT Record Content</span>
                      <span className="settings-ink font-mono select-all">{domain.verificationToken}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(domain.verificationToken, domain.id)}
                      className="p-2 rounded-lg settings-surface hover:bg-slate-700 settings-ink transition duration-150 cursor-pointer shrink-0"
                      title="Copy Token"
                    >
                      {copiedToken === domain.id ? (
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

export default DomainSettings;
