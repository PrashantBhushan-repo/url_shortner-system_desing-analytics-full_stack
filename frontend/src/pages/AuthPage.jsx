import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ForgotPasswordModal from "../components/auth/ForgotPasswordModal";
import { loginUser, registerUser, resendOtp, verifyEmail, verifyLoginOtp, forceChangePassword, evaluatorBypass } from "../services/authApi";
import { useAuth } from "../context/AuthContext";
import { Lock, Shield, ArrowLeft } from "lucide-react";

const initialState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  otp: "",
};

function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    return m === "register" || m === "signup" ? "register" : "login";
  });

  // Sync mode if query params change
  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "register" || m === "signup") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("register");
    } else if (m === "login") {
      setMode("login");
    }
  }, [searchParams]);

  const [form, setForm] = useState(initialState);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loginUsesTwoFactor, setLoginUsesTwoFactor] = useState(false);
  const [changePasswordToken, setChangePasswordToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, token } = useAuth();
  const navigate = useNavigate();

  const [puzzleActive, setPuzzleActive] = useState(false);
  const [puzzleImages, setPuzzleImages] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [shake, setShake] = useState(false);
  const [targetCategory, setTargetCategory] = useState({ key: "BHAGAT_SINGH", label: "Bhagat Singh" });

  const CATEGORIES = [
    { key: "BHAGAT_SINGH", label: "Bhagat Singh" },
    { key: "OPPENHEIMER", label: "J. Robert Oppenheimer" },
    { key: "EINSTEIN", label: "Albert Einstein" },
    { key: "RAMANUJAN", label: "Srinivasa Ramanujan" },
    { key: "CURIE", label: "Marie Curie" },
    { key: "VIVEKANANDA", label: "Swami Vivekananda" },
    { key: "TURING", label: "Alan Turing" }
  ];

  const IMAGE_POOL = [
    // Bhagat Singh
    { id: "bs1", category: "BHAGAT_SINGH", src: "/puzzle/bhagat_singh_1.png" },
    { id: "bs2", category: "BHAGAT_SINGH", src: "/puzzle/bhagat_singh_2.png" },
    { id: "bs3", category: "BHAGAT_SINGH", src: "/puzzle/bhagat_singh_3.png" },
    { id: "bs4", category: "BHAGAT_SINGH", src: "/puzzle/bhagat_singh_4.png" },
    // Vivekananda
    { id: "sv1", category: "VIVEKANANDA", src: "/puzzle/swami_vivekananda.png" },
    // Einstein
    { id: "ae1", category: "EINSTEIN", src: "/puzzle/einstein_1.png" },
    { id: "ae2", category: "EINSTEIN", src: "/puzzle/einstein_2.png" },
    { id: "ae3", category: "EINSTEIN", src: "/puzzle/einstein_3.png" },
    // Oppenheimer
    { id: "jo1", category: "OPPENHEIMER", src: "/puzzle/oppenheimer_1.png" },
    { id: "jo2", category: "OPPENHEIMER", src: "/puzzle/oppenheimer_2.png" },
    { id: "jo3", category: "OPPENHEIMER", src: "/puzzle/oppenheimer_3.png" },
    // Ramanujan
    { id: "sr1", category: "RAMANUJAN", src: "/puzzle/ramanujan_1.png" },
    { id: "sr2", category: "RAMANUJAN", src: "/puzzle/ramanujan_2.png" },
    { id: "sr3", category: "RAMANUJAN", src: "/puzzle/ramanujan_3.png" },
    // Curie
    { id: "mc1", category: "CURIE", src: "/puzzle/curie_1.png" },
    { id: "mc2", category: "CURIE", src: "/puzzle/curie_2.png" },
    { id: "mc3", category: "CURIE", src: "/puzzle/curie_3.png" },
    { id: "mc4", category: "CURIE", src: "/puzzle/curie_4.png" },
    // Turing
    { id: "at1", category: "TURING", src: "/puzzle/turing_1.png" },
    { id: "at3", category: "TURING", src: "/puzzle/turing_3.png" },
    { id: "at4", category: "TURING", src: "/puzzle/turing_4.png" }
  ];

  const generatePuzzleBoard = () => {
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    setTargetCategory(randomCategory);

    const targetPool = IMAGE_POOL.filter(img => img.category === randomCategory.key);
    const distractorPool = IMAGE_POOL.filter(img => img.category !== randomCategory.key);

    const maxTargetsPossible = Math.min(4, targetPool.length);
    const targetCount = Math.floor(Math.random() * maxTargetsPossible) + 1; // 1 to maxPossible (1, 2, 3, or 4)
    const distractorCount = 9 - targetCount;

    const shuffledTargets = [...targetPool].sort(() => 0.5 - Math.random());
    const selectedTargets = shuffledTargets.slice(0, targetCount);

    const shuffledDistractors = [...distractorPool].sort(() => 0.5 - Math.random());
    const selectedDistractors = shuffledDistractors.slice(0, distractorCount);

    const combined = [...selectedTargets, ...selectedDistractors].sort(() => 0.5 - Math.random());
    
    setPuzzleImages(combined);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (puzzleActive) {
      generatePuzzleBoard();
    }
  }, [puzzleActive]);

  const handleToggleSelect = (id) => {
    setError("");
    setMessage("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleVerifyPuzzle = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const actualTargets = puzzleImages.filter(img => img.category === targetCategory.key).map(img => img.id);
    const selectedList = Array.from(selectedIds);

    const allTargetsSelected = actualTargets.every(id => selectedIds.has(id));
    const noDistractorsSelected = selectedList.every(id => {
      const img = puzzleImages.find(i => i.id === id);
      return img && img.category === targetCategory.key;
    });

    if (allTargetsSelected && noDistractorsSelected) {
      setSubmitting(true);
      setError("");
      setMessage("Clearance verified. Generating secure credentials...");
      
      try {
        const response = await evaluatorBypass("USER");
        login(response.data?.data?.accessToken);
        navigate("/dashboard");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to establish bypass session. Server error.");
        setSubmitting(false);
      }
    } else {
      setShake(true);
      setError(`AUTHENTICATION FAILED: Incorrect ${targetCategory.label} photos selected. Access Denied.`);
      setTimeout(() => setShake(false), 500);
    }
  };

  useEffect(() => {
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [searchParams]);

  const handleOAuthLogin = (provider) => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    window.location.href = `${apiBase}/auth/oauth/${provider}`;
  };

  const handleChange = (e) => {
    setError("");
    setMessage("");
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const passwordCriteria = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password),
  };

  const parseJwtPayload = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const response = await registerUser({ name: form.name.trim(), email: form.email.trim(), password: form.password });
        setPendingUserId(response.data?.data?.userId || null);
        setMessage("Verification code sent to your email.");
        setMode("verify-email");
        return;
      }

      if (mode === "verify-email") {
        await verifyEmail({ userId: pendingUserId, otp: form.otp.trim() });
        setMessage("Email verified. You can now log in.");
        setMode("login");
        return;
      }

      if (mode === "force-change-password") {
        if (form.password !== form.confirmPassword) {
          setError("Passwords do not match.");
          setSubmitting(false);
          return;
        }

        const passesCriteria = Object.values(passwordCriteria).every(Boolean);
        if (!passesCriteria) {
          setError("Password does not meet the complexity criteria.");
          setSubmitting(false);
          return;
        }

        const response = await forceChangePassword({
          changePasswordToken,
          newPassword: form.password,
        });

        setMessage("Password updated successfully. Session authenticated.");
        login(response.data?.data?.accessToken);
        
        const payload = parseJwtPayload(response.data.data.accessToken);
        if (payload.role === "ADMIN") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
        return;
      }

      const response = await loginUser({ email: form.email.trim(), password: form.password });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Administrator Sign-In: Forced password rotation on first login.");
        return;
      }

      if (response.data?.data?.twoFactorRequired) {
        setPendingUserId(response.data.data.userId);
        setLoginUsesTwoFactor(true);
        setMessage("Enter the 6-digit code from your authenticator app.");
        setMode("verify-login");
        return;
      }

      if (response.data?.data?.otpRequired) {
        setPendingUserId(response.data.data.userId);
        setLoginUsesTwoFactor(false);
        setMessage("A login code was sent to your email.");
        setMode("verify-login");
        return;
      }

      login(response.data?.data?.accessToken);
      const payload = parseJwtPayload(response.data.data.accessToken);
      if (payload.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.code === "EMAIL_NOT_VERIFIED") {
        setPendingUserId(responseData.details?.userId || null);
        setMessage(responseData.message || "Please verify your email.");
        setMode("verify-email");
        return;
      }

      const apiMessage = responseData?.message;
      const apiDetails = responseData?.details;
      const detailMessage = Array.isArray(apiDetails)
        ? apiDetails.map((detail) => detail.message).join(". ")
        : null;

      setError(detailMessage || apiMessage || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginOtp = async (e) => {
    e.preventDefault();
    try {
      const response = await verifyLoginOtp({ userId: pendingUserId, otp: form.otp.trim() });
      
      if (response.data?.data?.mustChangePassword) {
        setChangePasswordToken(response.data.data.changePasswordToken);
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setMode("force-change-password");
        setMessage("Administrator Sign-In: Forced password rotation on first login.");
        return;
      }

      login(response.data?.data?.accessToken);
      const payload = parseJwtPayload(response.data.data.accessToken);
      if (payload.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const apiMessage = err.response?.data?.message;
      const apiDetails = err.response?.data?.details;
      const detailMessage = Array.isArray(apiDetails)
        ? apiDetails.map((detail) => detail.message).join(". ")
        : null;

      setError(detailMessage || apiMessage || "Invalid OTP");
    }
  };

  const handleResendOtp = async () => {
    if (!pendingUserId) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      const purpose = mode === "verify-login" ? "login_otp" : "email_verify";
      const response = await resendOtp({ purpose, userId: pendingUserId });
      setMessage(response.data?.message || "A new code has been sent.");
    } catch (err) {
      const apiMessage = err.response?.data?.message || "Unable to resend code right now.";
      setError(apiMessage);
    } finally {
      setResending(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setMessage("");
    setResending(false);
    setLoginUsesTwoFactor(false);
    setForm((prev) => ({ ...prev, otp: "", password: "", confirmPassword: "" }));
    if (newMode !== "verify-login" && newMode !== "verify-email") {
      setPendingUserId(null);
    }
  };

  const isForceChangeMode = mode === "force-change-password";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10 animate-fade-in relative">
      {/* Floating Back to Home button */}
      <div className="absolute top-6 left-6 z-50">
        <Link 
          to="/" 
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/90 hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition duration-150 shadow-md cursor-pointer select-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
      `}</style>
      
      <div 
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
        className={`w-full transition-all duration-300 rounded-2xl border bg-zinc-900/90 p-8 shadow-lg backdrop-blur-md ${
          puzzleActive
            ? "max-w-2xl border-yellow-500/30 shadow-[0_0_50px_-12px_rgba(234,179,8,0.15)]"
            : isForceChangeMode 
            ? "max-w-md border-red-500/20 shadow-red-500/10" 
            : "max-w-md border-zinc-800 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]"
        }`}
      >
        
        <div className="flex justify-center mb-6">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <span className="font-black tracking-tighter text-white text-4xl">
              pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
            </span>
          </Link>
        </div>
        
        {isForceChangeMode && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2 text-xs font-mono">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <strong>ADMINISTRATIVE SESSION DETECTED</strong>
              <p className="mt-1">First-time console provisioning requires password change before session tokens are signed.</p>
            </div>
          </div>
        )}

        {/* Mode Switcher */}
        {!isForceChangeMode && (
          <div className="flex border-b border-zinc-800 mb-6 font-mono text-xs tracking-wider uppercase">
            <button
              type="button"
              onClick={() => { setPuzzleActive(false); switchMode("login"); }}
              className={`flex-1 pb-3 text-center transition-colors border-b-2 font-semibold cursor-pointer ${
                !puzzleActive && mode === "login" 
                  ? "border-blue-500 text-white font-bold" 
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setPuzzleActive(false); switchMode("register"); }}
              className={`flex-1 pb-3 text-center transition-colors border-b-2 font-semibold cursor-pointer ${
                !puzzleActive && mode === "register" 
                  ? "border-blue-500 text-white font-bold" 
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setPuzzleActive(true); switchMode("login"); }}
              className={`flex-1 pb-3 text-center transition-all border-b-2 font-bold cursor-pointer relative uppercase tracking-wider ${
                puzzleActive 
                  ? "border-yellow-500 text-yellow-500 font-black text-[11px]" 
                  : "border-transparent text-yellow-500/80 hover:text-yellow-400 hover:border-yellow-500/30 text-[10px]"
              }`}
            >
              <span>Puzzle Bypass</span>
              <span className="absolute -top-2 right-1 bg-[#E50914] text-white text-[8px] px-2 py-0.5 rounded font-black tracking-wider animate-bounce select-none">
                FAST PASS
              </span>
            </button>
          </div>
        )}

        {puzzleActive ? (
          <>
            <div className="bg-yellow-500/5 border border-yellow-500/30 p-4 rounded-xl space-y-2 text-left mb-4">
              <span className="text-[9px] text-yellow-400 font-black tracking-widest uppercase font-mono block">Evaluator Access Protocol</span>
              <h1 className="text-xs font-bold text-white leading-normal">
                Click all photos matching: <strong className="text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">{targetCategory.label}</strong>
              </h1>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Select the matching images below and click verify to bypass credentials. The site will establish a secure demo session for you instantly.
              </p>
            </div>

            {message ? <div className="mt-4 rounded border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-mono">{message}</div> : null}
            {error ? <div className="mt-4 rounded border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono">{error}</div> : null}

            <form className="mt-6" onSubmit={handleVerifyPuzzle}>
              {/* Photo Puzzle Grid */}
              <div className="grid grid-cols-3 gap-2.5 my-5">
                {puzzleImages.map((img, idx) => (
                  <div 
                    key={img.id + idx}
                    onClick={() => handleToggleSelect(img.id)}
                    className={`relative aspect-square cursor-pointer overflow-hidden border-2 transition-all duration-200 group rounded ${
                      selectedIds.has(img.id)
                        ? "border-emerald-500 bg-emerald-500/10 scale-[0.98] shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-500 hover:scale-[1.02]"
                    }`}
                  >
                    <img 
                      src={img.src} 
                      alt="Puzzle piece" 
                      className={`w-full h-full object-cover grayscale transition-all duration-300 ${
                        selectedIds.has(img.id) ? "grayscale-0 scale-105" : "group-hover:grayscale-0"
                      }`}
                    />

                    {selectedIds.has(img.id) && (
                      <>
                        {/* Green circular badge with check mark inside */}
                        <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full border border-emerald-500/40 bg-black/85 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black stroke-[3.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Puzzle Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generatePuzzleBoard}
                  className="flex-1 py-2 px-3 text-[10px] font-mono font-bold text-zinc-400 hover:text-yellow-500 bg-zinc-950/80 border border-zinc-800 hover:border-yellow-600/50 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                  RE-CALIBRATE
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] py-2 px-4 text-[10px] font-mono font-bold text-black bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-600 rounded transition-all shadow-[0_0_15px_rgba(234,179,8,0.15)] disabled:shadow-none uppercase tracking-wider cursor-pointer"
                >
                  {submitting ? "ESTABLISHING BYPASS..." : "VERIFY CLEARANCE →"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              {isForceChangeMode ? (
                <>
                  <Lock className="w-6 h-6 text-red-500" />
                  <span>Rotate Password</span>
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : mode === "verify-email" ? (
                "Verify your email"
              ) : mode === "verify-login" ? (
                loginUsesTwoFactor ? "MFA Code Verification" : "Verify Login"
              ) : (
                "Sign Up"
              )}
            </h1>
            
            <p className="mt-2 text-sm text-slate-400">
              {isForceChangeMode 
                ? "Choose a strong, complex credential to authorize your administration privileges."
                : mode === "login" 
                ? "Sign in to manage your short links." 
                : mode === "verify-login" && loginUsesTwoFactor 
                ? "Enter the 6-digit code from your system authenticator app." 
                : "Use the secure OTP flow for your account."}
            </p>

            {message ? <div className={`mt-4 rounded-lg border p-3 text-sm font-mono ${isForceChangeMode ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{message}</div> : null}
            {error ? <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300 font-mono">{error}</div> : null}

            <form className="mt-6 space-y-4" onSubmit={mode === "verify-login" ? handleLoginOtp : handleSubmit}>
              {mode === "register" ? (
                <div>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Full Name"
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500">Use your full name; letters, spaces, hyphens and apostrophes only.</p>
                </div>
              ) : null}

              {isForceChangeMode ? (
                <>
                  <div>
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-red-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      placeholder="New Admin Password"
                      required
                    />
                  </div>
                  <div>
                    <input
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-red-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      placeholder="Confirm New Password"
                      required
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                    <span className="text-slate-500 uppercase font-black col-span-2 tracking-wider">Complexity Rules:</span>
                    <div className={passwordCriteria.length ? "text-emerald-400" : "text-slate-500"}>✓ 8+ chars</div>
                    <div className={passwordCriteria.uppercase ? "text-emerald-400" : "text-slate-500"}>✓ Uppercase</div>
                    <div className={passwordCriteria.lowercase ? "text-emerald-400" : "text-slate-500"}>✓ Lowercase</div>
                    <div className={passwordCriteria.number ? "text-emerald-400" : "text-slate-500"}>✓ Number</div>
                    <div className={passwordCriteria.special ? "text-emerald-400" : "text-slate-500"}>✓ Special Symbol</div>
                  </div>
                </>
              ) : (mode === "login" || mode === "register") ? (
                <>
                  <div>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Email"
                      required
                    />
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2.5 pr-12 text-white placeholder-slate-500 transition-all duration-200 focus:border-blue-500/50 focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3l18 18" />
                            <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
                            <path d="M9.3 5.2A10.8 10.8 0 0 1 12 4c6.5 0 10 7 10 7a18.7 18.7 0 0 1-4.1 5.1" />
                            <path d="M6.6 6.6A18.7 18.7 0 0 0 2 12s3.5 7 10 7a11.2 11.2 0 0 0 4.4-.9" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {(mode === "verify-email" || mode === "verify-login") ? (
                <div className="space-y-3 font-mono">
                  <input
                    name="otp"
                    value={form.otp}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2.5 text-white text-center tracking-widest font-black"
                    placeholder={loginUsesTwoFactor ? "Authenticator code" : "OTP Code"}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                  {!loginUsesTwoFactor ? (
                    <button type="button" onClick={handleResendOtp} disabled={resending || !pendingUserId} className="w-full rounded-lg border border-blue-500/40 px-4 py-2.5 text-xs font-bold text-blue-300 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                      {resending ? "Sending..." : "Resend code"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : mode === "login" ? (
                  "Sign In"
                ) : mode === "register" ? (
                  "Sign Up"
                ) : mode === "verify-email" ? (
                  "Verify Email"
                ) : (
                  "Verify Login"
                )}
              </button>
            </form>

            {(mode === "login" || mode === "register") && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-mono">
                    <span className="bg-slate-900 px-3 text-slate-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("google")}
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/30 py-2.5 transition-all hover:bg-slate-800/60 hover:border-white/20 cursor-pointer"
                    title="Google"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("github")}
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/30 py-2.5 transition-all hover:bg-slate-800/60 hover:border-white/20 cursor-pointer"
                    title="GitHub"
                  >
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("microsoft")}
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/30 py-2.5 transition-all hover:bg-slate-800/60 hover:border-white/20 cursor-pointer"
                    title="Microsoft"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M0 0h11v11H0z" />
                      <path fill="#81bc06" d="M12 0h11v11H12z" />
                      <path fill="#05a6f0" d="M0 12h11v11H0z" />
                      <path fill="#ffba08" d="M12 12h11v11H12z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("amazon")}
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-800/30 py-2.5 transition-all hover:bg-slate-800/60 hover:border-white/20 cursor-pointer"
                    title="Amazon"
                  >
                    <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.98 10.66c-1.48 0-2.6-.96-2.6-2.69 0-2.22 1.77-2.82 4.02-2.82.35 0 .7.02 1.03.06V4.9c0-.9-.49-1.34-1.43-1.34-.86 0-1.82.31-2.59.76l-.56-.99c1-.62 2.3-1 3.78-1 2.16 0 3.52 1.07 3.52 3.39v4.2c0 .8.19 1.23.57 1.65h-2.75c-.17-.22-.29-.54-.35-.78-.92.73-2.27 1.67-3.2 1.67zm.37-4.18c-1.26 0-2.21.25-2.21 1.38 0 .73.52 1.19 1.41 1.19.82 0 1.6-.44 1.84-1.03.05-.15.08-.31.08-.47V6.52c-.36-.02-.73-.04-1.12-.04zm1.51 11.23c-2.47 1.66-5.71 2.53-8.8 2.53-.98 0-1.93-.08-2.88-.24l-.05.6c.97.16 1.95.24 2.93.24 3.19 0 6.54-.89 9.08-2.6l-.28-.53zm1.94.18c.26-.33.18-.76-.17-1.01l-1.09-.78c-.33-.24-.77-.17-1.02.16l-.94 1.21c-.26.33-.18.76.17 1.01l1.09.78c.33.24.77.17 1.02-.16l.94-1.21z"/>
                    </svg>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-6 flex flex-col gap-4 text-sm text-slate-400 font-mono text-xs">
          {isForceChangeMode ? (
            <div className="text-center text-slate-500 uppercase">
              Secure Administration console rotation active.
            </div>
          ) : (mode === "login" || mode === "register") ? (
            <>
              <div className="flex justify-between items-center w-full">
                <Link to="/" className="hover:text-white transition-colors">← Back home</Link>
                {mode === "login" && !puzzleActive && (
                  <button type="button" className="hover:text-white transition-colors" onClick={() => setShowForgotPassword(true)}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="text-[10px] border-t border-white/5 pt-4 text-center">
                {mode === "login" ? (
                  <>
                    New to PBUrls?{" "}
                    <button type="button" onClick={() => { setPuzzleActive(false); switchMode("register"); }} className="text-blue-400 font-semibold hover:text-blue-300 transition cursor-pointer">
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => { setPuzzleActive(false); switchMode("login"); }} className="text-blue-400 font-semibold hover:text-blue-300 transition cursor-pointer">
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center w-full">
              <button type="button" className="hover:text-white transition-colors" onClick={() => { setPuzzleActive(false); switchMode("login"); }}>
                Back to sign in
              </button>
              <Link to="/" className="hover:text-white transition-colors">Back home</Link>
            </div>
          )}
        </div>
      </div>
      {showForgotPassword ? <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} /> : null}
    </div>
  );
}

export default AuthPage;
