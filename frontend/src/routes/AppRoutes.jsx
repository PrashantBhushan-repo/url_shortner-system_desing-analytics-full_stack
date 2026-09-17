import { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Home from "../pages/Home";
import AuthPage from "../pages/AuthPage";
import OAuthCallbackPage from "../pages/OAuthCallbackPage";
import DashboardPage from "../pages/DashboardPage";
import SettingsPage from "../pages/SettingsPage";
import AnalyticsPage from "../pages/Analytics";
import PricingPage from "../pages/PricingPage";
import PasswordProtectedPage from "../pages/PasswordProtectedPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import AdminRoute from "../components/admin/AdminRoute";
import AdminDashboard from "../pages/admin/AdminDashboard";
import EvaluatorBypass from "../components/auth/EvaluatorBypass";
import AiAssistantWidget from "../components/ai/AiAssistantWidget";

function PageTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get("mode");

    if (path === "/auth") {
      document.title = mode === "register" || mode === "signup"
        ? "Sign Up | pburls.online"
        : "Sign In | pburls.online";
    } else if (path === "/dashboard") {
      document.title = "Dashboard | pburls.online";
    } else if (path.startsWith("/analytics")) {
      document.title = "Analytics | pburls.online";
    } else if (path === "/pricing") {
      document.title = "Pricing & Plans | pburls.online";
    } else if (path === "/billing" || path === "/refunds" || path === "/refund") {
      document.title = "Billing & Refunds | pburls.online";
    } else if (path === "/settings") {
      document.title = "Settings | pburls.online";
    } else if (path.startsWith("/admin")) {
      document.title = "Admin Console | pburls.online";
    } else if (path.startsWith("/p/")) {
      document.title = "Protected Link | pburls.online";
    } else if (path === "/oauth/callback") {
      document.title = "Authenticating | pburls.online";
    } else {
      document.title = "pburls.online — Modern URL Shortener & Analytics";
    }
  }, [location]);

  return null;
}

function AppRoutes() {
  const { token, user } = useAuth();

  return (
    <Router>
      <PageTitleManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/p/:shortCode" element={<PasswordProtectedPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analytics/:urlId" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/refunds" element={<SettingsPage defaultTab="subscription" />} />
          <Route path="/refund" element={<SettingsPage defaultTab="subscription" />} />
          <Route path="/billing" element={<SettingsPage defaultTab="subscription" />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
      <EvaluatorBypass />
      <AiAssistantWidget key={user?.id || "guest"} />
    </Router>
  );
}

export default AppRoutes;

