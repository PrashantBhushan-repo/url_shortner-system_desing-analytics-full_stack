import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { evaluatorBypass, getProfile } from "../../services/authApi";
import { Shield, Zap, AlertCircle, Move, LogOut, Maximize2, Minimize2 } from "lucide-react";
import bhagatSinghImg from "../../assets/bhagat_singh.png";

function EvaluatorBypass() {
  const { token, user, login, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Draggable window coordinates state
  const [position, setPosition] = useState({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 24, initialY: 80, hasMoved: false });

  // Minimized state, defaults to false for clear visibility
  const [isMinimized, setIsMinimized] = useState(false);

  // Smart Visibility: Show bypass widget if user is logged out, OR
  // if they logged in specifically via the evaluator bypass session.
  const isBypassSession =
    typeof window !== "undefined" && window.localStorage.getItem("pburls_evaluator_session") === "true";
  const shouldRenderBypass = !token || isBypassSession;

  const startDrag = (clientX, clientY) => {
    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
    };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragRef.current.hasMoved = true;
      }

      const newX = dragRef.current.initialX - deltaX;
      const newY = dragRef.current.initialY + deltaY;

      // Clamp coordinates to keep panel inside viewport boundaries
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const widthLimit = isMinimized ? 240 : 380; 
      const heightLimit = isMinimized ? 50 : 300;

      setPosition({
        x: Math.min(Math.max(10, newX), screenWidth - widthLimit - 10),
        y: Math.min(Math.max(10, newY), screenHeight - heightLimit - 10),
      });
    };

    const handleTouchMove = (e) => {
      if (!isDragging || !e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragRef.current.startX;
      const deltaY = touch.clientY - dragRef.current.startY;
      
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragRef.current.hasMoved = true;
      }

      const newX = dragRef.current.initialX - deltaX;
      const newY = dragRef.current.initialY + deltaY;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const widthLimit = isMinimized ? 240 : 380; 
      const heightLimit = isMinimized ? 50 : 300;

      setPosition({
        x: Math.min(Math.max(10, newX), screenWidth - widthLimit - 10),
        y: Math.min(Math.max(10, newY), screenHeight - heightLimit - 10),
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleEnd);
      window.addEventListener("touchcancel", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [isDragging, isMinimized]);

  const handleBypass = async (role) => {
    setLoading(true);
    setError("");
    try {
      const response = await evaluatorBypass(role);
      const { accessToken } = response.data.data;
      
      const profileResponse = await getProfile(accessToken);
      const profile = profileResponse.data?.data;
      
      localStorage.setItem("pburls_evaluator_session", "true");
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

  const handleLogout = async () => {
    localStorage.removeItem("pburls_evaluator_session");
    await logout();
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

  return (
    <div 
      className={`fixed z-[9999] font-mono text-xs select-none touch-none ${
        isDragging ? "transition-none pointer-events-auto" : "transition-[top,right] duration-150 ease-out"
      }`}
      style={{
        top: `${position.y}px`,
        right: `${position.x}px`,
      }}
    >
      {isMinimized ? (
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={() => {
            if (!dragRef.current.hasMoved) {
              setIsMinimized(false);
            }
          }}
          className="group flex items-center gap-3 rounded-full border-2 border-[#E50914] bg-white dark:bg-zinc-950 py-2 pl-2 pr-3 shadow-[0_8px_30px_rgba(229,9,20,0.35)] backdrop-blur-xl cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-all duration-200 max-w-[270px] h-13"
          title="Click to open • Drag to move"
        >
          <div className="relative shrink-0">
            <img 
              src={bhagatSinghImg} 
              alt="Bhagat Singh" 
              className="w-9 h-9 rounded-full border-2 border-[#E50914] object-cover ring-2 ring-red-500/20 shadow-md group-hover:scale-105 transition duration-200"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#E50914] border-2 border-white dark:border-black flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>

          <div className="flex flex-col text-left leading-tight flex-1 min-w-0">
            <span className="text-[12px] font-black text-[#E50914] tracking-wider uppercase truncate">
              FREEDOM GATEWAY
            </span>
            <span className="text-[9px] text-slate-700 dark:text-slate-300 font-sans font-bold tracking-wide flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              Instant 1-Click Access
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="p-1.5 bg-[#E50914] hover:bg-[#F40B16] text-white rounded-full transition-all duration-200 cursor-pointer shrink-0 shadow-sm"
            title="Open Bhagat Singh Freedom Gateway"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="w-[380px] max-w-[calc(100vw-24px)] rounded-3xl border-2 border-[#E50914] bg-white dark:bg-zinc-900 p-5 text-slate-900 dark:text-slate-100 shadow-[0_12px_40px_rgba(229,9,20,0.25)] backdrop-blur-2xl space-y-4 transition-all duration-200 relative overflow-hidden">
          
          {/* Header / Drag Handle */}
          <div 
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onDoubleClick={() => setIsMinimized(true)}
            className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3.5 cursor-grab active:cursor-grabbing relative z-10"
            title="Drag header to move • Double click to minimize"
          >
            <div className="relative shrink-0">
              <img 
                src={bhagatSinghImg} 
                alt="Bhagat Singh" 
                className="w-12 h-12 rounded-2xl border-2 border-[#E50914] object-cover shadow-md ring-2 ring-red-500/20"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E50914] border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="leading-tight">
                <span className="text-[11px] font-black tracking-wider uppercase text-slate-900 dark:text-white block">
                  BHAGAT SINGH
                </span>
                <span className="text-[#E50914] text-[14px] font-black uppercase tracking-wider block">
                  FREEDOM GATEWAY
                </span>
              </div>
              <div className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-0.5 flex items-center gap-1.5 select-none">
                <span className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-ping"></span>
                <span>Visit Fast. Sign Up Later.</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="px-2 py-1 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-100 hover:bg-[#E50914] dark:bg-zinc-800 dark:hover:bg-[#E50914] text-slate-800 hover:text-white dark:text-slate-200 font-bold text-[9px] uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm flex items-center gap-1"
                title="Minimize gateway"
              >
                <Minimize2 className="w-3 h-3" />
                <span>MINIMIZE</span>
              </button>
              <div className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-800 dark:hover:text-white transition" title="Drag to move">
                <Move className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-3.5 text-left relative z-10">
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
              {token 
                ? `Session active: logged in as ${currentRole === "ADMIN" ? "System Admin" : "Demo User"}.`
                : "Experience the platform instantly with pre-configured access channels:"}
            </p>

            {error && (
              <div className="p-3 border border-rose-300 dark:border-rose-500 bg-rose-100 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200 rounded-xl flex gap-2 items-start text-[10.5px]">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {token ? (
                <>
                  {currentRole === "ADMIN" ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleBypass("USER")}
                      className="flex items-center justify-between px-4 py-3 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:hover:bg-cyan-900/40 border-2 border-cyan-500/60 text-cyan-950 dark:text-cyan-200 font-black rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs uppercase tracking-wider shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400 fill-cyan-500" />
                        <span>Switch to Demo User</span>
                      </div>
                      <span className="text-[8.5px] bg-cyan-200 dark:bg-cyan-900/60 border border-cyan-400 dark:border-cyan-600 text-cyan-950 dark:text-cyan-200 px-2 py-0.5 rounded-full font-mono font-bold">
                        INSTANT
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleBypass("ADMIN")}
                      className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#E50914] to-[#C80812] hover:from-[#F40B16] hover:to-[#E50914] text-white font-black rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-red-500/25 uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-white" />
                        <span>Switch to System Admin</span>
                      </div>
                      <span className="text-[8.5px] bg-black/30 border border-white/30 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                        ALL ACCESS
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full py-2.5 border border-slate-300 dark:border-zinc-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs uppercase tracking-wider shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Exit Session & Log Out</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleBypass("USER")}
                    className="flex items-center justify-between px-4 py-3 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:hover:bg-cyan-900/40 border-2 border-cyan-500/60 text-cyan-950 dark:text-cyan-200 font-black rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs uppercase tracking-wider shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400 fill-cyan-500" />
                      <span>Log In as Demo User</span>
                    </div>
                    <span className="text-[8.5px] bg-cyan-200 dark:bg-cyan-900/60 border border-cyan-400 dark:border-cyan-600 text-cyan-950 dark:text-cyan-200 px-2 py-0.5 rounded-full font-mono font-bold">
                      INSTANT 1-CLICK
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleBypass("ADMIN")}
                    className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#E50914] to-[#C80812] hover:from-[#F40B16] hover:to-[#E50914] text-white font-black rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 text-xs shadow-md shadow-red-500/25 uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-white" />
                      <span>Log In as System Admin</span>
                    </div>
                    <span className="text-[8.5px] bg-black/30 border border-white/30 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                      FULL CONTROL
                    </span>
                  </button>
                </>
              )}
            </div>
            
            <div className="text-[9px] text-center text-slate-600 dark:text-slate-400 uppercase tracking-widest pt-1 font-bold flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span>{loading ? "PROVISIONING ACCESS..." : "1-CLICK INSTANT FREEDOM ACCESS"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluatorBypass;
