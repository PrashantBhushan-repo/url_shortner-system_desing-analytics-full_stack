
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "../pages/Home";
import AuthPage from "../pages/AuthPage";
import DashboardPage from "../pages/DashboardPage";
import SettingsPage from "../pages/SettingsPage";
import AnalyticsPage from "../pages/Analytics";
import PricingPage from "../pages/PricingPage";
import PasswordProtectedPage from "../pages/PasswordProtectedPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import AdminRoute from "../components/admin/AdminRoute";
import AdminDashboard from "../pages/admin/AdminDashboard";

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/p/:shortCode" element={<PasswordProtectedPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analytics/:urlId" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRoutes;

