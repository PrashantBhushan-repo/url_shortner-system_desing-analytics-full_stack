import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

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

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      navigate(`/auth?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (token) {
      try {
        // Authenticate user via AuthContext
        login(token);

        // Parse token payload to redirect dynamically by user role
        const payload = parseJwtPayload(token);
        if (payload.role === "ADMIN") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("Error logging in via OAuth callback:", err);
        navigate("/auth?error=Failed+to+initialize+session", { replace: true });
      }
    } else {
      navigate("/auth?error=No+authentication+token+received", { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 font-sans text-white">
      
      {/* Brand Logo */}
      <div className="flex justify-center mb-6">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <span className="font-black tracking-tighter text-white text-4xl">
            pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
          </span>
        </Link>
      </div>

      <div className="flex flex-col items-center max-w-md w-full p-8 text-center bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-2xl backdrop-blur-md">
        {/* Animated Double-Ring Loader */}
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-b-indigo-500 border-t-transparent border-r-transparent border-l-transparent animate-spin-reverse opacity-80"></div>
        </div>
        
        <h2 className="text-xl font-bold tracking-tight text-white mb-2">
          Securing Authenticated Session
        </h2>
        <p className="text-sm text-slate-400 font-mono">
          Redirecting you to dashboard...
        </p>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
