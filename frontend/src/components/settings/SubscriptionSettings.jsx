import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/urlApi";
import { useAuth } from "../../context/AuthContext";
import { ShieldCheck, ShieldAlert, Sparkles, Building, Star, Zap, CheckCircle2, CreditCard, Download, Plus, Trash2, Receipt, X, Loader2, ArrowUpRight } from "lucide-react";

function SubscriptionSettings({ setActiveTab }) {
  const { user: authUser } = useAuth();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null); // invoice modal

  // Payment methods mock state
  const [paymentMethods, setPaymentMethods] = useState([
    { id: "1", type: "card", brand: "visa", last4: "4242", expiry: "12/28", isDefault: true },
    { id: "2", type: "card", brand: "mastercard", last4: "8899", expiry: "06/29", isDefault: false },
    { id: "3", type: "upi", brand: "upi", vpa: "snapurl@okaxis", isDefault: false }
  ]);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState("card");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardBrand, setNewCardBrand] = useState("visa");
  const [newUpiVpa, setNewUpiVpa] = useState("");

  const navigate = useNavigate();

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        API.get("/subscription"),
        API.get("/plans")
      ]);
      setData(subRes.data?.data || null);
      setPlans(plansRes.data?.data || []);
    } catch (err) {
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

  useEffect(() => {
    fetchSubscription();
    fetchInvoices();
  }, []);

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription auto-renewal? You will retain your benefits until the end of your current billing cycle.")) {
      return;
    }
    try {
      setSwitching(true);
      setError("");
      setSuccess("");
      const response = await API.post("/subscription/cancel");
      setSuccess(response.data?.message || "Auto-renewal successfully scheduled for cancellation.");
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

  const handlePlanChange = async (planKey) => {
    try {
      setSwitching(true);
      setError("");
      setSuccess("");
      const response = await API.post("/subscription/change", { planKey });
      setSuccess(response.data?.message || "Plan updated successfully!");
      await fetchSubscription();
      await fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to switch plan.");
    } finally {
      setSwitching(false);
    }
  };

  // Payment methods simulation triggers
  const handleSetDefaultMethod = (id) => {
    setPaymentMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
    setSuccess("Default payment method updated.");
  };

  const handleRemoveMethod = (id) => {
    const target = paymentMethods.find(m => m.id === id);
    if (target?.isDefault) {
      setError("Cannot remove the default payment method. Set another card as default first.");
      return;
    }
    setPaymentMethods(prev => prev.filter(m => m.id !== id));
    setSuccess("Payment method removed.");
  };

  const handleAddPaymentMethod = (e) => {
    e.preventDefault();
    if (newMethodType === "card" && !newCardNumber) return;
    if (newMethodType === "upi" && !newUpiVpa) return;

    const newMethod = {
      id: Math.random().toString(36).substr(2, 9),
      type: newMethodType,
      brand: newMethodType === "card" ? newCardBrand : "upi",
      last4: newMethodType === "card" ? newCardNumber.slice(-4) : undefined,
      expiry: newMethodType === "card" ? newCardExpiry : undefined,
      vpa: newMethodType === "upi" ? newUpiVpa : undefined,
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
        return <Star className="h-5 w-5 text-[#E50914] animate-pulse" />;
      case "business":
        return <Building className="h-5 w-5 text-emerald-400" />;
      default:
        return <ShieldCheck className="h-5 w-5 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-[#E50914]" />
        <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">RETRIEVING BILLING METRICS...</span>
      </div>
    );
  }

  const { subscription, plan, limits, usage } = data || {};
  const isCanceled = subscription?.cancelAtPeriodEnd || subscription?.status === "CANCELED" || subscription?.canceled_at;
  const isFree = plan?.key === "free";

  // Find default payment method
  const defaultMethod = paymentMethods.find(m => m.isDefault);

  return (
    <div className="space-y-10 font-sans text-slate-200">
      
      {/* Page Title */}
      <div className="pb-4 border-b border-[#222]">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">Account Membership & Billing</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono uppercase">MANAGE BILLING PARAMETERS & SUBSCRIPTION TIERS</p>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-300 flex items-center gap-2 font-mono">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: MEMBERSHIP & BILLING */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4 border-b border-[#222] items-start">
        {/* Left Column: Category */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Membership & Billing</h3>
          
          {/* Cancel/Resume Button located on the left, matching Netflix standard */}
          {!isFree && (
            <div className="pt-2">
              {isCanceled ? (
                <button
                  onClick={handleResumeSubscription}
                  disabled={switching}
                  className="w-full text-center py-2 px-3 border border-emerald-600/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 text-[10px] font-black tracking-wider uppercase rounded-xl transition cursor-pointer"
                >
                  {switching ? "Processing..." : "Resume Renewal"}
                </button>
              ) : (
                <button
                  onClick={handleCancelSubscription}
                  disabled={switching}
                  className="w-full text-center py-2 px-3 border border-rose-950/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 text-[10px] font-black tracking-wider uppercase rounded-xl transition cursor-pointer"
                >
                  {switching ? "Processing..." : "Cancel Plan"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sub-Details */}
        <div className="md:col-span-3 divide-y divide-[#111] bg-slate-900/10 rounded-2xl border border-white/5 px-6 py-2">
          {/* Row 1: Email and password */}
          <div className="flex justify-between items-center py-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Primary Account Email</span>
              <span className="text-sm font-bold text-white">{authUser?.email || "Not Available"}</span>
            </div>
            <button
              onClick={() => setActiveTab && setActiveTab("profile")}
              className="text-[#E50914] hover:text-[#F40B16] font-bold uppercase text-[10px] tracking-wider transition cursor-pointer"
            >
              Change Email
            </button>
          </div>

          <div className="flex justify-between items-center py-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Account Security credentials</span>
              <span className="text-sm text-slate-400 font-mono">Password: ••••••••••••</span>
            </div>
            <button
              onClick={() => setActiveTab && setActiveTab("password")}
              className="text-[#E50914] hover:text-[#F40B16] font-bold uppercase text-[10px] tracking-wider transition cursor-pointer"
            >
              Change Password
            </button>
          </div>

          {/* Row 2: Default Payment Method */}
          <div className="flex justify-between items-center py-4 text-xs">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Active payment method</span>
              {defaultMethod ? (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4.5 w-4.5 text-slate-400" />
                  <span className="text-sm font-bold text-white capitalize font-mono">
                    {defaultMethod.brand} {defaultMethod.type === "card" ? `•••• •••• •••• ${defaultMethod.last4}` : defaultMethod.vpa}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-400 font-bold">No active payment method linked</span>
              )}
            </div>
            <button
              onClick={() => {
                document.getElementById("payment-methods-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[#E50914] hover:text-[#F40B16] font-bold uppercase text-[10px] tracking-wider transition cursor-pointer"
            >
              Manage Payment Info
            </button>
          </div>

          {/* Row 3: Next billing details */}
          <div className="flex justify-between items-center py-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">
                {isCanceled ? "Membership Expiration date" : "Next auto-renewal date"}
              </span>
              <span className="text-sm font-bold text-white">
                {isFree ? "No upcoming renewals (Free Forever)" : (
                  <>
                    {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    }) : "Never"}
                    {isCanceled && <span className="text-rose-400 font-mono ml-2 text-[10px] uppercase font-bold">(Canceling)</span>}
                  </>
                )}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase font-bold">
              {isFree ? "Free Tier" : `Billed ${subscription?.billingCycle || "MONTHLY"}`}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PLAN DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4 border-b border-[#222] items-start">
        {/* Left Column: Category */}
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Plan Details</h3>
        </div>

        {/* Right Column: Sub-Details */}
        <div className="md:col-span-3 bg-slate-900/10 rounded-2xl border border-white/5 p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-black text-white uppercase tracking-tight">{plan?.name} Tier Plan</h4>
                <div className="p-1.5 rounded-lg bg-slate-950 border border-white/5">
                  {getPlanIcon(plan?.key)}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md">{plan?.description}</p>
            </div>

            {/* UPGRADE PLAN Button - highly prominent, Netflix style */}
            <button
              onClick={() => navigate("/pricing")}
              className="bg-[#E50914] hover:bg-[#F40B16] text-white py-2.5 px-5 text-xs font-black tracking-wider uppercase rounded-xl transition duration-150 cursor-pointer shadow-[0_0_20px_rgba(229,9,20,0.3)] hover:shadow-[0_0_30px_rgba(229,9,20,0.5)] flex items-center gap-1.5 hover:scale-105 active:scale-95 animate-pulse"
            >
              <span>Upgrade Plan</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[3px]" />
            </button>
          </div>

          {/* Plan Limits - Industrial Visuals */}
          <div className="pt-4 border-t border-[#111] space-y-4">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block">CURRENT PLAN USAGE ENTITLEMENTS</span>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Limit Item 1: URLs */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px]">Short URLs Generated</span>
                  <span className="text-white font-bold">{usage?.urlsCount || 0} / {limits?.max_urls || "∞"}</span>
                </div>
                {limits?.max_urls ? (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-[#E50914] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((usage?.urlsCount || 0) / limits.max_urls) * 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 w-full rounded-full" />
                  </div>
                )}
              </div>

              {/* Limit Item 2: Team seats */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px]">Team Workspace Seats</span>
                  <span className="text-white font-bold">{usage?.teamMembersCount || 0} / {limits?.team_members_allowed || 0} seats</span>
                </div>
                {limits?.team_members_allowed && limits.team_members_allowed > 0 ? (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#E50914] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((usage?.teamMembersCount || 0) / limits.team_members_allowed) * 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 w-0 rounded-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Flat tags for minor limits */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2.5 py-1 bg-slate-950/60 border border-white/5 rounded-lg text-[9px] font-mono uppercase text-slate-400">
                Retention: <strong className="text-slate-200">{limits?.analytics_retention_days ? `${limits.analytics_retention_days} Days` : "Lifetime"}</strong>
              </span>
              <span className="px-2.5 py-1 bg-slate-950/60 border border-white/5 rounded-lg text-[9px] font-mono uppercase text-slate-400">
                API Rate: <strong className="text-slate-200">{limits?.api_rate_limit_per_min ? `${limits.api_rate_limit_per_min} req/min` : "Disabled"}</strong>
              </span>
              <span className="px-2.5 py-1 bg-slate-950/60 border border-white/5 rounded-lg text-[9px] font-mono uppercase text-slate-400">
                REST API Webhooks: <strong className={limits?.webhooks_allowed ? "text-emerald-400" : "text-rose-400"}>{limits?.webhooks_allowed ? "ENABLED" : "DISABLED"}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SAVED PAYMENT METHODS */}
      <div id="payment-methods-section" className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4 border-b border-[#222] items-start">
        {/* Left Column: Category */}
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Payment Methods</h3>
        </div>

        {/* Right Column: Sub-Details */}
        <div className="md:col-span-3 space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Linked Cards & VPA Gateways</h4>
            <button
              onClick={() => setShowAddMethodModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-200 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition"
            >
              <Plus className="h-3.5 w-3.5" /> Link Method
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paymentMethods.map((m) => (
              <div 
                key={m.id}
                className={`rounded-2xl border p-4 bg-slate-950/40 backdrop-blur-md flex flex-col justify-between min-h-[120px] transition duration-200 ${
                  m.isDefault ? "border-[#E50914] shadow-[0_0_15px_rgba(229,9,20,0.15)]" : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-950 rounded-lg text-slate-300 border border-white/5 font-mono text-[9px] uppercase font-bold tracking-wider">
                      {m.brand}
                    </div>
                    {m.isDefault && (
                      <span className="rounded bg-[#E50914]/10 border border-[#E50914]/20 text-[#E50914] px-1.5 py-0.5 text-[8px] font-black uppercase font-mono tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMethod(m.id)}
                    className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  {m.type === "card" ? (
                    <p className="text-xs font-mono text-slate-200 tracking-wider">•••• •••• •••• {m.last4}</p>
                  ) : (
                    <p className="text-xs font-mono text-slate-200 truncate">{m.vpa}</p>
                  )}
                  {m.expiry && <p className="text-[9px] font-mono text-slate-500 mt-1">Expiry: {m.expiry}</p>}
                </div>

                {!m.isDefault && (
                  <button
                    onClick={() => handleSetDefaultMethod(m.id)}
                    className="text-[10px] font-bold text-[#E50914] hover:text-[#F40B16] transition mt-3 text-left w-max cursor-pointer uppercase tracking-wider font-mono text-[9px]"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: BILLING HISTORY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4 items-start">
        {/* Left Column: Category */}
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Billing History</h3>
        </div>

        {/* Right Column: Sub-Details */}
        <div className="md:col-span-3 space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Invoice Ledger Receipts</h4>
          
          <div className="overflow-x-auto bg-slate-900/10 rounded-2xl border border-white/5 p-4">
            {loadingInvoices ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#E50914]" />
                <span className="text-[10px] font-mono text-slate-500">RETRIEVING TRANSACTION ENTRIES</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400 font-sans">No transactions recorded.</p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">PAYMENT ENTRIES FROM INVOICING FLOWS WILL RENDER HERE</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#111] text-slate-500 font-mono text-[9px] uppercase">
                    <th className="py-3 font-normal">Created At</th>
                    <th className="py-3 font-normal">Order Receipt</th>
                    <th className="py-3 font-normal">Description</th>
                    <th className="py-3 font-normal">Amount</th>
                    <th className="py-3 font-normal text-center">Status</th>
                    <th className="py-3 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111] text-slate-300 font-medium font-mono">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-950/20">
                      <td className="py-3.5 text-slate-400">{new Date(inv.created_at).toLocaleDateString("en-GB")}</td>
                      <td className="py-3.5 text-slate-300 truncate max-w-[120px]">{inv.gateway_order_id}</td>
                      <td className="py-3.5 capitalize text-slate-200">{inv.plan?.name || "Tier Plan"} ({inv.billing_cycle.toLowerCase()})</td>
                      <td className="py-3.5 text-slate-200">₹{(inv.amount / 100).toFixed(0)}</td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${
                          inv.status === "CAPTURED" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" :
                          inv.status === "FAILED" ? "bg-rose-500/10 border border-rose-500/20 text-rose-400" :
                          "bg-slate-800 border border-white/5 text-slate-400"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        {inv.status === "CAPTURED" && (
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider text-[#E50914] uppercase hover:underline cursor-pointer"
                          >
                            <Download className="h-3 w-3" /> View Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Invoice receipt print popup modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0d0d12] border border-[#222] rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center">
              <span className="text-[10px] font-mono text-[#E50914] font-black uppercase tracking-widest">TRANSACTION RECEIPT</span>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 font-mono text-xs text-slate-300">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white font-sans uppercase">SnapURL Redirects</h3>
                <p className="text-[10px] text-slate-500">Nagpur Division, Maharashtra, India</p>
                <p className="text-[10px] text-slate-500 font-sans">billing@snapurl.in</p>
              </div>

              <div className="border-y border-[#222] py-4 space-y-2 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-500">Invoice ID</span><span className="text-slate-300">{selectedInvoice.id}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Order ID</span><span className="text-slate-300">{selectedInvoice.gateway_order_id}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment ID</span><span className="text-slate-300">{selectedInvoice.gateway_payment_id || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Billing Cycle</span><span className="text-slate-300 uppercase">{selectedInvoice.billing_cycle}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment Date</span><span className="text-slate-300">{new Date(selectedInvoice.created_at).toLocaleString("en-GB")}</span></div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-bold"><span className="text-white font-sans">Subscription Plan</span><span>Qty</span><span>Price</span></div>
                <div className="flex justify-between text-slate-400">
                  <span className="capitalize">{selectedInvoice.plan?.name} Tier Plan</span>
                  <span>1</span>
                  <span>₹{(selectedInvoice.amount / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-[#222] pt-4 flex justify-between font-bold text-white">
                <span className="font-sans uppercase">Total Billed</span>
                <span>₹{(selectedInvoice.amount / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-6 bg-slate-950 border-t border-white/5 flex gap-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-1/2 py-2.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="w-1/2 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddMethodModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddPaymentMethod} className="max-w-md w-full bg-[#0d0d12] border border-[#222] rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-slate-950 border-b border-white/5 flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider font-mono text-white">LINK NEW PAYMENT METHOD</span>
              <button type="button" onClick={() => setShowAddMethodModal(false)} className="text-slate-500 hover:text-white cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewMethodType("card")}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    newMethodType === "card" ? "bg-[#E50914]/10 border-[#E50914] text-[#E50914]" : "bg-slate-950 border-white/5 text-slate-400"
                  }`}
                >
                  Credit Card
                </button>
                <button
                  type="button"
                  onClick={() => setNewMethodType("upi")}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    newMethodType === "upi" ? "bg-[#E50914]/10 border-[#E50914] text-[#E50914]" : "bg-slate-950 border-white/5 text-slate-400"
                  }`}
                >
                  UPI VPA
                </button>
              </div>

              {newMethodType === "card" ? (
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-mono">Card Number</label>
                    <input
                      type="text"
                      required
                      value={newCardNumber}
                      onChange={(e) => setNewCardNumber(e.target.value)}
                      placeholder="4111 2222 3333 4444"
                      className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Expiry</label>
                      <input
                        type="text"
                        required
                        value={newCardExpiry}
                        onChange={(e) => setNewCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Brand</label>
                      <select
                        value={newCardBrand}
                        onChange={(e) => setNewCardBrand(e.target.value)}
                        className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                      >
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="rupay">Rupay</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <label className="text-[10px] text-slate-500 uppercase font-mono">UPI Virtual ID</label>
                  <input
                    type="text"
                    required
                    value={newUpiVpa}
                    onChange={(e) => setNewUpiVpa(e.target.value)}
                    placeholder="name@okaxis"
                    className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-white/5 flex gap-4">
              <button
                type="button"
                onClick={() => setShowAddMethodModal(false)}
                className="w-1/2 py-2.5 bg-slate-900 border border-white/5 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Link Account
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

export default SubscriptionSettings;
