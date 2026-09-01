import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/urlApi";
import { useAuth } from "../context/AuthContext";
import { Check, ShieldCheck, Zap, Star, ShieldAlert, Sparkles, Building, ArrowLeft, Ticket, Loader2, CreditCard, X, Smartphone, Globe, Activity, Lock, Cpu, Database, Users, Copy, Tag, Percent, Flame, FileText } from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [currentSub, setCurrentSub] = useState(null);
  const [billingCycle, setBillingCycle] = useState("MONTHLY"); // MONTHLY, QUARTERLY, YEARLY
  
  // Coupon & Vouchers states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountType, discountValue, description }
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [activeVouchers, setActiveVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");
  const [showRefundTermsModal, setShowRefundTermsModal] = useState(false);

  // Checkout loading status
  const [checkoutLoading, setCheckoutLoading] = useState(null); // planKey
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Mock Payment Modal states
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrder, setMockOrder] = useState(null); // { orderId, amount, currency, planKey, paymentId }
  const [mockPaymentMethod, setMockPaymentMethod] = useState("card"); // card, upi, wallet
  const [mockCardNumber, setMockCardNumber] = useState("4111 2222 3333 4444");
  const [mockCardName] = useState(user?.name || "CARDHOLDER NAME");
  const [mockCardExpiry, setMockCardExpiry] = useState("12/29");
  const [mockCardCvv, setMockCardCvv] = useState("123");
  const [mockUpiId, setMockUpiId] = useState(user?.email ? `${user.email.split("@")[0]}@okaxis` : "pburls@okaxis");

  // Post checkout status overlays
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success', 'failed'
  const [paymentError, setPaymentError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await API.get("/plans");
        setPlans(response.data?.data || []);
      } catch {
        setError("Failed to load subscription plans. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const fetchActiveCoupons = async () => {
      try {
        setLoadingVouchers(true);
        const res = await API.get("/payments/active-coupons");
        setActiveVouchers(res.data?.data || []);
      } catch (err) {
        console.warn("Failed to fetch active coupons:", err);
      } finally {
        setLoadingVouchers(false);
      }
    };

    fetchPlans();
    fetchActiveCoupons();
  }, []);

  useEffect(() => {
    if (user) {
      API.get("/subscription")
        .then((res) => {
          setCurrentSub(res.data?.data || null);
        })
        .catch(() => {
          // Ignore
        });
    }
  }, [user]);

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
        return <ShieldCheck className="h-5 w-5 text-slate-400" />;
    }
  };

  const getPlanColor = (key) => {
    switch (key) {
      case "free":
        return "border-[#222] hover:border-[#444]";
      case "starter":
        return "border-[#222] hover:border-indigo-900/30";
      case "pro":
        return "border-[#E50914]/50 shadow-[0_0_50px_rgba(229,9,20,0.15)] bg-slate-950/80";
      case "business":
        return "border-[#222] hover:border-emerald-900/30";
      default:
        return "border-[#222]";
    }
  };

  const getDisplayPrice = (plan) => {
    if (plan.price_monthly === 0) return 0;
    
    let basePrice = plan.price_monthly;
    if (billingCycle === "QUARTERLY" && plan.price_quarterly) {
      basePrice = plan.price_quarterly;
    } else if (billingCycle === "YEARLY" && plan.price_yearly) {
      basePrice = plan.price_yearly;
    } else {
      if (billingCycle === "QUARTERLY") basePrice = plan.price_monthly * 3;
      if (billingCycle === "YEARLY") basePrice = plan.price_monthly * 12;
    }

    if (appliedCoupon) {
      const isApplicable = appliedCoupon.applicablePlans?.length === 0 || 
                           appliedCoupon.applicablePlans?.includes(plan.key) || 
                           !appliedCoupon.applicablePlans;
      if (isApplicable) {
        if (appliedCoupon.discountType === "PERCENT") {
          const discount = Math.round((basePrice * appliedCoupon.discountValue) / 100);
          return Math.max(0, basePrice - discount);
        } else if (appliedCoupon.discountType === "FLAT") {
          return Math.max(0, basePrice - appliedCoupon.discountValue);
        }
      }
    }

    return basePrice;
  };

  const getOriginalPriceDisplay = (plan) => {
    let basePrice = plan.price_monthly;
    if (billingCycle === "QUARTERLY" && plan.price_quarterly) {
      basePrice = plan.price_quarterly;
    } else if (billingCycle === "YEARLY" && plan.price_yearly) {
      basePrice = plan.price_yearly;
    } else {
      if (billingCycle === "QUARTERLY") basePrice = plan.price_monthly * 3;
      if (billingCycle === "YEARLY") basePrice = plan.price_monthly * 12;
    }
    return `₹${(basePrice / 100).toFixed(0)}`;
  };

  const getMonthlyEquivalent = (plan, calculatedPrice) => {
    let divisor = 1;
    if (billingCycle === "QUARTERLY") divisor = 3;
    if (billingCycle === "YEARLY") divisor = 12;
    return `₹${(calculatedPrice / (divisor * 100)).toFixed(0)}`;
  };

  const getSavings = (plan) => {
    if (plan.key === "free") return null;
    const monthlyTotal = plan.price_monthly * (billingCycle === "QUARTERLY" ? 3 : 12);
    const actualPrice = billingCycle === "QUARTERLY" ? plan.price_quarterly : plan.price_yearly;
    if (!actualPrice) return null;
    const savings = Math.round(((monthlyTotal - actualPrice) / monthlyTotal) * 100);
    return savings > 0 ? `Save ${savings}%` : null;
  };

  const handleValidateCoupon = async (overrideCode) => {
    const code = (typeof overrideCode === "string" ? overrideCode : couponCode).trim();
    if (!code) return;
    try {
      setValidatingCoupon(true);
      setCouponError("");
      const response = await API.post("/payments/validate-coupon", {
        couponCode: code,
        planKey: "pro", 
      });
      
      const coupon = response.data?.data;
      setAppliedCoupon({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
        applicablePlans: coupon.applicablePlans,
      });
      setCouponCode(coupon.code);
    } catch (err) {
      setCouponError(err.response?.data?.message || "Invalid coupon code.");
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleCopyCode = (code) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2200);
  };

  // Auto-apply query param code if present in URL (e.g. /pricing?coupon=PBURLS50)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramCoupon = params.get("coupon");
    if (paramCoupon && !appliedCoupon) {
      setCouponCode(paramCoupon.toUpperCase().trim());
      handleValidateCoupon(paramCoupon.toUpperCase().trim());
    }
  }, [plans]);

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const handleDowngradeToFree = async () => {
    if (!confirm("Are you sure you want to downgrade to the Free plan? Your paid benefits will end immediately.")) {
      return;
    }
    try {
      setCheckoutLoading("free");
      await API.post("/subscription/change", {
        planKey: "free",
        billingCycle: "MONTHLY",
      });
      setPaymentStatus("success");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to downgrade subscription.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleUpgrade = async (planKey) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      setCheckoutLoading(planKey);
      
      // 1. Create order on backend
      const orderRes = await API.post("/payments/create-order", {
        planKey,
        billingCycle,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      });

      if (orderRes.data?.zeroCharge) {
        setPaymentStatus("success");
        return;
      }

      const orderData = orderRes.data.data;
      
      if (orderData.isMock) {
        // Trigger simulated payment flow
        setMockOrder({
          orderId: orderData.orderId,
          amount: orderData.amount,
          currency: orderData.currency,
          planKey,
          paymentId: orderData.paymentId,
        });
        setShowMockModal(true);
        return;
      }

      // Normal Razorpay Integration if keys are present
      const scriptLoaded = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!scriptLoaded) {
        alert("Failed to load payment gateway script. Please try again.");
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "PBUrls Subscription",
        description: `Upgrade to ${planKey.toUpperCase()} (${billingCycle})`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            setVerifyingPayment(true);
            const verifyRes = await API.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              setPaymentStatus("success");
            }
          } catch (verifyErr) {
            setPaymentStatus("failed");
            setPaymentError(verifyErr.response?.data?.message || "Signature verification failed.");
          } finally {
            setVerifyingPayment(false);
          }
        },
        prefill: {
          name: user.name || "",
          email: user.email || "",
        },
        theme: {
          color: "#E50914",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setPaymentStatus("failed");
      setPaymentError(err.response?.data?.message || "Order creation failed.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Mock checkout simulation handles
  const handleMockPaySuccess = async () => {
    try {
      setVerifyingPayment(true);
      setShowMockModal(false);
      
      const verifyRes = await API.post("/payments/mock-verify", {
        orderId: mockOrder.orderId,
        paymentId: `pay_mock_${Math.random().toString(36).substr(2, 9)}`,
      });

      if (verifyRes.data.success) {
        setPaymentStatus("success");
      }
    } catch (err) {
      setPaymentStatus("failed");
      setPaymentError(err.response?.data?.message || "Failed to verify mock payment.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleMockPayFail = async () => {
    try {
      setVerifyingPayment(true);
      setShowMockModal(false);
      
      await API.post("/payments/mock-fail", {
        orderId: mockOrder.orderId,
        reason: "Simulated decline (card holder had insufficient funds).",
      });

      setPaymentStatus("failed");
      setPaymentError("Your card was declined. Please try a different payment method.");
    } catch (err) {
      setPaymentStatus("failed");
      setPaymentError(err.response?.data?.message || "Failed to record simulated payment failure.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const isCurrentPlan = (planKey) => {
    if (!currentSub) return planKey === "free"; // Default
    return currentSub.plan?.key === planKey && currentSub.subscription?.status === "ACTIVE";
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 px-4 py-12 md:px-8 relative overflow-hidden font-sans">
      
      {/* Background industrial grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#E50914]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Full-screen Loading Overlay for signature validation */}
      {verifyingPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 text-[#E50914] animate-spin" />
          <h3 className="text-xl font-bold tracking-tight text-white">SECURE TRANSACTION VERIFYING</h3>
          <p className="text-xs text-slate-500 font-mono">Verifying authorization token. Please do not close this window.</p>
        </div>
      )}

      {/* Success Page Overlay */}
      {paymentStatus === "success" && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0d0d12] border border-[#222] rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-lg">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="pt-4 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">TRANSACTION CAPTURED</span>
              <h2 className="text-3xl font-black text-white">Welcome Aboard!</h2>
              <p className="text-xs text-slate-400 leading-normal">
                Your payment was processed successfully. High-speed redirects, team workspaces, custom domains, and analytics limits are now active.
              </p>
            </div>
            <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-2 text-left text-xs font-mono">
              <div className="flex justify-between"><span className="text-slate-500">Plan Status</span><span className="text-emerald-400 font-bold">Active</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Gateway</span><span className="text-slate-300">PBUrls Secure</span></div>
            </div>
            <button
              onClick={() => {
                setPaymentStatus(null);
                window.location.reload();
              }}
              className="w-full bg-[#E50914] hover:bg-[#F40B16] text-white font-bold py-3.5 rounded-xl transition duration-200 text-xs tracking-wider cursor-pointer"
            >
              LAUNCH DASHBOARD
            </button>
          </div>
        </div>
      )}

      {/* Failure Page Overlay */}
      {paymentStatus === "failed" && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0d0d12] border border-[#E50914]/20 rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 bg-[#E50914]/10 border border-[#E50914]/30 rounded-full flex items-center justify-center shadow-lg">
              <X className="h-8 w-8 text-[#E50914]" />
            </div>
            <div className="pt-4 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E50914]">TRANSACTION ERROR</span>
              <h2 className="text-3xl font-black text-white">Payment Declined</h2>
              <p className="text-xs text-slate-400 leading-normal">
                {paymentError || "We were unable to process your payment. Please verify your banking details and account balances."}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setPaymentStatus(null)}
                className="w-1/2 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl transition duration-200 text-xs cursor-pointer"
              >
                CLOSE
              </button>
              <button
                onClick={() => {
                  setPaymentStatus(null);
                  if (mockOrder) {
                    setShowMockModal(true);
                  }
                }}
                className="w-1/2 bg-[#E50914] hover:bg-[#F40B16] text-white font-bold py-3 rounded-xl transition duration-200 text-xs tracking-wider cursor-pointer"
              >
                RETRY CHECKOUT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock payment modal wrapper */}
      {showMockModal && mockOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full bg-[#0d0d12] border border-[#222] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col my-8">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#121217]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4.5 w-4.5 text-[#E50914]" />
                <span className="text-xs font-bold tracking-wider font-mono text-white">PBURLS SECURE CHECKOUT</span>
              </div>
              <button onClick={() => setShowMockModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 flex-1">
              {/* Plan description brief */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-white capitalize">{mockOrder.planKey} Subscription Plan</p>
                  <p className="text-[10px] text-slate-500">Order ID: {mockOrder.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#E50914] font-black text-sm">₹{(mockOrder.amount / 100).toFixed(2)}</p>
                  <p className="text-[9px] text-slate-500 font-mono">Billed: {billingCycle}</p>
                </div>
              </div>

              {/* Payment selection selector */}
              <div className="grid grid-cols-3 gap-2">
                {["card", "upi", "wallet"].map((method) => (
                  <button
                    key={method}
                    onClick={() => setMockPaymentMethod(method)}
                    className={`rounded-xl py-2 px-3 text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 cursor-pointer border ${
                      mockPaymentMethod === method 
                        ? "bg-[#E50914]/10 border-[#E50914] text-[#E50914]" 
                        : "bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-950"
                    }`}
                  >
                    <span>{method === "card" ? "Credit Card" : method === "upi" ? "UPI Apps" : "Net banking"}</span>
                  </button>
                ))}
              </div>

              {/* Tab options display */}
              {mockPaymentMethod === "card" && (
                <div className="space-y-4">
                  {/* Visual card component */}
                  <div className="relative h-44 w-full rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-white/10 p-5 flex flex-col justify-between overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#E50914]/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-mono tracking-widest text-[#E50914] font-black">PREMIUM BANK</span>
                      <div className="h-6 w-10 bg-slate-800 rounded-sm opacity-50 flex items-center justify-center font-mono text-[9px] text-slate-400">CHIP</div>
                    </div>
                    <div>
                      <p className="text-sm font-mono tracking-[0.2em] text-white">{mockCardNumber || "XXXX XXXX XXXX XXXX"}</p>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[7px] text-slate-500 block uppercase tracking-wider">Card Holder</span>
                        <span className="text-[10px] font-mono text-slate-200">{mockCardName.toUpperCase()}</span>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-[7px] text-slate-500 block uppercase tracking-wider">Expiry</span>
                          <span className="text-[10px] font-mono text-slate-200">{mockCardExpiry}</span>
                        </div>
                        <div>
                          <span className="text-[7px] text-slate-500 block uppercase tracking-wider">CVV</span>
                          <span className="text-[10px] font-mono text-slate-200">{mockCardCvv}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card input forms */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Card Number</label>
                      <input 
                        type="text" 
                        value={mockCardNumber} 
                        onChange={(e) => setMockCardNumber(e.target.value)}
                        placeholder="4111 2222 3333 4444"
                        className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">Expiry</label>
                      <input 
                        type="text" 
                        value={mockCardExpiry} 
                        onChange={(e) => setMockCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-mono">CVV</label>
                      <input 
                        type="password" 
                        value={mockCardCvv} 
                        onChange={(e) => setMockCardCvv(e.target.value)}
                        placeholder="123"
                        className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {mockPaymentMethod === "upi" && (
                <div className="space-y-4">
                  <div className="space-y-1 text-xs">
                    <label className="text-[10px] text-slate-500 uppercase font-mono">UPI ID / Virtual Address</label>
                    <input 
                      type="text" 
                      value={mockUpiId} 
                      onChange={(e) => setMockUpiId(e.target.value)}
                      placeholder="pburls@okaxis"
                      className="w-full bg-slate-950 border border-[#222] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E50914] text-xs font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Enter your VPA address. The simulator will directly capture payment responses after hitting one of the simulation triggers.
                  </p>
                </div>
              )}

              {mockPaymentMethod === "wallet" && (
                <div className="space-y-3 bg-slate-950/60 p-4 border border-white/5 rounded-xl">
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Simulate secure net banking or local e-wallet transactions. Complete verification triggers will execute immediately.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                    <div className="p-2 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-between"><span>State Bank</span><span className="text-[#E50914] font-bold">✓</span></div>
                    <div className="p-2 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-between"><span>HDFC Bank</span><span className="text-[#E50914] font-bold">✓</span></div>
                    <div className="p-2 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-between"><span>ICICI Bank</span><span className="text-[#E50914] font-bold">✓</span></div>
                    <div className="p-2 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-between"><span>Axis Bank</span><span className="text-[#E50914] font-bold">✓</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#121217] border-t border-white/5 flex gap-3">
              <button
                onClick={handleMockPayFail}
                className="w-1/2 py-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                SIMULATE FAILURE
              </button>
              <button
                onClick={handleMockPaySuccess}
                className="w-1/2 py-3 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                SIMULATE SUCCESS
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl relative z-10">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-12">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <span className="font-black tracking-tight text-white text-2xl">
              pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
            </span>
          </Link>
          <button 
            onClick={() => navigate(-1)} 
            className="group inline-flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900/80 transition-all duration-300 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /> Back
          </button>
        </div>

        {/* Title Block */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/10 border border-[#E50914]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#E50914] animate-pulse" />
            <span className="text-[9px] uppercase tracking-[0.25em] text-[#E50914] font-black">Choose your scale</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            PLANS & PRICING
          </h1>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Industrial-grade redirection speeds and high-fidelity analytics. Choose the tier that matches your business demand. Upgrade or downgrade instantly.
          </p>
        </div>

        {/* Cycle Toggle & Promo Code Command Hub */}
        <div className="space-y-6 mb-12 w-full max-w-4xl mx-auto">
          
          {/* Top Control Bar: Billing Cycle & Promo Input */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-950/80 dark:bg-zinc-950 p-2.5 rounded-3xl border border-slate-300 dark:border-zinc-800 shadow-xl">
            
            {/* Billing Cycle Switch */}
            <div className="w-full md:w-auto flex items-center p-1 bg-slate-900/80 dark:bg-zinc-900 rounded-2xl border border-white/5 shrink-0">
              {["MONTHLY", "QUARTERLY", "YEARLY"].map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`flex-1 md:flex-none rounded-xl px-5 py-2.5 text-xs font-black transition-all duration-300 cursor-pointer ${
                    billingCycle === cycle
                      ? "bg-[#E50914] text-white shadow-[0_4px_20px_rgba(229,9,20,0.4)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>

            {/* Quick Promo Input Box */}
            <div className="w-full md:flex-1 flex items-center gap-2 bg-slate-900/80 dark:bg-zinc-900 p-1.5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 px-2 text-slate-400 font-mono text-[11px] font-bold shrink-0">
                <Ticket className="h-4 w-4 text-[#E50914] animate-pulse" />
                <span className="hidden sm:inline">Voucher:</span>
              </div>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                disabled={appliedCoupon || validatingCoupon}
                placeholder="ENTER COUPON (e.g. PBURLS50)"
                className="bg-black/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono font-bold focus:outline-none focus:border-[#E50914] flex-1 min-w-0 placeholder-slate-500"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/40 px-4 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer uppercase shrink-0"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleValidateCoupon(couponCode)}
                  disabled={validatingCoupon || !couponCode}
                  className="bg-[#E50914] hover:bg-[#F40B16] disabled:bg-zinc-800 disabled:text-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 uppercase shrink-0 shadow-md shadow-[#E50914]/20"
                >
                  {validatingCoupon && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                  Apply
                </button>
              )}
            </div>
          </div>

          {/* Active Notifications */}
          {couponError && (
            <div className="p-3 text-center rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold">
              ⚠ {couponError}
            </div>
          )}
          {appliedCoupon && (
            <div className="p-3.5 text-center rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>
                DISCOUNT ACTIVE: <strong>{appliedCoupon.code}</strong> applied ({appliedCoupon.discountType === "PERCENT" ? `${appliedCoupon.discountValue}% OFF` : `₹${appliedCoupon.discountValue} FLAT OFF`})
              </span>
            </div>
          )}

          {/* ACTIVE DEALS & AVAILABLE VOUCHERS SHOWCASE */}
          {activeVouchers.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#E50914] animate-bounce" />
                  <h3 className="text-xs font-mono font-black uppercase tracking-wider text-white">
                    Available Promotional Deals &amp; Vouchers
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Click &quot;Apply 50% Off&quot; to apply instant discount
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {activeVouchers.map((voucher) => {
                  const isApplied = appliedCoupon?.code === voucher.code;
                  const isCopied = copiedCode === voucher.code;
                  const discountDisplay = voucher.discount_type === "PERCENT"
                    ? `${voucher.discount_value}% OFF`
                    : voucher.discount_value >= 100
                    ? `₹${(voucher.discount_value / 100).toFixed(0)} FLAT`
                    : `₹${voucher.discount_value} FLAT`;

                  return (
                    <div
                      key={voucher.id}
                      className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3.5 ${
                        isApplied
                          ? "bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                          : "bg-zinc-950/90 border-zinc-800 hover:border-zinc-700 hover:shadow-xl backdrop-blur-md"
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#E50914] text-white shadow-md shadow-[#E50914]/25">
                            ⚡ {discountDisplay}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="h-3 w-3" /> Verified Deal
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-black/60 p-2.5 rounded-xl border border-white/10">
                          <span className="font-mono font-black text-sm tracking-wider text-white">
                            {voucher.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(voucher.code)}
                            className="px-2.5 py-1 text-slate-300 hover:text-white transition cursor-pointer rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono font-bold flex items-center gap-1"
                            title="Copy voucher code"
                          >
                            {isCopied ? (
                              <span className="text-emerald-400 font-bold">Copied! ✓</span>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-snug">
                          {voucher.description || "Special promotional voucher for subscribers."}
                        </p>

                        <div className="text-[10px] font-mono text-slate-400">
                          Applies to: <span className="text-white uppercase font-bold">
                            {(!voucher.applicable_plans || voucher.applicable_plans.length === 0)
                              ? "All Subscription Plans"
                              : voucher.applicable_plans.join(", ")}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5">
                        {isApplied ? (
                          <div className="w-full py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-center text-xs font-bold font-mono uppercase flex items-center justify-center gap-1.5 shadow-xs">
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Applied to Cart ({discountDisplay})</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleValidateCoupon(voucher.code)}
                            className="w-full py-2.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-xl text-xs font-black transition font-mono uppercase tracking-wider cursor-pointer active:scale-[0.98] shadow-md shadow-[#E50914]/25 flex items-center justify-center gap-1.5"
                          >
                            <span>Apply Code ({discountDisplay})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch mb-24">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-4 py-28">
              <Loader2 className="h-12 w-12 animate-spin text-[#E50914]" />
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase animate-pulse">Initializing pricing models</span>
            </div>
          ) : error ? (
            <div className="col-span-full max-w-md mx-auto rounded-3xl border border-rose-500/10 bg-rose-500/5 p-8 text-center text-rose-300 backdrop-blur-md">
              <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto mb-4 animate-bounce" />
              <p className="font-bold text-white mb-1 uppercase tracking-wider text-sm">Retrieval Error</p>
              <p className="text-xs text-slate-400 leading-normal">{error}</p>
            </div>
          ) : (
            plans.map((plan) => {
              const calculatedPrice = getDisplayPrice(plan);
              const originalCalculatedPrice = plan.price_monthly * (billingCycle === "MONTHLY" ? 1 : billingCycle === "QUARTERLY" ? 3 : 12);
              const hasDiscount = calculatedPrice < originalCalculatedPrice;
              const savingsDisplay = getSavings(plan);
              const isCurrent = isCurrentPlan(plan.key);

              return (
                <div 
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-[2.25rem] border bg-[#07070a]/90 p-6 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_70px_rgba(0,0,0,0.85)] hover:border-slate-800 group overflow-hidden ${
                    plan.key === "pro" 
                      ? "border-[#E50914] shadow-[0_0_50px_rgba(229,9,20,0.1)] bg-gradient-to-b from-[#0e070a]/90 via-[#07070a]/95 to-[#07070a]/99" 
                      : "border-white/5"
                  }`}
                >
                  {/* Subtle Background Glow for Featured Card */}
                  {plan.key === "pro" && (
                    <div className="absolute top-0 right-0 w-36 h-36 bg-[#E50914]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#E50914]/10 transition-all duration-500" />
                  )}

                  {plan.key === "pro" && (
                    <span className="absolute top-4 right-6 rounded-full bg-[#E50914] px-4 py-1 text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                      Recommended
                    </span>
                  )}

                  <div className="space-y-6 relative z-10">
                    {/* Header info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl border ${
                          plan.key === "pro" 
                            ? "bg-[#E50914]/10 border-[#E50914]/20" 
                            : "bg-slate-900/60 border-white/5"
                        }`}>
                          {getPlanIcon(plan.key)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white tracking-tight uppercase">
                            {plan.name}
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 min-h-[40px] leading-relaxed">{plan.description}</p>
                    </div>

                    {/* Price Block */}
                    <div className="py-4 border-y border-white/5 flex flex-col justify-center">
                      <div className="flex items-baseline gap-2">
                        {hasDiscount && (
                          <span className="text-xs line-through text-rose-400/80 font-mono">
                            {getOriginalPriceDisplay(plan)}
                          </span>
                        )}
                        <span className="text-5xl font-black text-white font-mono tracking-tighter">
                          ₹{(calculatedPrice / 100).toFixed(0)}
                        </span>
                        {plan.price_monthly > 0 && (
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">
                            /{billingCycle.toLowerCase().replace("ly", "")}
                          </span>
                        )}
                      </div>
                      
                      {hasDiscount && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Promo Discount Applied</span>
                        </div>
                      )}
                      
                      {plan.price_monthly > 0 && billingCycle !== "MONTHLY" && (
                        <p className="text-[9px] text-[#E50914] font-black tracking-widest uppercase mt-2 font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-ping" />
                          Equiv. to {getMonthlyEquivalent(plan, calculatedPrice)}/mo billed upfront
                        </p>
                      )}
                      
                      {savingsDisplay && billingCycle !== "MONTHLY" && !hasDiscount && (
                        <span className="inline-flex self-start mt-2 text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                          {savingsDisplay} discount
                        </span>
                      )}
                    </div>

                    {/* Key limits detail */}
                    <ul className="space-y-4 text-xs">
                      <li className="flex items-start gap-3">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.key === "pro" ? "text-[#E50914]" : "text-slate-400"}`} />
                        <span className="text-slate-300 font-medium">
                          {plan.limit.max_urls ? (
                            <span>Create up to <strong className="text-white font-semibold">{plan.limit.max_urls.toLocaleString()}</strong> URLs</span>
                          ) : (
                            <strong className="text-white font-semibold">Unlimited URL redirects</strong>
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.key === "pro" ? "text-[#E50914]" : "text-slate-400"}`} />
                        <span className="text-slate-300 font-medium">
                          {plan.limit.analytics_retention_days ? (
                            <span><strong className="text-white font-semibold">{plan.limit.analytics_retention_days} Days</strong> history retention</span>
                          ) : (
                            <strong className="text-white font-semibold">Lifetime analytics history</strong>
                          )}
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.key === "pro" ? "text-[#E50914]" : "text-slate-400"}`} />
                        <span className="text-slate-300 font-medium">
                          {plan.limit.team_members_allowed > 0 ? (
                            <span>Team workspaces (up to <strong className="text-white font-semibold">{plan.limit.team_members_allowed} seats</strong>)</span>
                          ) : (
                            <span>Personal workspace settings</span>
                          )}
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-8 relative z-10">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-2xl py-4 text-xs font-black bg-slate-900/60 border border-white/5 text-slate-500 cursor-not-allowed uppercase tracking-widest font-mono"
                      >
                        Current Active Plan
                      </button>
                    ) : plan.key === "free" ? (
                      <button
                        onClick={handleDowngradeToFree}
                        disabled={checkoutLoading === "free"}
                        className="w-full rounded-2xl py-4 text-xs font-black bg-slate-950 border border-white/5 hover:border-white/20 text-slate-300 hover:text-white hover:bg-slate-900 transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-widest font-mono"
                      >
                        {checkoutLoading === "free" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Downgrade to Free
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={checkoutLoading !== null}
                        className={`w-full rounded-2xl py-4 text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-widest font-mono ${
                          plan.key === "pro"
                            ? "bg-[#E50914] hover:bg-[#F40B16] text-white shadow-[0_10px_25px_rgba(229,9,20,0.35)] hover:shadow-[0_10px_35px_rgba(229,9,20,0.55)] border-transparent"
                            : "bg-slate-900 hover:bg-[#E50914] text-white border border-white/10 hover:border-transparent"
                        }`}
                      >
                        {checkoutLoading === plan.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
                        <span>
                          {hasDiscount
                            ? `Upgrade to ${plan.name} (50% OFF) →`
                            : `Upgrade to ${plan.name} →`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Matrix comparison table Netflix style */}
        <div className="border border-white/5 rounded-[2.5rem] bg-[#07070a]/60 backdrop-blur-xl p-8 md:p-10 space-y-8 mb-24 shadow-2xl">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">FEATURE COMPARISON MATRIX</h2>
            <p className="text-xs text-slate-400">Detailed overview of core, developer, and team scaling features across tiers.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-4 font-black">Core Capabilities</th>
                  <th className="py-4 px-6 font-black text-center">Free</th>
                  <th className="py-4 px-6 font-black text-center text-indigo-400">Starter</th>
                  <th className="py-4 px-6 font-black text-center text-[#E50914]">Pro</th>
                  <th className="py-4 px-6 font-black text-center text-emerald-400">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Globe className="h-4 w-4 text-slate-500" /> Custom Domains</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Activity className="h-4 w-4 text-slate-500" /> Country & Device Analytics</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Lock className="h-4 w-4 text-slate-500" /> Link Password Gateways</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Smartphone className="h-4 w-4 text-slate-500" /> Dynamic QR Code Editor</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Cpu className="h-4 w-4 text-slate-500" /> API Access Keys</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Database className="h-4 w-4 text-slate-500" /> Event Webhooks</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-emerald-400 font-bold">✓</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors duration-200">
                  <td className="py-4 flex items-center gap-3"><Users className="h-4 w-4 text-slate-500" /> Multi-user Workspaces</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-slate-600">—</td>
                  <td className="py-4 px-6 text-center text-white font-semibold">10 Seat Limit</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Industrial FAQ Section */}
        <div className="max-w-4xl mx-auto space-y-8 mb-24">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400">Everything you need to know about our billing model and plans.</p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-6 rounded-3xl border border-white/5 bg-[#07070a]/40 backdrop-blur-md space-y-2">
              <h4 className="text-sm font-bold text-white">Can I change plans at any time?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes, you can upgrade, downgrade, or switch billing cycles instantly. Upgrades are prorated, and downgrades take effect immediately while maintaining plan limits safety.
              </p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-[#07070a]/40 backdrop-blur-md space-y-2">
              <h4 className="text-sm font-bold text-white">How does custom domain mapping work?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pro and Business plans allow you to link custom domains (e.g. `link.brand.com`). Simply configure a CNAME record in your DNS settings pointing to our redirect gateway, and we handle the rest.
              </p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-[#07070a]/40 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">What is your refund policy?</h4>
                <button
                  type="button"
                  onClick={() => setShowRefundTermsModal(true)}
                  className="text-[11px] text-[#E50914] hover:underline font-mono font-bold cursor-pointer"
                >
                  View Terms →
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                We offer a 100% risk-free 14-day money-back guarantee for all paid subscriptions (Starter, Pro, and Business). If you are unsatisfied, you can request an instant full refund directly from your account billing settings with zero hidden fees.
              </p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-[#07070a]/40 backdrop-blur-md space-y-2">
              <h4 className="text-sm font-bold text-white">What happens if I exceed my URL limits?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When you approach your plan's active URL limit, we'll notify you. Active redirects will never break, but new link creation will be locked until you upgrade or archive older links.
              </p>
            </div>
          </div>

          {/* Guarantee Trust Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-950/30 via-zinc-900/60 to-zinc-950 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">100% Risk-Free 14-Day Money-Back Guarantee</h4>
                <p className="text-xs text-slate-400 mt-0.5">Try any paid tier with full confidence. Instant self-service cancellation and refunds directly in your dashboard.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRefundTermsModal(true)}
              className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl transition cursor-pointer font-mono shrink-0 flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Read Refund Policy</span>
            </button>
          </div>
        </div>

      </div>

      {/* Refund Terms Modal */}
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

            <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto leading-relaxed font-sans">
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

