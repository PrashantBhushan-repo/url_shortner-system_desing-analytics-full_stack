import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { safeReturnTo } from '../routes/navigation';
import "../pages/workspace.css";

/**
 * WorkspaceShell
 * Shell layout for all protected workspace pages.
 *
 * Props:
 *   title      – Page title shown in the breadcrumb (e.g. "Link analytics")
 *   backTo     – Override the back-button destination (default: /dashboard)
 *   backLabel  – Label for the back button (default: "Back to links")
 *   children   – Page content
 */
export default function WorkspaceShell({
  children,
  title = "Workspace",
  backTo,
  backLabel,
}) {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();

  // Resolve back destination — prefer explicit prop, then location state, then /dashboard
  const resolvedBack = backTo
    || (state?.from?.startsWith('/dashboard') ? safeReturnTo(state.from) : '/dashboard');
  const resolvedLabel = backLabel || "Back to links";

  const isAnalytics = pathname.startsWith('/analytics');

  return (
    <div className="workspace-page">
      <a className="ws-skip" href="#workspace-main">Skip to workspace</a>
      <SiteHeader workspace />
      <main className="ws-container" id="workspace-main">

        {/* ── Breadcrumb bar ── */}
        <nav className="ws-breadcrumb" aria-label="Breadcrumb">
          <Link to="/dashboard" className="ws-breadcrumb-home" aria-label="Workspace home">
            <LayoutDashboard size={13} />
            <span>Workspace</span>
          </Link>
          <ChevronRight size={12} className="ws-breadcrumb-sep" aria-hidden="true" />
          <span aria-current="page" className="ws-breadcrumb-current">{title}</span>

          {/* Back pill — only on sub-pages (not dashboard itself) */}
          {isAnalytics && (
            <button
              type="button"
              className="ws-back-pill"
              onClick={() => navigate(resolvedBack)}
              aria-label={resolvedLabel}
            >
              <ArrowLeft size={13} />
              {resolvedLabel}
            </button>
          )}
        </nav>

        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
