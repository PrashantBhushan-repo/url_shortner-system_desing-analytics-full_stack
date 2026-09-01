import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/urlApi";
import { 
  ShieldCheck, ShieldAlert, Sparkles, Building, Star, Zap, CheckCircle2, 
  CreditCard, Download, Plus, Trash2, Receipt, X, Loader2, ArrowUpRight,
  Calendar, Check, AlertCircle, RefreshCw, Ticket, RotateCcw, FileText, Undo2
} from "lucide-react";

function SubscriptionSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Refund states
  const [refundInvoice, setRefundInvoice] = useState(null);
  const [refundReason, setRefundReason] = useState("Accidental upgrade / wrong plan selected");
  const [refundNote, setRefundNote] = useState("");
  const [refundTermsAgreed, setRefundTermsAgreed] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [showRefundTermsModal, setShowRefundTermsModal] = useState(false);

  // Active Promo Vouchers state
  const [activeVouchers, setActiveVouchers] = useState([]);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([
    { id: "1", type: "card", brand: "Visa", last4: "4242", expiry: "12/28", isDefault: true },
    { id: "2", type: "card", brand: "Mastercard", last4: "8899", expiry: "06/29", isDefault: false },
    { id: "3", type: "upi", brand: "UPI", vpa: "pburls@okaxis", isDefault: false }
  ]);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState("card");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardBrand, setNewCardBrand] = useState("Visa");
  const [newUpiVpa, setNewUpiVpa] = useState("");

  const navigate = useNavigate();

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const subRes = await API.get("/subscription");
      setData(subRes.data?.data || null);
    } catch {
      setError("Failed to fetch subscription status.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const res = await API.get("/subscription/invoices");
      setInvoices(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch invoice history:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchActiveCoupons = async () => {
    try {
      const res = await API.get("/payments/active-coupons");
      setActiveVouchers(res.data?.data || []);
    } catch (err) {
      console.warn("Failed to fetch active coupons:", err);
    }
  };

  useEffect(() => {
    fetchSubscription();
    fetchInvoices();
    fetchActiveCoupons();
  }, []);

  const handleProcessRefund = async (e) => {
    if (e) e.preventDefault();
    if (!refundInvoice) return;
    if (!refundTermsAgreed) {
      setError("Please acknowledge and agree to the refund terms & conditions.");
      return;
    }
    try {
      setSubmittingRefund(true);
      setError("");
      setSuccess("");
      const res = await API.post("/subscription/refund-request", {
        paymentId: refundInvoice.id,
        reason: refundReason,
        note: refundNote.trim(),
      });
      setSuccess(res.data?.message || "Refund processed successfully.");
      setRefundInvoice(null);
      setRefundNote("");
      setRefundTermsAgreed(false);
      await fetchSubscription();
      await fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process refund request.");
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel auto-renewal? You will keep your plan benefits until the end of the current billing cycle.")) {
      return;
    }
    try {
      setSwitching(true);
      setError("");
      setSuccess("");
      const response = await API.post("/subscription/cancel");
      setSuccess(response.data?.message || "Auto-renewal successfully canceled.");
      await fetchSubscription();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel subscription auto-renewal.");
    } finally {
      setSwitching(false);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      setSwitching(true);
      setError("");
      setSuccess("");
      const response = await API.post("/subscription/resume");
      setSuccess(response.data?.message || "Auto-renewal successfully resumed!");
      await fetchSubscription();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resume subscription auto-renewal.");
    } finally {
      setSwitching(false);
    }
  };

  const handleSetDefaultMethod = (id) => {
    setPaymentMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
    setSuccess("Default payment method updated.");
  };

  const handleRemoveMethod = (id) => {
    const target = paymentMethods.find(m => m.id === id);
    if (target?.isDefault) {
      setError("Cannot remove the default payment method. Set another method as default first.");
      return;
    }
    setPaymentMethods(prev => prev.filter(m => m.id !== id));
    setSuccess("Payment method removed.");
  };

  const handleAddPaymentMethod = (e) => {
    e.preventDefault();
    if (newMethodType === "card" && !newCardNumber.trim()) return;
    if (newMethodType === "upi" && !newUpiVpa.trim()) return;

    const newMethod = {
      id: Math.random().toString(36).substring(2, 9),
      type: newMethodType,
      brand: newMethodType === "card" ? newCardBrand : "UPI",
      last4: newMethodType === "card" ? newCardNumber.trim().slice(-4) : undefined,
      expiry: newMethodType === "card" ? newCardExpiry.trim() : undefined,
      vpa: newMethodType === "upi" ? newUpiVpa.trim() : undefined,
      isDefault: paymentMethods.length === 0
    };

    setPaymentMethods([...paymentMethods, newMethod]);
    setShowAddMethodModal(false);
    setNewCardNumber("");
    setNewCardExpiry("");
    setNewUpiVpa("");
    setSuccess("New payment method successfully linked.");
  };

  const getPlanIcon = (key) => {
    switch (key) {
      case "free":
        return <Zap className="h-5 w-5 text-slate-400" />;
      case "starter":
        return <Sparkles className="h-5 w-5 text-indigo-400" />;
      case "pro":
        return <Star className="h-5 w-5 text-[#E50914]" />;
      case "business":
        return <Building className="h-5 w-5 text-emerald-400" />;
      default:
        return <ShieldCheck className="h-5 w-5 text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 bg-zinc-950/60 rounded-3xl border border-zinc-800">
        <Loader2 className="h-9 w-9 animate-spin text-[#E50914]" />
        <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Loading billing and plan details...</span>
      </div>
    );
  }

  const { subscription, plan, limits, usage } = data || {};
  const isCanceled = subscription?.cancelAtPeriodEnd || subscription?.status === "CANCELED" || subscription?.canceled_at;
  const isFree = plan?.key === "free";

  return (
    <div className="space-y-8 font-sans text-slate-200">
      
      {/* Top Banner Alert Notifications */}
      {(success || error) && (
        <div className="space-y-3">
          {success && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300 flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess("")} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs text-rose-300 flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError("")} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: ACTIVE SUBSCRIPTION PLAN & RESOURCE USAGE */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0">
              {getPlanIcon(plan?.key)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  {plan?.name || "Free"} Plan
                </h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border ${
                  isFree 
                    ? "bg-zinc-900 border-zinc-800 text-slate-400" 
                    : "bg-[#E50914]/15 border-[#E50914]/30 text-[#E50914]"
                }`}>
                  {isFree ? "Free Forever" : `Billed ${subscription?.billingCycle || "Monthly"}`}
                </span>
                {isCanceled && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    Cancels at cycle end
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                {plan?.description || "Basic access for individual links with essential redirection speed."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {!isFree && (
              <>
                {isCanceled ? (
                  <button
                    onClick={handleResumeSubscription}
                    disabled={switching}
                    className="px-4 py-2.5 border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${switching ? "animate-spin" : ""}`} />
                    <span>{switching ? "Resuming..." : "Resume Auto-Renewal"}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={switching}
                    className="px-4 py-2.5 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {switching ? "Processing..." : "Cancel Auto-Renewal"}
                  </button>
                )}

                {/* Quick 14-Day Refund Action */}
                {invoices.length > 0 && invoices.some(i => i.status === "CAPTURED") && (
                  <button
                    type="button"
                    onClick={() => {
                      const latestCaptured = invoices.find(i => i.status === "CAPTURED");
                      if (latestCaptured) {
                        setRefundInvoice(latestCaptured);
                        setRefundReason("Accidental upgrade / wrong plan selected");
                        setRefundNote("");
                        setRefundTermsAgreed(false);
                      }
                    }}
                    className="px-4 py-2.5 border border-red-500/40 bg-red-950/25 hover:bg-red-900/40 text-rose-300 hover:text-rose-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>Request Refund</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => navigate("/pricing")}
              className="px-5 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white text-xs font-bold rounded-xl transition shadow-lg shadow-[#E50914]/25 hover:shadow-[#E50914]/40 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>{isFree ? "Upgrade to Pro" : "Change Plan"}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Renewal Schedule Bar */}
        {!isFree && (
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {isCanceled ? "Plan benefits active until: " : "Next billing renewal date: "}
              <strong className="text-white">
                {subscription?.currentPeriodEnd 
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) 
                  : "N/A"}
              </strong>
            </span>
          </div>
        )}

        {/* Active Promotional Discount Offers */}
        {activeVouchers.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-zinc-900/60 to-zinc-900 border border-[#E50914]/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#E50914] animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Special Promotional Discounts Available!
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Click Redeem to auto-apply instant discount on checkout
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {activeVouchers.map((v) => {
                const discountDisplay = v.discount_type === "PERCENT"
                  ? `${v.discount_value}% OFF`
                  : `₹${(v.discount_value / 100).toFixed(0)} FLAT`;

                return (
                  <div key={v.id} className="p-3 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30">
                          {discountDisplay}
                        </span>
                        <span className="font-mono font-bold text-xs text-white tracking-wider">
                          {v.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{v.description || "Limited time promotional deal"}</p>
                    </div>

                    <button
                      onClick={() => navigate(`/pricing?coupon=${v.code}`)}
                      className="px-3 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#F40B16] text-white font-bold text-xs font-mono uppercase tracking-wider shrink-0 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      Redeem
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Systematic Resource Utilization Grid */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
            Plan Resource Utilization
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* URLs Used */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Short URLs</span>
                <span className="font-mono font-bold text-white">
                  {usage?.urlsCount || 0} / {limits?.max_urls || "Unlimited"}
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${limits?.max_urls ? Math.min(100, ((usage?.urlsCount || 0) / limits.max_urls) * 100) : 100}%` }}
                />
              </div>
            </div>

            {/* Team Seats */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Team Seats</span>
                <span className="font-mono font-bold text-white">
                  {usage?.teamMembersCount || 0} / {limits?.team_members_allowed || 0}
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${limits?.team_members_allowed ? Math.min(100, ((usage?.teamMembersCount || 0) / limits.team_members_allowed) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* API Rate Limit */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">API Rate Limit</span>
              <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                {limits?.api_rate_limit_per_min ? `${limits.api_rate_limit_per_min} req / min` : "Standard (60/min)"}
              </div>
            </div>

            {/* Analytics Retention */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Analytics Retention</span>
              <div className="font-mono font-bold text-cyan-400 text-sm mt-1">
                {limits?.analytics_retention_days ? `${limits.analytics_retention_days} Days` : "Lifetime"}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* SECTION 2: PAYMENT METHODS */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#E50914]" />
              Payment Methods
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">Manage credit cards, debit cards, and UPI IDs for renewals and upgrades.</p>
          </div>
          <button
            onClick={() => setShowAddMethodModal(true)}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Add Payment Method</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentMethods.map((m) => (
            <div 
              key={m.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                m.isDefault 
                  ? "bg-zinc-900/90 border-[#E50914]/60 shadow-[0_0_20px_rgba(229,9,20,0.15)]" 
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-zinc-800 rounded-md text-[10px] font-mono font-bold uppercase text-slate-300">
                    {m.brand}
                  </span>
                  {m.isDefault && (
                    <span className="px-2 py-0.5 bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-[9px] font-bold uppercase rounded-md">
                      Default
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveMethod(m.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition cursor-pointer"
                  title="Remove payment method"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                {m.type === "card" ? (
                  <p className="text-sm font-mono font-bold text-white">•••• •••• •••• {m.last4}</p>
                ) : (
                  <p className="text-xs font-mono font-bold text-white truncate">{m.vpa}</p>
                )}
                {m.expiry && (
                  <p className="text-[10px] text-slate-400 font-mono">Expires: {m.expiry}</p>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                {!m.isDefault ? (
                  <button
                    onClick={() => handleSetDefaultMethod(m.id)}
                    className="text-xs text-[#E50914] hover:text-[#F40B16] font-bold transition cursor-pointer"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" /> Default Method
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: INVOICE & BILLING HISTORY & REFUNDS */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#E50914]" />
              Billing, Invoices &amp; Refund Management
            </h4>
            <p className="text-xs text-slate-400">View receipts, print transaction invoices, and initiate 14-day policy refunds.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRefundTermsModal(true)}
            className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-zinc-900 hover:bg-zinc-850 text-slate-300 hover:text-white text-xs font-bold font-mono transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 text-[#E50914]" />
            <span>Refund Policy &amp; Terms</span>
          </button>
        </div>

        {/* 14-Day Satisfaction Guarantee Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">100% Risk-Free 14-Day Money-Back Guarantee</p>
              <p className="text-[11px] text-slate-300">All subscription plan upgrades are eligible for a full refund within 14 days of purchase. No penalty fees.</p>
            </div>
          </div>
        </div>

        {loadingInvoices ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#E50914]" />
            <span className="text-xs text-slate-400 font-mono">Loading transaction records...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
            <Receipt className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-300">No invoices yet.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Your payment receipts and invoices will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider bg-zinc-900/40">
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Receipt ID</th>
                  <th className="py-3 px-4 font-bold">Plan Description</th>
                  <th className="py-3 px-4 font-bold">Amount</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-slate-300 font-mono text-xs">
                {invoices.map((inv) => {
                  const daysOld = (new Date().getTime() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24);
                  const isRefundEligible = inv.status === "CAPTURED" && daysOld <= 14;

                  return (
                    <tr key={inv.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-3 px-4 text-slate-400">{new Date(inv.created_at).toLocaleDateString("en-GB")}</td>
                      <td className="py-3 px-4 text-white font-bold">{inv.gateway_order_id}</td>
                      <td className="py-3 px-4 capitalize text-slate-200">
                        {inv.plan?.name || "Pro"} Plan ({inv.billing_cycle?.toLowerCase() || "yearly"})
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">₹{(inv.amount / 100).toFixed(0)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          inv.status === "CAPTURED" 
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
                            : inv.status === "REFUNDED"
                            ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                            : inv.status === "FAILED" 
                            ? "bg-rose-500/15 border-rose-500/30 text-rose-400" 
                            : "bg-zinc-800 border-zinc-700 text-slate-400"
                        }`}>
                          {inv.status === "REFUNDED" ? "✓ REFUNDED" : inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          {inv.status === "CAPTURED" && (
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white hover:underline cursor-pointer"
                            >
                              <Download className="h-3 w-3" /> Receipt
                            </button>
                          )}

                          {isRefundEligible && (
                            <button
                              onClick={() => {
                                setRefundInvoice(inv);
                                setRefundReason("Accidental upgrade / wrong plan selected");
                                setRefundNote("");
                                setRefundTermsAgreed(false);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#E50914] hover:text-[#F40B16] hover:underline cursor-pointer bg-red-950/20 hover:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-900/30 transition"
                              title="Request full refund within 14-day window"
                            >
                              <RotateCcw className="h-3 w-3" /> Request Refund
                            </button>
                          )}

                          {inv.status === "REFUNDED" && (
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
                            >
                              <Receipt className="h-3 w-3" /> Credit Note
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice receipt print popup modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-[#E50914] uppercase tracking-wider">Transaction Receipt</span>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 font-mono text-xs text-slate-300">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white font-sans uppercase">PBUrls Platform</h3>
                <p className="text-[10px] text-slate-400 font-sans">billing@pburls.online</p>
              </div>

              <div className="border-y border-zinc-800 py-3.5 space-y-2 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-400">Invoice ID</span><span className="text-white font-bold">{selectedInvoice.id}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Order ID</span><span className="text-white font-bold">{selectedInvoice.gateway_order_id}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Billing Cycle</span><span className="text-white uppercase">{selectedInvoice.billing_cycle}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="text-white">{new Date(selectedInvoice.created_at).toLocaleString("en-GB")}</span></div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-white uppercase text-[10px] pb-1 border-b border-zinc-800">
                  <span>Item</span><span>Qty</span><span>Price</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="capitalize">{selectedInvoice.plan?.name || "Pro"} Plan Subscription</span>
                  <span>1</span>
                  <span>₹{(selectedInvoice.amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-3 flex justify-between font-black text-white text-sm">
                <span>Amount Paid</span>
                <span className="text-emerald-400">₹{(selectedInvoice.amount / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-5 bg-zinc-900 border-t border-zinc-800 flex gap-3">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-1/2 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="w-1/2 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-[#E50914]/25"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddMethodModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddPaymentMethod} className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-xs font-bold text-white uppercase">Add Payment Method</span>
              <button type="button" onClick={() => setShowAddMethodModal(false)} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setNewMethodType("card")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition ${
                    newMethodType === "card" 
                      ? "bg-[#E50914] text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Credit / Debit Card
                </button>
                <button
                  type="button"
                  onClick={() => setNewMethodType("upi")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition ${
                    newMethodType === "upi" 
                      ? "bg-[#E50914] text-white shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  UPI ID
                </button>
              </div>

              {newMethodType === "card" ? (
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Card Number</label>
                    <input
                      type="text"
                      required
                      value={newCardNumber}
                      onChange={(e) => setNewCardNumber(e.target.value)}
                      placeholder="4111 2222 3333 4444"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E50914] text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={newCardExpiry}
                        onChange={(e) => setNewCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E50914] text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">Network</label>
                      <select
                        value={newCardBrand}
                        onChange={(e) => setNewCardBrand(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E50914] text-xs font-mono"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Rupay">Rupay</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <label className="text-[10px] text-slate-400 uppercase font-mono font-bold">UPI VPA Address</label>
                  <input
                    type="text"
                    required
                    value={newUpiVpa}
                    onChange={(e) => setNewUpiVpa(e.target.value)}
                    placeholder="username@bank"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E50914] text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddMethodModal(false)}
                className="w-1/2 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-[#E50914]/25"
              >
                Save Method
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request Refund Modal */}
      {refundInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleProcessRefund} className="max-w-lg w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-[#E50914]" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Request 14-Day Guarantee Refund
                </span>
              </div>
              <button type="button" onClick={() => setRefundInvoice(null)} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-300 font-sans">
              {/* Invoice Summary Pill */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Receipt ID:</span>
                  <span className="text-white font-bold">{refundInvoice.gateway_order_id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Plan Purchased:</span>
                  <span className="text-white font-bold capitalize">{refundInvoice.plan?.name || "Pro"} Plan ({refundInvoice.billing_cycle})</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Purchase Date:</span>
                  <span className="text-white">{new Date(refundInvoice.created_at).toLocaleDateString("en-GB")}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1.5 border-t border-zinc-800">
                  <span>Eligible Refund:</span>
                  <span className="text-emerald-400 font-bold text-sm">₹{(refundInvoice.amount / 100).toFixed(0)}</span>
                </div>
              </div>

              {/* Policy Notification */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>14-Day Money-Back Guarantee:</strong> Your full payment of ₹{(refundInvoice.amount / 100).toFixed(0)} will be credited back to your original payment method within 5–7 business days.
                </span>
              </div>

              {/* Refund Reason Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  Reason for Refund Request *
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E50914]"
                >
                  <option value="Accidental upgrade / wrong plan selected">Accidental upgrade / wrong plan selected</option>
                  <option value="Missing features required for my workflow">Missing features required for my workflow</option>
                  <option value="Performance or redirection speed issue">Performance or redirection speed issue</option>
                  <option value="Switching to a different solution">Switching to a different solution</option>
                  <option value="Other billing question / feedback">Other billing question / feedback</option>
                </select>
              </div>

              {/* Additional Feedback Textarea */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  Additional Feedback (Optional)
                </label>
                <textarea
                  rows={2}
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  placeholder="Help us improve: tell us what we could have done better..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-[#E50914] resize-none"
                />
              </div>

              {/* Downgrade Terms Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={refundTermsAgreed}
                  onChange={(e) => setRefundTermsAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 text-[#E50914] focus:ring-[#E50914] cursor-pointer"
                />
                <span className="text-[11px] text-slate-300 leading-snug">
                  I acknowledge that upon refund processing, my active paid subscription will be cancelled and my account will safely revert to the <strong>Free Plan</strong> without losing my created short links.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex gap-3">
              <button
                type="button"
                onClick={() => setRefundInvoice(null)}
                className="w-1/2 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRefund || !refundTermsAgreed}
                className="w-1/2 py-2.5 bg-[#E50914] hover:bg-[#F40B16] disabled:bg-zinc-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-[#E50914]/25 flex items-center justify-center gap-1.5 uppercase font-mono tracking-wider"
              >
                {submittingRefund ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Refund</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refund Policy & Terms Modal */}
      {showRefundTermsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Refund Policy &amp; Terms of Service
                </span>
              </div>
              <button onClick={() => setShowRefundTermsModal(false)} className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto leading-relaxed">
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">1. 14-Day Money-Back Guarantee</h4>
                <p className="text-slate-400">
                  PBUrls offers a 100% risk-free 14-day refund policy for all subscription plan purchases (Starter, Pro, and Business). If you are dissatisfied for any reason within 14 calendar days of your transaction, you may request a complete refund directly through your account dashboard.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">2. Settlement &amp; Bank Timelines</h4>
                <p className="text-slate-400">
                  Once initiated, refunds are processed via our payment gateway (Razorpay) and credited back to the original source payment method (Credit Card, Debit Card, UPI, or NetBanking). Bank clearance usually reflects within 5 to 7 working days depending on your financial institution.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">3. Plan Reversion &amp; Link Preservation</h4>
                <p className="text-slate-400">
                  Upon refund completion, your account is transitioned back to the default Free Tier. All previously generated short URLs and analytics telemetry will remain securely stored in your account up to standard Free tier retention parameters.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">4. Renewal Cancellation vs. Immediate Refund</h4>
                <p className="text-slate-400">
                  If you cancel auto-renewal after the 14-day window, you will continue to enjoy your paid tier features until the conclusion of your active billing period without further scheduled charges.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">5. Dedicated Billing Support</h4>
                <p className="text-slate-400">
                  Have special invoicing requirements or billing questions? Contact our team directly at <span className="text-white font-mono font-bold">billing@pburls.online</span> or <span className="text-white font-mono font-bold">support@pburls.online</span>.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowRefundTermsModal(false)}
                className="px-6 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-[#E50914]/25"
              >
                Understood &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SubscriptionSettings;
