import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/urlApi";
import { useAuth } from "../context/AuthContext";
import { Check, ShieldCheck, Zap, Star, ShieldAlert, Sparkles, Building, ArrowLeft, Ticket, Loader2, CreditCard, X, Smartphone, Globe, Activity, Lock, Cpu, Database, Users } from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [currentSub, setCurrentSub] = useState(null);
  const [billingCycle, setBillingCycle] = useState("MONTHLY"); // MONTHLY, QUARTERLY, YEARLY
  
  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountType, discountValue, description }
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

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
  const [mockUpiId, setMockUpiId] = useState(user?.email ? `${user.email.split("@")[0]}@okaxis` : "snapurl@okaxis");

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
    fetchPlans();
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

  const handleValidateCoupon = async () => {
    if (!couponCode) return;
    try {
      setValidatingCoupon(true);
      setCouponError("");
      const response = await API.post("/payments/validate-coupon", {
        couponCode: couponCode.trim(),
        planKey: "pro", 
      });
      
      const coupon = response.data?.data;
      setAppliedCoupon({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
      });
    } catch (err) {
      setCouponError(err.response?.data?.message || "Invalid coupon code.");
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

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
        name: "SnapURL Subscription",
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
    <div className="min-h-screen bg-[#08080C] text-slate-200 px-4 py-12 md:px-8 relative overflow-hidden font-sans">
      
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
              <div className="flex justify-between"><span className="text-slate-500">Payment Gateway</span><span className="text-slate-300">SnapURL Secure</span></div>
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
                <span className="text-xs font-bold tracking-wider font-mono text-white">SNAPURL SECURE CHECKOUT</span>
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
                      placeholder="snapurl@okaxis"
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
        
        {/* Back Link */}
        <button 
          onClick={() => navigate("/dashboard")} 
          className="group inline-flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition duration-200 cursor-pointer mb-12"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /> Back to Console
        </button>

        {/* Title Block */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#E50914] font-black">CHOOSE YOUR SCALE</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">
            PLANS & PRICING
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Netflix-grade performance and deep redirection tracking. Choose the tier that matches your monthly demand. Downgrade or upgrade at anytime instantly.
          </p>
        </div>

        {/* Cycle Toggle & Coupon */}
        <div className="flex flex-col items-center gap-8 mb-16">
          <div className="inline-flex rounded-xl bg-slate-950 p-1.5 border border-white/5 shadow-inner">
            {["MONTHLY", "QUARTERLY", "YEARLY"].map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-lg px-5 py-2 text-xs font-black transition duration-200 cursor-pointer ${
                  billingCycle === cycle
                    ? "bg-[#E50914] text-white shadow-md"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {cycle}
              </button>
            ))}
          </div>

          {/* Coupon */}
          <div className="w-full max-w-md bg-slate-950/80 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 text-[#E50914]" /> Promo Voucher Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={appliedCoupon || validatingCoupon}
                placeholder="ENTER COUPON CODE"
                className="bg-black border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-[#E50914] w-full"
              />
              {appliedCoupon ? (
                <button
                  onClick={handleRemoveCoupon}
                  className="bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 border border-rose-900/30 px-4 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  REMOVE
                </button>
              ) : (
                <button
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon || !couponCode}
                  className="bg-slate-900 border border-white/10 hover:bg-slate-800 disabled:bg-slate-950 disabled:text-slate-700 px-4 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                >
                  {validatingCoupon && <Loader2 className="h-3 w-3 animate-spin text-[#E50914]" />}
                  APPLY
                </button>
              )}
            </div>
            {couponError && <p className="text-[10px] text-rose-400 font-mono">{couponError}</p>}
            {appliedCoupon && (
              <p className="text-[10px] text-emerald-400 font-semibold font-mono">
                ✓ DISCOUNT APPLIED: {appliedCoupon.description || `${appliedCoupon.code} applied successfully.`}
              </p>
            )}
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch mb-24">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#E50914]" />
              <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">LOADING SUBSCRIPTION MODELS</span>
            </div>
          ) : error ? (
            <div className="col-span-full max-w-md mx-auto rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-300">
              <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-3" />
              <p className="font-bold text-white mb-1">Retrieval Error</p>
              <p className="text-xs text-slate-400">{error}</p>
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
                  className={`relative flex flex-col justify-between rounded-[2rem] border bg-black/60 p-6 backdrop-blur-md transition duration-300 ${getPlanColor(plan.key)}`}
                >
                  {plan.key === "pro" && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E50914] px-4 py-1 text-[8px] font-black uppercase tracking-widest text-white shadow-md">
                      MOST POPULAR
                    </span>
                  )}

                  <div className="space-y-6">
                    {/* Header info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                          {plan.name}
                          {savingsDisplay && billingCycle !== "MONTHLY" && (
                            <span className="text-[9px] font-black bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/20 rounded-full px-2 py-0.5">
                              {savingsDisplay}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 min-h-[36px] leading-snug">{plan.description}</p>
                      </div>
                      <div className="rounded-xl bg-slate-950 p-2.5 border border-white/5">
                        {getPlanIcon(plan.key)}
                      </div>
                    </div>

                    {/* Price Block */}
                    <div className="pt-2 flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        {hasDiscount && (
                          <span className="text-xs line-through text-slate-600 font-mono">
                            {getOriginalPriceDisplay(plan)}
                          </span>
                        )}
                        <span className="text-4xl font-black text-white font-mono tracking-tight">
                          ₹{(calculatedPrice / 100).toFixed(0)}
                        </span>
                        {plan.price_monthly > 0 && (
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider ml-0.5">
                            /{billingCycle.toLowerCase().replace("ly", "")}
                          </span>
                        )}
                      </div>
                      
                      {plan.price_monthly > 0 && billingCycle !== "MONTHLY" && (
                        <p className="text-[9px] text-[#E50914] font-semibold tracking-wider uppercase mt-1 font-mono">
                          Equiv. to {getMonthlyEquivalent(plan, calculatedPrice)}/mo billed upfront
                        </p>
                      )}
                    </div>

                    {/* Key limits detail */}
                    <ul className="space-y-3.5 text-xs pt-4 border-t border-[#111]">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#E50914] shrink-0" />
                        <span className="text-slate-300">{plan.limit.max_urls ? `${plan.limit.max_urls.toLocaleString()} URL limit` : "Unlimited URL Redirects"}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#E50914] shrink-0" />
                        <span className="text-slate-300">{plan.limit.analytics_retention_days ? `${plan.limit.analytics_retention_days} Days Analytics` : "Lifetime Analytics History"}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#E50914] shrink-0" />
                        <span className="text-slate-300">{plan.limit.team_members_allowed > 0 ? `${plan.limit.team_members_allowed} Workspaces seats` : "Personal Workspace"}</span>
                      </li>
                    </ul>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-8">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full rounded-xl py-3.5 text-xs font-black bg-slate-900 border border-white/5 text-slate-600 cursor-not-allowed uppercase tracking-wider"
                      >
                        CURRENT ENTITLEMENT
                      </button>
                    ) : plan.key === "free" ? (
                      <button
                        onClick={handleDowngradeToFree}
                        disabled={checkoutLoading === "free"}
                        className="w-full rounded-xl py-3.5 text-xs font-black bg-slate-950 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white hover:bg-slate-900 transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                      >
                        {checkoutLoading === "free" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        SELECT FREE TIER
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={checkoutLoading !== null}
                        className={`w-full rounded-xl py-3.5 text-xs font-black transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider ${
                          plan.key === "pro"
                            ? "bg-[#E50914] hover:bg-[#F40B16] text-white shadow-lg shadow-[#E50914]/15"
                            : "bg-slate-950 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white hover:bg-slate-900"
                        }`}
                      >
                        {checkoutLoading === plan.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        SELECT PLAN
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Matrix comparison table Netflix style */}
        <div className="border border-[#222] rounded-[2.5rem] bg-black/40 backdrop-blur-md p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">PLAN COMPARISON MATRIX</h2>
            <p className="text-xs text-slate-500">Full specification rundown for deep branding and developer capabilities.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222] text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-4 font-normal">Features</th>
                  <th className="py-4 px-4 font-normal text-center">Free</th>
                  <th className="py-4 px-4 font-normal text-center text-indigo-400">Starter</th>
                  <th className="py-4 px-4 font-normal text-center text-[#E50914] font-bold">Pro</th>
                  <th className="py-4 px-4 font-normal text-center text-emerald-400">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111] text-slate-300 font-medium">
                <tr>
                  <td className="py-4 flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-slate-500" /> Custom Domains</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-slate-500" /> Geo / Device Analytics</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-slate-500" /> Password Protection</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Smartphone className="h-3.5 w-3.5 text-slate-500" /> Custom QR Editor</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-slate-500" /> REST API & Keys</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Database className="h-3.5 w-3.5 text-slate-500" /> Webhook Integrations</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-emerald-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 flex items-center gap-2"><Users className="h-3.5 w-3.5 text-slate-500" /> Team Workspace seats</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-600">—</td>
                  <td className="py-4 px-4 text-center text-slate-300">10 Seats</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

