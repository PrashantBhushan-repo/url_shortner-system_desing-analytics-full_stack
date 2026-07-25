import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { evaluatorBypass, getProfile } from "../../services/authApi";
import { Shield, Zap, AlertCircle, Move, LogOut } from "lucide-react";
import bhagatSinghImg from "../../assets/bhagat_singh.png";

function EvaluatorBypass() {
  const { token, user, login, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Draggable window coordinates state
  const [position, setPosition] = useState({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Minimized state, persisted in localStorage
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("snapurl_bypass_minimized") === "true";
  });

  // Smart Visibility: Only show the bypass widget if the user is logged out, OR
  // if they logged in specifically via the evaluator bypass session.
  const isBypassSession =
    typeof window !== "undefined" && window.localStorage.getItem("snapurl_evaluator_session") === "true";
  const shouldRenderBypass = !token || isBypassSession;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      setPosition({
        x: Math.max(10, dragRef.current.initialX - deltaX),
        y: Math.max(10, dragRef.current.initialY + deltaY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleBypass = async (role) => {
    setLoading(true);
    setError("");
    try {
      const response = await evaluatorBypass(role);
      const { accessToken } = response.data.data;
      
      const profileResponse = await getProfile(accessToken);
      const profile = profileResponse.data?.data;
      
      localStorage.setItem("snapurl_evaluator_session", "true");
      login(accessToken);
      setUser(profile);
      
      if (role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate bypass session.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("snapurl_evaluator_session");
    logout();
    navigate("/");
  };

  const parseJwtRole = (t) => {
    try {
      const base64Url = t.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(window.atob(base64));
      return payload.role;
    } catch {
      return "USER";
    }
  };

  // Determine current active role of the bypass session
  const currentRole = token ? (user?.role || parseJwtRole(token)) : null;

  if (!shouldRenderBypass) {
    return null;
  }

  if (isMinimized) {
    return (
      <div 
        className="fixed z-[9999] font-mono select-none"
        style={{
          top: `${position.y}px`,
          right: `${position.x}px`,
        }}
      >
        <div 
          onMouseDown={handleMouseDown}
          className="flex items-center gap-2 rounded-full border-2 border-[#00F0FF] bg-[#0A0E17]/95 pl-2 pr-3 py-1.5 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] border-[#00F0FF]/90 transition duration-200 cursor-move active:cursor-grabbing"
          title="Drag widget. Double click to restore."
          onDoubleClick={() => {
            setIsMinimized(false);
            localStorage.setItem("snapurl_bypass_minimized", "false");
          }}
        >
          <img 
            src={bhagatSinghImg} 
            alt="Bhagat Singh" 
            className="w-7 h-7 rounded-full border border-[#00F0FF] object-cover shrink-0"
          />
          <div className="flex flex-col text-[8px] leading-tight font-black text-[#00F0FF] tracking-wider uppercase">
            <span>FREEDOM</span>
            <span className="text-[#00FF87] text-[6px]">GATEWAY</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
              localStorage.setItem("snapurl_bypass_minimized", "false");
            }}
            className="ml-1 p-1 hover:bg-[#00F0FF]/15 text-[#00F0FF] rounded transition cursor-pointer"
            title="Expand Gateway"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-[9999] font-mono text-xs max-w-sm w-full sm:w-80 select-none"
      style={{
        top: `${position.y}px`,
        right: `${position.x}px`,
      }}
    >
      <div className="rounded-2xl border-2 border-[#00F0FF] bg-[#0A0E17]/95 p-5 shadow-[0_0_45px_rgba(0,240,255,0.4)] backdrop-blur-md">
        
        {/* Header / Drag Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className="flex items-center gap-3 border-b border-[#00F0FF]/25 pb-3 mb-3 cursor-move active:cursor-grabbing"
          title="Hold click to drag console"
        >
          <img 
            src={bhagatSinghImg} 
            alt="Bhagat Singh" 
            className="w-10 h-10 rounded-full border-2 border-[#00F0FF] object-cover shadow-[0_0_15px_rgba(0,240,255,0.5)] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-black text-[#00F0FF] tracking-wider uppercase leading-tight">
              BHAGAT SINGH-FREEDOM GETWAY
            </div>
            <div className="text-[9px] font-bold text-[#00FF87] uppercase tracking-wider mt-0.5">
          No Login. No Payment. Just Freedom..
          Explore First. Sign In Later.
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setIsMinimized(true);
                localStorage.setItem("snapurl_bypass_minimized", "true");
              }}
              className="p-1 rounded hover:bg-[#00F0FF]/15 text-slate-400 hover:text-[#00F0FF] transition cursor-pointer"
              title="Minimize console"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <Move className="w-3.5 h-3.5 text-slate-500 cursor-move active:cursor-grabbing" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-slate-200 leading-relaxed font-sans font-bold">
            {token 
              ? `Authorized bypass session active as ${currentRole === "ADMIN" ? "System Administrator" : "Demo Workspace User"}.`
              : "🔒 Developer Authorization Active: Click below to log in instantly without typing passwords or verifying email OTPs."}
          </p>

          {error && (
            <div className="p-2 border border-rose-500 bg-rose-950/30 text-rose-200 rounded-lg flex gap-1.5 items-start text-[10px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {token ? (
              <>
                {currentRole === "ADMIN" ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleBypass("USER")}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#00F0FF] text-black font-extrabold rounded-xl transition hover:bg-[#00D0EE] active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-[#00F0FF]/25"
                  >
                    <Zap className="w-4 h-4 text-black fill-black" />
                    <span>VISIT AS DEMO USER</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleBypass("ADMIN")}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#FF0055] text-white font-extrabold rounded-xl transition hover:bg-[#EE004F] active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-[#FF0055]/25"
                  >
                    <Shield className="w-4 h-4 text-white" />
                    <span>VISIT AS SYSTEM ADMIN</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-extrabold rounded-xl transition active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                  <span>LOG OUT SESSION</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleBypass("USER")}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#00F0FF] text-black font-extrabold rounded-xl transition hover:bg-[#00D0EE] active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-[#00F0FF]/25"
                >
                  <Zap className="w-4 h-4 text-black fill-black" />
                  <span>LOG IN AS DEMO USER</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleBypass("ADMIN")}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#FF0055] text-white font-extrabold rounded-xl transition hover:bg-[#EE004F] active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-[#FF0055]/25"
                >
                  <Shield className="w-4 h-4 text-white" />
                  <span>LOG IN AS SYSTEM ADMIN</span>
                </button>
              </>
            )}
          </div>
          
          <div className="text-[9px] text-center text-slate-400 uppercase tracking-widest pt-1 font-bold">
            {loading ? "CONFIGURING SECURE TOKENS..." : "1-CLICK DIRECT ACCESSIBILITY"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EvaluatorBypass;
