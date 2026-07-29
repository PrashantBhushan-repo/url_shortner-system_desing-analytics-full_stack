import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import API from "../../services/urlApi";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  Users,
  Link as LinkIcon,
  Shield,
  Clock,
  Search,
  Ban,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Trash2,
  Lock,
  Calendar,
  Layers,
  LogOut,
  CreditCard,
  Ticket,
  Activity,
  TrendingUp,
  Download,
  RefreshCw,
  Plus,
  Cpu,
  Server
} from "lucide-react";

const COLORS = ["#475569", "#6366f1", "#FF0055", "#10b981"]; // Free, Starter, Pro, Business

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Overview Tab States
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Users Tab States
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersStatusFilter, setUsersStatusFilter] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState("");
  const [usersPlanFilter, setUsersPlanFilter] = useState("");

  // User Detail Modal States
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // URL Moderation Tab States
  const [urlsList, setUrlsList] = useState([]);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [urlsPage, setUrlsPage] = useState(1);
  const [urlsTotalPages, setUrlsTotalPages] = useState(1);
  const [urlsSearch, setUrlsSearch] = useState("");
  const [urlsStatusFilter, setUrlsStatusFilter] = useState("");

  // Payments Tab States
  const [paymentsList, setPaymentsList] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsEmail, setPaymentsEmail] = useState("");
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState("");
  const [paymentsPlanFilter, setPaymentsPlanFilter] = useState("");

  // Invoice Adjustments Modal States
  const [invoiceEditDialog, setInvoiceEditDialog] = useState(null); // payment object
  const [invoiceCompanyName, setInvoiceCompanyName] = useState("");
  const [invoiceTaxId, setInvoiceTaxId] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceStatusOverride, setInvoiceStatusOverride] = useState("");

  // Refund Modal States
  const [refundDialog, setRefundDialog] = useState(null); // { paymentId, amount, currency }
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundPassword, setRefundPassword] = useState("");
  const [refundRequestApproval, setRefundRequestApproval] = useState(false);

  // Webhooks Tab States
  const [webhooksList, setWebhooksList] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhooksPage, setWebhooksPage] = useState(1);
  const [webhooksTotalPages, setWebhooksTotalPages] = useState(1);
  const [webhooksProcessedFilter, setWebhooksProcessedFilter] = useState("");
  const [webhooksTypeFilter, setWebhooksTypeFilter] = useState("");

  // Coupons Tab States
  const [couponsList, setCouponsList] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    description: "",
    discount_type: "PERCENT",
    discount_value: "",
    applicable_plans: "",
    max_redemptions: "",
    valid_until: "",
  });

  // Audit Logs Tab States
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditTargetFilter, setAuditTargetFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  // Revenue Operations Tab States (Advanced Reports)
  const [billingReports, setBillingReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Finance Reconciliation Tab States
  const [reconciliationList, setReconciliationList] = useState([]);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  // Approval Queue Tab States
  const [approvalsList, setApprovalsList] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalDecisionReason, setApprovalDecisionReason] = useState("");

  // Mutative Action Dialog States
  const [statusDialog, setStatusDialog] = useState(null); // { userId, targetStatus, userEmail }
  const [statusReason, setStatusReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [mutating, setMutating] = useState(false);

  const [deleteUrlDialog, setDeleteUrlDialog] = useState(null); // { urlId, shortCode }
  const [deleteReason, setDeleteReason] = useState("");

  // Subscription Lifecycle dialogs inside detail modal
  const [prorateDays, setProrateDays] = useState("");
  const [changePlanKey, setChangePlanKey] = useState("pro");
  const [changePlanCycle, setChangePlanCycle] = useState("MONTHLY");
  const [lifecycleRequestApproval, setLifecycleRequestApproval] = useState(false);

  // Fetch Overview Data
  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      setError("");
      const response = await API.get("/admin/dashboard/overview");
      setOverviewData(response.data?.data || null);
    } catch {
      setError("Failed to load dashboard overview.");
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setError("");
      const params = {
        page: usersPage,
        limit: 10,
        search: usersSearch || undefined,
        status: usersStatusFilter || undefined,
        role: usersRoleFilter || undefined,
        plan: usersPlanFilter || undefined,
      };
      const response = await API.get("/admin/users", { params });
      setUsersList(response.data?.data || []);
      setUsersTotalPages(response.data?.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users list.");
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch URLs
  const fetchUrls = async () => {
    try {
      setUrlsLoading(true);
      setError("");
      const params = {
        page: urlsPage,
        limit: 10,
        search: urlsSearch || undefined,
        status: urlsStatusFilter || undefined,
      };
      const response = await API.get("/admin/urls", { params });
      setUrlsList(response.data?.data || []);
      setUrlsTotalPages(response.data?.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load URLs list.");
    } finally {
      setUrlsLoading(false);
    }
  };

  // Fetch Payments
  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      setError("");
      const params = {
        page: paymentsPage,
        limit: 10,
        status: paymentsStatusFilter || undefined,
        email: paymentsEmail || undefined,
        planKey: paymentsPlanFilter || undefined,
      };
      const response = await API.get("/admin/payments", { params });
      setPaymentsList(response.data?.data || []);
      setPaymentsTotalPages(response.data?.meta?.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments list.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Fetch Coupons
  const fetchCoupons = async () => {
    try {
      setCouponsLoading(true);
      setError("");
      const response = await API.get("/admin/coupons");
      setCouponsList(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load coupons.");
    } finally {
      setCouponsLoading(false);
    }
  };

  // Fetch Webhooks
  const fetchWebhooks = async () => {
    try {
      setWebhooksLoading(true);
      setError("");
      const params = {
        page: webhooksPage,
        limit: 10,
        processed: webhooksProcessedFilter || undefined,
        eventType: webhooksTypeFilter || undefined,
      };
      const response = await API.get("/admin/webhooks/events", { params });
      setWebhooksList(response.data?.data || []);
      setWebhooksTotalPages(response.data?.meta?.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load webhook events.");
    } finally {
      setWebhooksLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      setError("");
      const params = {
        page: auditPage,
        limit: 10,
        action: auditActionFilter || undefined,
        targetType: auditTargetFilter || undefined,
        search: auditSearch || undefined,
        includeLogins: "true",
      };
      const response = await API.get("/admin/audit-log", { params });
      setAuditLogsList(response.data?.data || []);
      setAuditTotalPages(response.data?.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load audit logs.");
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch Advanced Billing Reports (RevOps)
  const fetchBillingReports = async () => {
    try {
      setReportsLoading(true);
      setError("");
      const response = await API.get("/admin/dashboard/billing-reports");
      setBillingReports(response.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load billing telemetry reports.");
    } finally {
      setReportsLoading(false);
    }
  };

  // Fetch Reconciliation exceptions list
  const fetchReconciliation = async () => {
    try {
      setReconciliationLoading(true);
      setError("");
      const response = await API.get("/admin/payments/reconciliation");
      setReconciliationList(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reconciliation diagnostics.");
    } finally {
      setReconciliationLoading(false);
    }
  };

  // Fetch approvals queue
  const fetchApprovalsQueue = async () => {
    try {
      setApprovalsLoading(true);
      setError("");
      const response = await API.get("/admin/approvals");
      setApprovalsList(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load approval queues.");
    } finally {
      setApprovalsLoading(false);
    }
  };

  const fetchUserDetail = async (userId) => {
    try {
      setUserDetailLoading(true);
      setUserDetail(null);
      const response = await API.get(`/admin/users/${userId}`);
      setUserDetail(response.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load user details.");
    } finally {
      setUserDetailLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeTab === "overview") {
      fetchOverview();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "urls") {
      fetchUrls();
    } else if (activeTab === "payments") {
      fetchPayments();
    } else if (activeTab === "coupons") {
      fetchCoupons();
    } else if (activeTab === "webhooks") {
      fetchWebhooks();
    } else if (activeTab === "revops") {
      fetchBillingReports();
    } else if (activeTab === "reconcile") {
      fetchReconciliation();
    } else if (activeTab === "approvals") {
      fetchApprovalsQueue();
    } else if (activeTab === "audit") {
      fetchAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    usersPage,
    urlsPage,
    paymentsPage,
    webhooksPage,
    auditPage,
    auditActionFilter,
    auditTargetFilter,
    auditSearch,
    usersStatusFilter,
    usersRoleFilter,
    usersPlanFilter,
    urlsStatusFilter,
    paymentsStatusFilter,
    paymentsPlanFilter,
    webhooksProcessedFilter,
    webhooksTypeFilter
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Search submits
  const handleUsersSearchSubmit = (e) => {
    e.preventDefault();
    setUsersPage(1);
    fetchUsers();
  };

  const handleUrlsSearchSubmit = (e) => {
    e.preventDefault();
    setUrlsPage(1);
    fetchUrls();
  };

  const handlePaymentsSearchSubmit = (e) => {
    e.preventDefault();
    setPaymentsPage(1);
    fetchPayments();
  };

  // Export payments
  const handleExportPaymentsCsv = async () => {
    try {
      setError("");
      const params = {
        status: paymentsStatusFilter || undefined,
        email: paymentsEmail || undefined,
        planKey: paymentsPlanFilter || undefined,
        export: "csv",
      };
      const response = await API.get("/admin/payments", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payments_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("Failed to export payments CSV file.");
    }
  };

  // Role updates
  const handleRoleChange = async (userId, targetRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) return;
    try {
      setError("");
      setSuccess("");
      await API.patch(`/admin/users/${userId}/role`, { role: targetRole });
      setSuccess(`User role successfully changed to ${targetRole}.`);
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        fetchUserDetail(userId);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role.");
    }
  };

  // Status Dialog submits
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusDialog) return;

    try {
      setMutating(true);
      setError("");
      setSuccess("");

      const payload = {
        status: statusDialog.targetStatus,
        reason: statusReason,
        adminPassword: statusDialog.targetStatus === "BANNED" ? adminPassword : undefined,
      };

      await API.patch(`/admin/users/${statusDialog.userId}/status`, payload);
      setSuccess(`User status successfully set to ${statusDialog.targetStatus}.`);
      setStatusDialog(null);
      setStatusReason("");
      setAdminPassword("");
      fetchUsers();
      if (selectedUser && selectedUser.id === statusDialog.userId) {
        fetchUserDetail(statusDialog.userId);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change user status.");
    } finally {
      setMutating(false);
    }
  };

  // URL Deletion
  const handleDeleteUrlSubmit = async (e) => {
    e.preventDefault();
    if (!deleteUrlDialog) return;

    try {
      setMutating(true);
      setError("");
      setSuccess("");

      await API.delete(`/admin/urls/${deleteUrlDialog.urlId}`, {
        data: { reason: deleteReason },
      });

      setSuccess("URL successfully removed by moderation.");
      setDeleteUrlDialog(null);
      setDeleteReason("");
      fetchUrls();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete URL.");
    } finally {
      setMutating(false);
    }
  };

  // Refund Submit (Support queuing and Direct processing based on parameters)
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundDialog) return;

    try {
      setMutating(true);
      setError("");
      setSuccess("");

      const response = await API.post(`/admin/payments/${refundDialog.paymentId}/refund`, {
        amount: refundAmount ? parseInt(refundAmount) : undefined,
        reason: refundReason,
        adminPassword: refundPassword,
        requestApproval: refundRequestApproval,
      });

      if (response.data?.queued) {
        setSuccess(response.data.message || "Dual-operator approval request queued successfully.");
      } else {
        setSuccess("Refund successfully processed.");
      }

      setRefundDialog(null);
      setRefundAmount("");
      setRefundReason("");
      setRefundPassword("");
      setRefundRequestApproval(false);
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process refund action.");
    } finally {
      setMutating(false);
    }
  };

  // Webhook reprocess
  const handleReprocessWebhook = async (eventId) => {
    if (!window.confirm("Are you sure you want to force reprocess this webhook event?")) return;
    try {
      setError("");
      setSuccess("");
      await API.post(`/admin/webhooks/events/${eventId}/reprocess`);
      setSuccess("Webhook event successfully reprocessed.");
      fetchWebhooks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reprocess webhook.");
    }
  };

  // Create Coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      setMutating(true);
      setError("");
      setSuccess("");

      const payload = {
        code: newCoupon.code,
        description: newCoupon.description || undefined,
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_type === "FLAT" ? parseInt(newCoupon.discount_value) * 100 : parseInt(newCoupon.discount_value),
        applicable_plans: newCoupon.applicable_plans ? newCoupon.applicable_plans.split(",").map(p => p.trim()) : [],
        max_redemptions: newCoupon.max_redemptions ? parseInt(newCoupon.max_redemptions) : undefined,
        valid_until: newCoupon.valid_until || undefined,
      };

      await API.post("/admin/coupons", payload);
      setSuccess("Coupon created successfully.");
      setCouponFormOpen(false);
      setNewCoupon({
        code: "",
        description: "",
        discount_type: "PERCENT",
        discount_value: "",
        applicable_plans: "",
        max_redemptions: "",
        valid_until: "",
      });
      fetchCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create coupon.");
    } finally {
      setMutating(false);
    }
  };

  // Toggle Coupon status
  const handleToggleCoupon = async (couponId, currentStatus) => {
    try {
      setError("");
      setSuccess("");
      await API.patch(`/admin/coupons/${couponId}`, { is_active: !currentStatus });
      setSuccess("Coupon status toggled successfully.");
      fetchCoupons();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle coupon status.");
    }
  };

  /**
   * INVOICE DETAIL ADJUSTMENTS & DUNNING CONTROL OPERATIONS
   */
  const openInvoiceEdit = (pay) => {
    const meta = pay.metadata || {};
    setInvoiceEditDialog(pay);
    setInvoiceCompanyName(meta.companyName || "");
    setInvoiceTaxId(meta.taxId || "");
    setInvoiceNotes(meta.adminNotes || "");
    setInvoiceStatusOverride(pay.status);
  };

  const handleInvoiceEditSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceEditDialog) return;
    try {
      setError("");
      setSuccess("");
      await API.patch(`/admin/payments/${invoiceEditDialog.id}/invoice`, {
        companyName: invoiceCompanyName,
        taxId: invoiceTaxId,
        notes: invoiceNotes,
        status: invoiceStatusOverride,
      });
      setSuccess("Billing statement details updated successfully.");
      setInvoiceEditDialog(null);
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update billing statement.");
    }
  };

  const triggerDunningRetryAction = async (paymentId) => {
    try {
      setError("");
      setSuccess("");
      const res = await API.post(`/admin/payments/${paymentId}/dunning-retry`);
      setSuccess(res.data?.message || "Dunning retry callback fired.");
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fire dunning retry.");
    }
  };

  const triggerWriteOffAction = async (paymentId) => {
    if (!window.confirm("Are you sure you want to write off this failed invoice record?")) return;
    try {
      setError("");
      setSuccess("");
      await API.post(`/admin/payments/${paymentId}/write-off`);
      setSuccess("Invoice record marked as write-off.");
      fetchPayments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to write off payment.");
    }
  };

  /**
   * WEBHOOK STATE RECONCILIATION ACTIONS
   */
  const handleReconcileSyncAction = async (paymentId) => {
    try {
      setError("");
      setSuccess("");
      await API.post(`/admin/payments/${paymentId}/reconcile-sync`);
      setSuccess("State mismatch successfully resolved and synchronized.");
      fetchReconciliation();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reconcile sync.");
    }
  };

  /**
   * SUBSCRIPTION LIFECYCLE CONTROLLER ACTIONS
   */
  const handleLifecycleAction = async (action, subId, body = {}) => {
    try {
      setError("");
      setSuccess("");
      const res = await API.patch(`/admin/subscriptions/${subId}/${action}`, body);
      setSuccess(res.data?.message || `Subscription action '${action}' completed.`);
      if (userDetail && userDetail.profile) {
        fetchUserDetail(userDetail.profile.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to perform subscription lifecycle action '${action}'.`);
    }
  };

  const handlePlanChangeSubmit = async (subId) => {
    try {
      setError("");
      setSuccess("");
      const response = await API.post(`/admin/subscriptions/${subId}/change-plan`, {
        planKey: changePlanKey,
        billingCycle: changePlanCycle,
        requestApproval: lifecycleRequestApproval,
      });

      if (response.data?.queued) {
        setSuccess("Change plan request queued in the Approval Queue.");
      } else {
        setSuccess("Plan update successfully processed.");
      }

      if (userDetail && userDetail.profile) {
        fetchUserDetail(userDetail.profile.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process plan change.");
    }
  };

  /**
   * DUAL CONTROL DECISIONS
   */
  const handleApprovalDecisionSubmit = async (requestId, decision) => {
    try {
      setError("");
      setSuccess("");
      const response = await API.post(`/admin/approvals/${requestId}/decide`, {
        status: decision,
        reason: approvalDecisionReason || undefined,
      });
      setSuccess(response.data?.message || `Request marked as ${decision}.`);
      setApprovalDecisionReason("");
      fetchApprovalsQueue();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit approval decisions.");
    }
  };

  const getSubscribersPieData = () => {
    if (!overviewData?.subscribers) return [];
    return Object.entries(overviewData.subscribers).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));
  };

  return (
    <div className="min-h-screen bg-[#08080C] text-slate-300 font-sans p-4 md:p-8 relative overflow-hidden">
      
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">

        {/* Telemetry status bar */}
        <div className="bg-[#0c0d12] border border-[#1b1e25] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-black text-[#00FF87] tracking-widest">SYS_TELEMETRY: ACTIVE</span>
            </div>
            <div className="h-4 w-px bg-[#1b1e25] hidden md:block" />
            <div>SECURE_CONN: <span className="text-[#00F0FF]">ESTABLISHED</span></div>
            <div className="h-4 w-px bg-[#1b1e25] hidden md:block" />
            <div>OPERATOR: <span className="text-slate-200">{user?.name} (ADMIN)</span></div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-slate-900/60 border border-white/5 hover:border-white/10 text-slate-300 py-1.5 px-3 rounded-lg hover:text-white transition flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <Layers className="w-3.5 h-3.5" /> APP PANEL
            </button>
            <button
              onClick={logout}
              className="bg-slate-900/60 border border-white/5 hover:border-[#FF0055]/30 hover:bg-[#FF0055]/5 text-slate-300 py-1.5 px-3 rounded-lg hover:text-[#FF0055] transition flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> SHUTDOWN
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs flex items-center gap-3 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs flex items-center gap-3 font-mono">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        {/* Industrial Tab Controls */}
        <div className="flex border-b border-[#1b1e25] gap-1 overflow-x-auto pb-px">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "users", label: "Users Registry", icon: Users },
            { id: "urls", label: "URLs Control", icon: LinkIcon },
            { id: "payments", label: "Payments Logs", icon: CreditCard },
            { id: "coupons", label: "Coupons Manager", icon: Ticket },
            { id: "webhooks", label: "Webhook Diagnostics", icon: Activity },
            { id: "revops", label: "RevOps reports", icon: Cpu },
            { id: "reconcile", label: "Reconciliation", icon: Server },
            { id: "approvals", label: "Approvals queue", icon: Shield },
            { id: "audit", label: "Audit Registry", icon: Clock }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition cursor-pointer whitespace-nowrap border-b-2 uppercase tracking-wider ${
                  isActive
                    ? "border-[#FF0055] text-white bg-slate-900/10"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#FF0055]" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Viewports */}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">Loading system metrics...</span>
              </div>
            ) : !overviewData ? (
              <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 border border-[#1b1e25] rounded-3xl font-mono text-xs">
                FAIL_FETCH: OVERVIEW_METRICS_DATA
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Normalized MRR", val: `₹${(overviewData.mrr / 100).toLocaleString("en-IN")}`, sub: "Active recurrent plan value", color: "border-cyan-500/20 text-[#00F0FF]" },
                    { label: "Revenue This Month", val: `₹${(overviewData.revenue.thisMonth / 100).toLocaleString("en-IN")}`, sub: `Prev: ₹${(overviewData.revenue.lastMonth / 100).toLocaleString("en-IN")}`, color: "border-[#00FF87] text-[#00FF87]" },
                    { label: "Failed Invoices (7d)", val: overviewData.failedPayments.count, sub: `Attempted: ₹${(overviewData.failedPayments.amount / 100).toLocaleString("en-IN")}`, color: "border-[#FF0055] text-[#FF0055]" },
                    { label: "Net growth (Month)", val: `+${overviewData.growth.newSubscriptions - overviewData.growth.cancellations}`, sub: `Churn Rate: ${overviewData.growth.churnRate}%`, color: "border-[#FFB800] text-[#FFB800]" }
                  ].map((card, idx) => (
                    <div key={idx} className={`bg-black/40 border ${card.color.split(" ")[0]} p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px]`}>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">{card.label}</span>
                      <h2 className={`text-3xl font-black font-mono tracking-tight mt-2 ${card.color.split(" ")[1]}`}>
                        {card.val}
                      </h2>
                      <p className="text-[9px] font-mono text-slate-500 mt-2 uppercase">{card.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-black/40 border border-[#1b1e25] p-6 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono">REVENUE TELEMETRY (12m Trend)</h3>
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-white/5 px-2 py-0.5 rounded">UNIT: INR PAISA</span>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={overviewData.mrrTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#121317" />
                          <XAxis dataKey="month" stroke="#475569" fontSize={9} fontClassName="font-mono" />
                          <YAxis stroke="#475569" fontSize={9} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#08080C", borderColor: "#1b1e25", borderRadius: "12px", fontFamily: "monospace", fontSize: "11px" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Revenue"]}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#FF0055" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-[#1b1e25] p-6 rounded-3xl flex flex-col justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4 font-mono">ACTIVE SUBSCRIPTIONS MIX</h3>
                    <div className="h-52 w-full flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getSubscribersPieData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {getSubscribersPieData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#08080C", borderColor: "#1b1e25", fontFamily: "monospace", fontSize: "11px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-[#1b1e25] pt-4 mt-2">
                      {Object.entries(overviewData.subscribers).map(([key, value], idx) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-slate-500 capitalize">{key}:</span>
                          <span className="font-bold text-slate-200">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Registry Tab */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-fade-in">
            <form onSubmit={handleUsersSearchSubmit} className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="SEARCH USERS BY EMAIL OR NAME..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] w-full font-mono uppercase"
                />
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={usersStatusFilter}
                  onChange={(e) => { setUsersStatusFilter(e.target.value); setUsersPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="BANNED">BANNED</option>
                  <option value="PENDING">PENDING</option>
                </select>

                <select
                  value={usersRoleFilter}
                  onChange={(e) => { setUsersRoleFilter(e.target.value); setUsersPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL ROLES</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <select
                  value={usersPlanFilter}
                  onChange={(e) => { setUsersPlanFilter(e.target.value); setUsersPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL PLANS</option>
                  <option value="free">FREE</option>
                  <option value="starter">STARTER</option>
                  <option value="pro">PRO</option>
                  <option value="business">BUSINESS</option>
                </select>

                <button
                  type="submit"
                  className="bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {usersLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">FETCHING USER REGISTERS...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_REGISTRY_RESULTS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">User Information</th>
                        <th className="p-4 font-bold">Security Role</th>
                        <th className="p-4 font-bold">Active Plan</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {usersList.map((usr) => (
                        <tr key={usr.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4">
                            <div className="font-bold text-slate-200">{usr.name}</div>
                            <div className="text-slate-500 text-[10px] lowercase mt-0.5">{usr.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              usr.role === "ADMIN" ? "bg-red-950/20 border-red-500/20 text-[#FF0055]" : "bg-slate-950 border-white/5 text-slate-400"
                            }`}>
                              {usr.role}
                            </span>
                          </td>
                          <td className="p-4 uppercase text-slate-300 font-bold">{usr.planKey || "free"}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                              usr.status === "ACTIVE" ? "bg-[#00FF87]/5 border-[#00FF87]/20 text-[#00FF87]" :
                              usr.status === "BANNED" ? "bg-[#FF0055]/5 border-[#FF0055]/20 text-[#FF0055]" :
                              "bg-amber-500/5 border-amber-500/20 text-amber-400"
                            }`}>
                              {usr.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-3">
                            <button
                              onClick={() => { setSelectedUser(usr); fetchUserDetail(usr.id); }}
                              className="text-[#00F0FF] hover:underline uppercase font-bold text-[10px] cursor-pointer"
                            >
                              Profile
                            </button>
                            
                            {usr.status === "BANNED" ? (
                              <button
                                onClick={() => setStatusDialog({ userId: usr.id, targetStatus: "ACTIVE", userEmail: usr.email })}
                                className="text-[#00FF87] hover:underline uppercase font-bold text-[10px] cursor-pointer"
                              >
                                Unban
                              </button>
                            ) : (
                              usr.role !== "ADMIN" && (
                                <button
                                  onClick={() => setStatusDialog({ userId: usr.id, targetStatus: "BANNED", userEmail: usr.email })}
                                  className="text-[#FF0055] hover:underline uppercase font-bold text-[10px] cursor-pointer"
                                >
                                  Ban
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs">
                <span className="text-slate-500">Page {usersPage} of {usersTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={usersPage === 1}
                    onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={usersPage === usersTotalPages}
                    onClick={() => setUsersPage(prev => Math.min(prev + 1, usersTotalPages))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* URLs Moderation Tab */}
        {activeTab === "urls" && (
          <div className="space-y-6 animate-fade-in">
            <form onSubmit={handleUrlsSearchSubmit} className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="SEARCH LINKS BY KEYWORD, ALIAS, CODE..."
                  value={urlsSearch}
                  onChange={(e) => setUrlsSearch(e.target.value)}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] w-full font-mono uppercase"
                />
              </div>

              <div className="flex gap-3 items-center">
                <select
                  value={urlsStatusFilter}
                  onChange={(e) => { setUrlsStatusFilter(e.target.value); setUrlsPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>

                <button
                  type="submit"
                  className="bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {urlsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">PULLING TELEMETRY LOGS...</span>
                </div>
              ) : urlsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_SHORTURL_ENTRIES</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Shortened Link</th>
                        <th className="p-4 font-bold">Destination URL</th>
                        <th className="p-4 font-bold">Created At</th>
                        <th className="p-4 font-bold text-center">Redirects</th>
                        <th className="p-4 font-bold text-right">Moderation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {urlsList.map((url) => (
                        <tr key={url.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4">
                            <a
                              href={`http://localhost:5000/r/${url.short_code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00F0FF] hover:underline font-bold"
                            >
                              /{url.short_code}
                            </a>
                            {url.custom_alias && (
                              <span className="text-[8px] uppercase tracking-wider border border-cyan-500/30 text-[#00F0FF] bg-cyan-500/5 px-1 ml-2 rounded">
                                ALIAS
                              </span>
                            )}
                          </td>
                          <td className="p-4 max-w-xs truncate text-slate-400 lowercase">{url.long_url}</td>
                          <td className="p-4 text-slate-500 text-[10px]">{new Date(url.created_at).toLocaleDateString("en-GB")}</td>
                          <td className="p-4 text-center font-bold text-slate-200">{url.clicks_count?.toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setDeleteUrlDialog({ urlId: url.id, shortCode: url.short_code })}
                              className="text-[#FF0055] border border-[#FF0055]/30 bg-[#FF0055]/5 hover:bg-[#FF0055]/10 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {urlsTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs">
                <span className="text-slate-500">Page {urlsPage} of {urlsTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={urlsPage === 1}
                    onClick={() => setUrlsPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={urlsPage === urlsTotalPages}
                    onClick={() => setUrlsPage(prev => Math.min(prev + 1, urlsTotalPages))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments Logs Tab */}
        {activeTab === "payments" && (
          <div className="space-y-6 animate-fade-in">
            <form onSubmit={handlePaymentsSearchSubmit} className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="SEARCH PAYMENTS BY EMAIL..."
                  value={paymentsEmail}
                  onChange={(e) => setPaymentsEmail(e.target.value)}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] w-full font-mono uppercase"
                />
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={paymentsStatusFilter}
                  onChange={(e) => { setPaymentsStatusFilter(e.target.value); setPaymentsPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="CREATED">CREATED</option>
                  <option value="AUTHORIZED">AUTHORIZED</option>
                  <option value="CAPTURED">CAPTURED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="REFUNDED">REFUNDED</option>
                </select>

                <select
                  value={paymentsPlanFilter}
                  onChange={(e) => { setPaymentsPlanFilter(e.target.value); setPaymentsPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL PLANS</option>
                  <option value="starter">STARTER</option>
                  <option value="pro">PRO</option>
                  <option value="business">BUSINESS</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportPaymentsCsv}
                  className="bg-slate-950 border border-white/5 hover:bg-slate-900 text-slate-300 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> CSV EXPORT
                </button>
                <button
                  type="submit"
                  className="bg-[#FF0055] text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {paymentsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">RETRIEVING TRANSACTION AUDIT LOGS...</span>
                </div>
              ) : paymentsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_PAYMENT_RECORDS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Transaction IDs</th>
                        <th className="p-4 font-bold">Payer Account</th>
                        <th className="p-4 font-bold">Plan Details</th>
                        <th className="p-4 font-bold">Amount</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Accounting Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {paymentsList.map((pay) => {
                        const meta = pay.metadata || {};
                        return (
                          <tr key={pay.id} className="hover:bg-slate-900/10 transition">
                            <td className="p-4 space-y-0.5">
                              <div className="text-[9px] text-slate-500 uppercase">ORD: {pay.gateway_order_id}</div>
                              {pay.gateway_payment_id && (
                                <div className="text-[10px] text-slate-300 uppercase">PAY: {pay.gateway_payment_id}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-200 lowercase">{pay.user.email}</div>
                              <div className="text-[9px] text-slate-500 lowercase">Name: {pay.user.name}</div>
                            </td>
                            <td className="p-4 uppercase text-slate-300 font-bold">
                              {pay.plan.name} ({pay.billing_cycle})
                            </td>
                            <td className="p-4 font-bold text-slate-100">
                              ₹{(pay.amount / 100).toFixed(0)}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                                pay.status === "CAPTURED" ? "bg-[#00FF87]/5 border-[#00FF87]/20 text-[#00FF87]" :
                                pay.status === "FAILED" ? "bg-[#FF0055]/5 border-[#FF0055]/20 text-[#FF0055]" :
                                pay.status === "REFUNDED" ? "bg-cyan-500/5 border-cyan-500/20 text-[#00F0FF]" :
                                "bg-amber-500/5 border-amber-500/20 text-amber-400"
                              }`}>
                                {pay.status}
                              </span>
                              {meta.writtenOff && (
                                <span className="ml-1 text-[8px] border border-slate-500/20 bg-slate-950 text-slate-500 px-1 rounded">
                                  WRITTEN-OFF
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => openInvoiceEdit(pay)}
                                className="text-[#00F0FF] hover:underline text-[10px] font-bold uppercase cursor-pointer"
                              >
                                Edit Statement
                              </button>

                              {pay.status === "CAPTURED" && (
                                <button
                                  onClick={() => setRefundDialog({ paymentId: pay.id, amount: pay.amount, currency: pay.currency })}
                                  className="text-slate-400 hover:text-[#FF0055] border border-white/5 bg-slate-950 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                                >
                                  Refund
                                </button>
                              )}

                              {pay.status === "FAILED" && !meta.writtenOff && (
                                <>
                                  <button
                                    onClick={() => triggerDunningRetryAction(pay.id)}
                                    className="text-amber-400 hover:text-white border border-amber-500/20 bg-slate-950 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                                  >
                                    Retry Invc
                                  </button>
                                  <button
                                    onClick={() => triggerWriteOffAction(pay.id)}
                                    className="text-rose-400 hover:text-white border border-rose-500/20 bg-slate-950 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                                  >
                                    Write Off
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {paymentsTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs">
                <span className="text-slate-500">Page {paymentsPage} of {paymentsTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={paymentsPage === 1}
                    onClick={() => setPaymentsPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={paymentsPage === paymentsTotalPages}
                    onClick={() => setPaymentsPage(prev => Math.min(prev + 1, paymentsTotalPages))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coupons Manager Tab */}
        {activeTab === "coupons" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-black/45 border border-[#1b1e25] p-4 rounded-2xl">
              <div>
                <h3 className="text-xs font-black font-mono uppercase tracking-wider text-slate-300">DISCOUNT VOUCHERS REGISTRY</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Manage 100% discount bypasses and percentage promotionals.</p>
              </div>
              <button
                onClick={() => setCouponFormOpen(true)}
                className="flex items-center gap-1.5 bg-[#FF0055] hover:bg-[#FF0055]/90 text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> CREATE VOUCHER
              </button>
            </div>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {couponsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">RETRIEVING COUPON DEFINITIONS...</span>
                </div>
              ) : couponsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_COUPONS_SEEDED</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Promo Code</th>
                        <th className="p-4 font-bold">Voucher Description</th>
                        <th className="p-4 font-bold">Discount Rate</th>
                        <th className="p-4 font-bold">Usage Metrics</th>
                        <th className="p-4 font-bold">Expiry Date</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {couponsList.map((cp) => (
                        <tr key={cp.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4 font-bold text-slate-200 tracking-wider text-sm uppercase">{cp.code}</td>
                          <td className="p-4 text-slate-400 lowercase">{cp.description || "—"}</td>
                          <td className="p-4 text-slate-200">
                            {cp.discount_type === "PERCENT" ? `${cp.discount_value}%` : `₹${(cp.discount_value / 100).toFixed(0)}`}
                          </td>
                          <td className="p-4 text-slate-300">
                            {cp.times_redeemed} / {cp.max_redemptions !== null ? cp.max_redemptions : "∞"}
                          </td>
                          <td className="p-4 text-slate-500 text-[10px]">
                            {cp.valid_until ? new Date(cp.valid_until).toLocaleDateString("en-GB") : "LIFETIME"}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                              cp.is_active ? "bg-[#00FF87]/5 border-[#00FF87]/20 text-[#00FF87]" : "bg-rose-950/20 border-rose-500/20 text-[#FF0055]"
                            }`}>
                              {cp.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleToggleCoupon(cp.id, cp.is_active)}
                              className="text-slate-400 hover:text-white border border-white/5 bg-slate-950 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                            >
                              {cp.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Webhook Diagnostics Tab */}
        {activeTab === "webhooks" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex flex-wrap gap-4 items-center text-xs">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-bold text-slate-300 uppercase font-mono tracking-wider">GATEWAY WEBHOOK TELEMETRY</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Monitor live callbacks from payment gateways for subscription verification.</p>
              </div>

              <div className="flex gap-3 items-center">
                <select
                  value={webhooksProcessedFilter}
                  onChange={(e) => { setWebhooksProcessedFilter(e.target.value); setWebhooksPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL EVENTS</option>
                  <option value="true">PROCESSED SUCCESSFULLY</option>
                  <option value="false">UNPROCESSED / FAILING</option>
                </select>

                <select
                  value={webhooksTypeFilter}
                  onChange={(e) => { setWebhooksTypeFilter(e.target.value); setWebhooksPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-[#FF0055] font-mono"
                >
                  <option value="">ALL CALLBACK TYPES</option>
                  <option value="payment.captured">PAYMENT.CAPTURED</option>
                  <option value="payment.failed">PAYMENT.FAILED</option>
                  <option value="refund.processed">REFUND.PROCESSED</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {webhooksLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider font-bold">ANALYZING WEBHOOK INGESTION LOGS...</span>
                </div>
              ) : webhooksList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_WEBHOOK_CALLBACKS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Event ID & Gateway</th>
                        <th className="p-4 font-bold">Callback Action type</th>
                        <th className="p-4 font-bold text-center">Execution Status</th>
                        <th className="p-4 font-bold">Received At</th>
                        <th className="p-4 font-bold">System Log Error</th>
                        <th className="p-4 font-bold text-right">Reprocess</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {webhooksList.map((wh) => (
                        <tr key={wh.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4">
                            <div className="font-bold text-slate-300 uppercase">{wh.event_id}</div>
                            <div className="text-[9px] text-slate-500 uppercase">Provider: {wh.gateway}</div>
                          </td>
                          <td className="p-4 text-slate-200 font-bold uppercase">{wh.event_type}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                              wh.processed ? "bg-[#00FF87]/5 border-[#00FF87]/20 text-[#00FF87]" : "bg-[#FF0055]/5 border-[#FF0055]/20 text-[#FF0055]"
                            }`}>
                              {wh.processed ? "PROCESSED" : "FAILED"}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 text-[10px]">{new Date(wh.received_at).toLocaleString("en-GB")}</td>
                          <td className="p-4 max-w-xs truncate text-[#FF0055] font-semibold">{wh.processing_error || "—"}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleReprocessWebhook(wh.id)}
                              className="text-[#00F0FF] hover:underline uppercase font-bold text-[10px] cursor-pointer"
                            >
                              Reprocess
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {webhooksTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs">
                <span className="text-slate-500">Page {webhooksPage} of {webhooksTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={webhooksPage === 1}
                    onClick={() => setWebhooksPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={webhooksPage === webhooksTotalPages}
                    onClick={() => setWebhooksPage(prev => Math.min(prev + 1, webhooksTotalPages))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revenue Operations Tab */}
        {activeTab === "revops" && (
          <div className="space-y-6 animate-fade-in">
            {reportsLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                <span className="text-xs text-slate-500 font-mono tracking-wider font-bold">CALCULATING ACCRUED FINANCE TELEMETRY...</span>
              </div>
            ) : !billingReports ? (
              <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_REVOPS_REPORTS_AVAILABLE</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Recognition Line Chart */}
                  <div className="bg-black/45 border border-[#1b1e25] p-6 rounded-3xl">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono mb-4">REVENUE RECOGNITION (Monthly Accrued)</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={billingReports.revRec}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#121317" />
                          <XAxis dataKey="month" stroke="#475569" fontSize={9} fontClassName="font-mono" />
                          <YAxis stroke="#475569" fontSize={9} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#08080C", borderColor: "#1b1e25", borderRadius: "12px", fontFamily: "monospace", fontSize: "11px" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Recognized"]}
                          />
                          <Line type="monotone" dataKey="recognized" stroke="#00FF87" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Refund Trend Bar Chart */}
                  <div className="bg-black/45 border border-[#1b1e25] p-6 rounded-3xl">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono mb-4">REFUND OUTFLOW TREND</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={billingReports.refunds}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#121317" />
                          <XAxis dataKey="month" stroke="#475569" fontSize={9} fontClassName="font-mono" />
                          <YAxis stroke="#475569" fontSize={9} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#08080C", borderColor: "#1b1e25", borderRadius: "12px", fontFamily: "monospace", fontSize: "11px" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Refunded"]}
                          />
                          <Bar dataKey="refunded" fill="#FF0055" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cohort Churn Matrix */}
                <div className="bg-black/45 border border-[#1b1e25] p-6 rounded-3xl">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono mb-4">CHURN COHORT RETENTION (%)</h3>
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                          <th className="p-4">Signup Cohort</th>
                          <th className="p-4 text-center">Cohort Size</th>
                          <th className="p-4 text-center">Month 0</th>
                          <th className="p-4 text-center">Month 1</th>
                          <th className="p-4 text-center">Month 2</th>
                          <th className="p-4 text-center">Month 3</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#12141a]">
                        {billingReports.cohorts.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-900/10 transition">
                            <td className="p-4 font-bold text-slate-200 uppercase">{c.cohort}</td>
                            <td className="p-4 text-center text-slate-400">{c.size} Users</td>
                            <td className="p-4 text-center bg-emerald-500/10 text-emerald-400 font-bold">{c.m0}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m1 > 70 ? "bg-emerald-500/5 text-emerald-400" :
                              c.m1 > 40 ? "bg-amber-500/5 text-amber-400" : "bg-rose-500/5 text-rose-400"
                            }`}>{c.m1}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m2 > 70 ? "bg-emerald-500/5 text-emerald-400" :
                              c.m2 > 40 ? "bg-amber-500/5 text-amber-400" : "bg-rose-500/5 text-rose-400"
                            }`}>{c.m2}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m3 > 70 ? "bg-emerald-500/5 text-emerald-400" :
                              c.m3 > 40 ? "bg-amber-500/5 text-amber-400" : "bg-rose-500/5 text-rose-400"
                            }`}>{c.m3}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finance Reconciliation Tab */}
        {activeTab === "reconcile" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <h3 className="font-bold text-slate-300 uppercase font-mono tracking-wider">GATEWAY Webhook Reconciliation Exceptions</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Resolves anomalies between local payment records and capture log signatures.</p>
              </div>
              <button
                onClick={fetchReconciliation}
                className="bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 py-1.5 px-3 rounded-lg font-mono tracking-wider flex items-center gap-1 uppercase cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Scan Audit
              </button>
            </div>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {reconciliationLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">RUNNING TRANSACTION SYNC SCAN...</span>
                </div>
              ) : reconciliationList.length === 0 ? (
                <div className="p-16 text-center text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 font-mono text-xs rounded-2xl flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <span>ALL SYSTEMS RECONCILED. NO EXCEPTIONS DETECTED.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Exceptions type</th>
                        <th className="p-4 font-bold">Local reference</th>
                        <th className="p-4 font-bold text-center">Local Status</th>
                        <th className="p-4 font-bold text-center">Gateway Status</th>
                        <th className="p-4 font-bold">Details</th>
                        <th className="p-4 font-bold text-right font-sans">Resolve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {reconciliationList.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-900/10 transition">
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded border border-rose-500/20 bg-rose-500/5 text-[#FF0055] font-bold text-[9px] tracking-wider uppercase">
                              {rec.type}
                            </span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <div className="text-slate-300 font-bold">{rec.email}</div>
                            <div className="text-[9px] text-slate-500 uppercase">ORD: {rec.gatewayOrderId}</div>
                          </td>
                          <td className="p-4 text-center uppercase font-bold text-rose-400">{rec.localStatus}</td>
                          <td className="p-4 text-center uppercase font-bold text-emerald-400">{rec.gatewayStatus}</td>
                          <td className="p-4 text-slate-500 text-[10px]">
                            {rec.webhookEventId ? `Capture Hook: ${rec.webhookEventId}` : `Stale created transaction (${rec.hoursOld} hrs old)`}
                          </td>
                          <td className="p-4 text-right">
                            {rec.type === "STATUS_MISMATCH" && (
                              <button
                                onClick={() => handleReconcileSyncAction(rec.paymentId)}
                                className="bg-[#00FF87]/10 hover:bg-[#00FF87]/25 text-[#00FF87] border border-[#00FF87]/20 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                              >
                                Force Sync
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approval Queue Tab */}
        {activeTab === "approvals" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex justify-between items-center text-xs">
              <div>
                <h3 className="font-bold text-slate-300 uppercase font-mono tracking-wider">DUAL-AUTHORIZATION APPROVAL QUEUE</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">Provides dual-control verification for sensitive administrative actions (Refunds, Upgrades).</p>
              </div>
              <button
                onClick={fetchApprovalsQueue}
                className="bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 py-1.5 px-3 rounded-lg font-mono tracking-wider flex items-center gap-1 uppercase cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
              </button>
            </div>

            {/* Approval Decisions Reason Input */}
            <div className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl text-xs space-y-2">
              <label className="font-bold text-slate-400 uppercase tracking-wider block font-mono">FINANCE OFFICER DECISION COMMENT</label>
              <input
                type="text"
                placeholder="INPUT REASON TO RESOLVE APPROVAL OR REJECTION..."
                value={approvalDecisionReason}
                onChange={(e) => setApprovalDecisionReason(e.target.value)}
                className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF0055] w-full font-mono uppercase"
              />
            </div>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {approvalsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider">RETRIEVING APPROVAL REQUEST TRAILS...</span>
                </div>
              ) : approvalsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_PENDING_APPROVALS_QUEUE</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Action</th>
                        <th className="p-4 font-bold">Requester</th>
                        <th className="p-4 font-bold">Target PK</th>
                        <th className="p-4 font-bold">Reason</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Decide Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {approvalsList.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4 font-bold text-slate-200 uppercase tracking-wider">{app.action}</td>
                          <td className="p-4 text-slate-400 lowercase">{app.requester_email}</td>
                          <td className="p-4 text-slate-300 font-bold truncate max-w-[120px]">{app.target_id}</td>
                          <td className="p-4 text-slate-400 max-w-xs truncate uppercase">{app.reason || "—"}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                              app.status === "PENDING" ? "bg-amber-500/5 border-amber-500/20 text-amber-400" :
                              app.status === "APPROVED" ? "bg-[#00FF87]/5 border-[#00FF87]/20 text-[#00FF87]" :
                              "bg-[#FF0055]/5 border-[#FF0055]/20 text-[#FF0055]"
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {app.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => handleApprovalDecisionSubmit(app.id, "APPROVED")}
                                  className="text-[#00FF87] border border-[#00FF87]/20 bg-[#00FF87]/5 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprovalDecisionSubmit(app.id, "REJECTED")}
                                  className="text-[#FF0055] border border-[#FF0055]/20 bg-[#FF0055]/5 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Registry Tab */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-black/45 border border-[#1b1e25] p-4 rounded-2xl flex flex-wrap gap-4 items-center text-xs">
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-bold text-slate-300 uppercase font-mono tracking-wider">SYSTEM SYSTEMIC AUDIT REGISTRY</h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-sans">Full administrative audit records mapping modifications, security status changes, and coupon setups.</p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="SEARCH KEYWORD..."
                  value={auditSearch}
                  onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] font-mono uppercase"
                />

                <input
                  type="text"
                  placeholder="FILTER ACTION..."
                  value={auditActionFilter}
                  onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] font-mono uppercase"
                />

                <input
                  type="text"
                  placeholder="FILTER TARGET..."
                  value={auditTargetFilter}
                  onChange={(e) => { setAuditTargetFilter(e.target.value); setAuditPage(1); }}
                  className="bg-[#08080C] border border-[#1b1e25] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0055] font-mono uppercase"
                />

                <button
                  type="button"
                  onClick={() => { setAuditActionFilter(""); setAuditTargetFilter(""); setAuditSearch(""); setAuditPage(1); }}
                  className="bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer font-semibold uppercase"
                >
                  RESET
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1b1e25] bg-black/20 overflow-hidden shadow-xl">
              {auditLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF0055]" />
                  <span className="text-xs text-slate-500 font-mono tracking-wider font-bold">INGESTING ADMINISTRATIVE ACTION AUDITS...</span>
                </div>
              ) : auditLogsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#0c0d12]/40 font-mono text-xs">NO_AUDIT_RECORDS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-[#1b1e25] bg-slate-950/60 text-slate-500 uppercase tracking-wider">
                        <th className="p-4 font-bold">Timestamp</th>
                        <th className="p-4 font-bold">Admin Operator</th>
                        <th className="p-4 font-bold">Logged Action</th>
                        <th className="p-4 font-bold">Target Identity</th>
                        <th className="p-4 font-bold">Metadata Details</th>
                        <th className="p-4 font-bold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#12141a]">
                      {auditLogsList.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/10 transition">
                          <td className="p-4 text-slate-500 text-[10px] whitespace-nowrap">{new Date(log.created_at).toLocaleString("en-GB")}</td>
                          <td className="p-4">
                            <div className="font-bold text-slate-200">{log.admin.name}</div>
                            <div className="text-[9px] text-slate-500 lowercase mt-0.5">{log.admin.email}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded border border-[#FF0055]/20 bg-[#FF0055]/5 text-[#FF0055] font-bold text-[9px] tracking-wider uppercase">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-300 uppercase">{log.target_type}</div>
                            <div className="text-[9px] text-slate-500 uppercase mt-0.5">{log.target_id}</div>
                          </td>
                          <td className="p-4 max-w-sm">
                            <pre className="text-[10px] text-slate-400 bg-black/60 p-2 rounded border border-white/5 max-h-24 overflow-y-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                          <td className="p-4 text-slate-400 text-[10px]">{log.ip || "0.0.0.0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs">
                <span className="text-slate-500">Page {auditPage} of {auditTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={auditPage === 1}
                    onClick={() => setAuditPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={auditPage === auditTotalPages}
                    onClick={() => setAuditPage(prev => Math.min(prev + 1, auditTotalPages))}
                    className="p-2 rounded-lg border border-[#1b1e25] bg-black disabled:opacity-30 hover:bg-slate-950 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------- USER DETAILS MODAL -------------------- */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto font-mono text-xs">
            <button
              onClick={() => { setSelectedUser(null); setUserDetail(null); }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white rounded-xl cursor-pointer font-bold text-sm"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 border-b border-[#222] pb-4 text-white uppercase tracking-tight font-sans">
              <UserIcon className="w-5 h-5 text-[#FF0055]" /> USER TELEMETRY PROFILE
            </h2>

            {userDetailLoading ? (
              <div className="p-12 text-center text-slate-500 animate-pulse">PULLING PROFILE LOGS...</div>
            ) : !userDetail ? (
              <div className="p-12 text-center text-slate-500 uppercase">FAIL_PULL: PROFILE_DATA</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block border-b border-white/5 pb-1">ACCOUNT DATA</span>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">ID:</span> <span className="text-slate-300 truncate max-w-[150px]">{userDetail.profile.id}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="text-slate-200">{userDetail.profile.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-slate-200 lowercase">{userDetail.profile.email}</span></div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Role:</span> 
                        <select
                          value={userDetail.profile.role}
                          onChange={(e) => handleRoleChange(userDetail.profile.id, e.target.value)}
                          className="bg-black border border-white/5 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-[#FF0055]"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-500">Status:</span> <span className="font-bold text-[#00FF87]">{userDetail.profile.status}</span></div>
                    </div>
                  </div>

                  <div className="bg-black/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block border-b border-white/5 pb-1">SYSTEM STATISTICS</span>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Created At:</span> <span className="text-slate-300">{new Date(userDetail.profile.createdAt).toLocaleDateString("en-GB")}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Active Plan:</span> <span className="uppercase font-bold text-indigo-400">{userDetail.currentSubscription?.plan?.name || "Free Plan"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">URLs count:</span> <span className="font-bold text-slate-200">{userDetail.urlCount}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Email Verified:</span> <span className="text-slate-300">{userDetail.profile.emailVerified ? "Yes ✅" : "No ❌"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">2FA Sec:</span> <span className="text-slate-300">{userDetail.profile.twoFactorEnabled ? "ACTIVE" : "INACTIVE"}</span></div>
                    </div>
                  </div>
                </div>

                {/* Subscription Lifecycle Manager Console */}
                {userDetail.currentSubscription && (
                  <div className="bg-black/60 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-[#00F0FF] uppercase font-bold tracking-widest block border-b border-white/5 pb-1">SUBSCRIPTION LIFECYCLE MANAGEMENT</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs leading-loose">
                      <div className="space-y-1">
                        <div><span className="text-slate-500">Subscription ID:</span> <span className="text-slate-300 font-bold">{userDetail.currentSubscription.id}</span></div>
                        <div><span className="text-slate-500">Expiration:</span> <span className="text-slate-300 font-bold">{userDetail.currentSubscription.current_period_end ? new Date(userDetail.currentSubscription.current_period_end).toLocaleString("en-GB") : "LIFETIME"}</span></div>
                        <div><span className="text-slate-500">Cycle:</span> <span className="text-slate-300 font-bold uppercase">{userDetail.currentSubscription.billing_cycle}</span></div>
                        <div><span className="text-slate-500">StatusBadge:</span> <span className="text-emerald-400 font-bold uppercase border border-emerald-500/25 bg-emerald-500/5 px-2 py-0.5 rounded">{userDetail.currentSubscription.status}</span></div>
                      </div>

                      <div className="space-y-3 font-sans">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLifecycleAction("cancel", userDetail.currentSubscription.id)}
                            className="bg-red-950/20 hover:bg-red-950/50 text-[#FF0055] border border-[#FF0055]/30 py-1 px-2.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                          >
                            Cancel Sub
                          </button>
                          <button
                            onClick={() => handleLifecycleAction("resume", userDetail.currentSubscription.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 py-1 px-2.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                          >
                            Resume Renew
                          </button>
                          <button
                            onClick={() => handleLifecycleAction("renew", userDetail.currentSubscription.id)}
                            className="bg-emerald-950/20 hover:bg-emerald-950/50 text-[#00FF87] border border-[#00FF87]/30 py-1 px-2.5 rounded text-[10px] font-bold cursor-pointer transition uppercase"
                          >
                            Manual Renew
                          </button>
                        </div>

                        {/* Proration Adjustments */}
                        <div className="flex gap-2 items-center font-mono">
                          <input
                            type="number"
                            placeholder="DAYS (e.g. +10, -5)"
                            value={prorateDays}
                            onChange={(e) => setProrateDays(e.target.value)}
                            className="bg-black border border-white/5 rounded px-2 py-1 text-slate-300 focus:outline-none w-28 text-center text-xs uppercase"
                          />
                          <button
                            onClick={() => {
                              handleLifecycleAction("prorate", userDetail.currentSubscription.id, { days: prorateDays });
                              setProrateDays("");
                            }}
                            className="bg-slate-950 hover:bg-slate-900 border border-white/5 py-1 px-2.5 rounded text-[10px] font-sans font-bold text-slate-300 cursor-pointer uppercase"
                          >
                            Prorate shift
                          </button>
                        </div>

                        {/* Plan change direct/approval queue */}
                        <div className="border-t border-white/5 pt-3 space-y-2 font-mono">
                          <span className="text-[9px] text-slate-500 uppercase block tracking-wider font-bold">MANUAL TIER UPGRADE/DOWNGRADE</span>
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              value={changePlanKey}
                              onChange={(e) => setChangePlanKey(e.target.value)}
                              className="bg-black border border-white/5 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                            >
                              <option value="starter">starter</option>
                              <option value="pro">pro</option>
                              <option value="business">business</option>
                            </select>

                            <select
                              value={changePlanCycle}
                              onChange={(e) => setChangePlanCycle(e.target.value)}
                              className="bg-black border border-white/5 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                            >
                              <option value="MONTHLY">monthly</option>
                              <option value="QUARTERLY">quarterly</option>
                              <option value="YEARLY">yearly</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 font-sans text-[10px]">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={lifecycleRequestApproval}
                                onChange={(e) => setLifecycleRequestApproval(e.target.checked)}
                                className="accent-[#FF0055]"
                              />
                              Queue dual-approval
                            </label>

                            <button
                              onClick={() => handlePlanChangeSubmit(userDetail.currentSubscription.id)}
                              className="bg-[#FF0055] hover:bg-[#FF0055]/90 text-white font-bold py-1 px-2.5 rounded text-[10px] cursor-pointer transition uppercase"
                            >
                              Modify Tier
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Sessions */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 font-sans">
                    <Lock className="w-4 h-4 text-slate-500" /> Active Session Authorization Tokens ({userDetail.activeSessions.length})
                  </h3>
                  {userDetail.activeSessions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic uppercase">No active authorizations detected.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-2 border border-white/5 p-3 bg-black/60 rounded-2xl">
                      {userDetail.activeSessions.map((session) => (
                        <div key={session.id} className="text-xs flex justify-between items-center border-b border-white/5 pb-1.5 last:border-b-0">
                          <div>
                            <span className="font-semibold text-slate-300">{session.device || "Unknown Hardware"}</span>
                            <span className="text-[10px] text-slate-500 ml-2 font-mono">({session.ip})</span>
                          </div>
                          <span className="text-[9px] text-slate-500">Expires: {new Date(session.expiresAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Logins */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 font-sans">
                    <Calendar className="w-4 h-4 text-slate-500" /> Access events history (Last 10)
                  </h3>
                  {userDetail.recentLoginHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 italic uppercase">No access events logged.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-white/5 p-3 bg-black/60 rounded-2xl">
                      {userDetail.recentLoginHistory.map((evt) => (
                        <div key={evt.id} className="text-xs flex justify-between items-center border-b border-white/5 pb-1.5 last:border-b-0">
                          <div>
                            <span className={`font-bold ${evt.success ? "text-[#00FF87]" : "text-[#FF0055]"}`}>
                              {evt.success ? "SUCCESS" : "FAILURE"}
                            </span>
                            <span className="text-slate-400 ml-2">on {evt.device || "Unknown browser"}</span>
                            <span className="text-[10px] text-slate-500 ml-2">({evt.ip})</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{new Date(evt.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- INVOICE / BILLING ADJUSTMENTS MODAL -------------------- */}
      {invoiceEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleInvoiceEditSubmit} className="w-full max-w-md rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans uppercase">
              <CreditCard className="w-5 h-5 text-[#FF0055]" />
              EDIT BILLING STATEMENT
            </h3>

            <p className="text-xs text-slate-400">
              Adjusting statement parameters for Order Reference: <span className="font-bold text-slate-200">{invoiceEditDialog.gateway_order_id}</span>
            </p>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Company Billing Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={invoiceCompanyName}
                onChange={(e) => setInvoiceCompanyName(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Corporate Tax ID / GSTIN</label>
              <input
                type="text"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={invoiceTaxId}
                onChange={(e) => setInvoiceTaxId(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Invoice Status override</label>
              <select
                value={invoiceStatusOverride}
                onChange={(e) => setInvoiceStatusOverride(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-[#FF0055]"
              >
                <option value="CREATED">CREATED</option>
                <option value="AUTHORIZED">AUTHORIZED</option>
                <option value="CAPTURED">CAPTURED / PAID</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Admin Audit Notes</label>
              <textarea
                rows={2}
                placeholder="Billing audit note logs..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceEditDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#FF0055] text-white font-bold transition cursor-pointer"
              >
                SAVE INVOICE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- USER STATUS CHANGE MODAL -------------------- */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleStatusSubmit} className="w-full max-w-md rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans uppercase">
              <Ban className="w-5 h-5 text-[#FF0055]" />
              UPDATE ACCOUNT STATUS
            </h3>
            
            <p className="text-xs text-slate-400 leading-normal">
              Change status of <span className="font-bold text-slate-200">{statusDialog.userEmail}</span> to{" "}
              <span className="font-bold text-[#FF0055]">{statusDialog.targetStatus}</span>.
            </p>

            {statusDialog.targetStatus === "BANNED" && (
              <div className="p-3 bg-[#FF0055]/5 border border-[#FF0055]/20 text-[#FF0055] rounded-xl flex gap-2 leading-relaxed">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <strong>WARNING:</strong> Banning restricts login credentials and invalidates active session tokens.
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Reason for action</label>
              <textarea
                required
                rows={3}
                placeholder="Enter logs reason for modification..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            {statusDialog.targetStatus === "BANNED" && (
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Confirm Administrator Password
                </label>
                <input
                  required
                  type="password"
                  placeholder="ENTER ADMIN CREDENTIAL..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStatusDialog(null);
                  setStatusReason("");
                  setAdminPassword("");
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2.5 rounded-xl bg-[#FF0055] text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                {mutating ? "Processing..." : "CONFIRM UPDATE"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- URL DELETION MODAL -------------------- */}
      {deleteUrlDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleDeleteUrlSubmit} className="w-full max-w-md rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans uppercase">
              <Trash2 className="w-5 h-5 text-[#FF0055]" />
              URL MODERATION REMOVAL
            </h3>
            
            <p className="text-xs text-slate-400 leading-normal">
              Permanently purge short code <span className="text-[#00F0FF] font-bold">/{deleteUrlDialog.shortCode}</span>.
            </p>

            <div className="p-3 bg-[#FF0055]/5 border border-[#FF0055]/20 text-[#FF0055] rounded-xl flex gap-2 leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>DESTRUCTIVE ACTION:</strong> Short redirect keys and QR codes will be permanently destroyed.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Moderation Purge Reason</label>
              <textarea
                required
                rows={3}
                placeholder="Enter audit logs reason..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteUrlDialog(null);
                  setDeleteReason("");
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2.5 rounded-xl bg-[#FF0055] text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                {mutating ? "Purging..." : "PURGE LINK"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- ADMIN REFUND MODAL -------------------- */}
      {refundDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleRefundSubmit} className="w-full max-w-md rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans uppercase">
              <CreditCard className="w-5 h-5 text-[#FF0055]" />
              FINANCIAL REFUND DISBURSE
            </h3>

            <p className="text-xs text-slate-400">
              Issuing refund for transaction order: <span className="font-bold text-slate-200">{refundDialog.paymentId.slice(0, 18)}...</span>.
            </p>

            <div className="p-3 bg-[#FF0055]/5 border border-[#FF0055]/20 text-[#FF0055] rounded-xl flex gap-2 leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>FINANCIAL IMPACT:</strong> Funds will be debited from merchant accounts.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Refund Amount (INR, Blank for FULL)</label>
              <input
                type="number"
                placeholder={`Max available: ₹${(refundDialog.amount / 100).toFixed(2)}`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Refund Reason</label>
              <textarea
                required
                rows={2}
                placeholder="Dispute resolution, billing query..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Confirm Administrator Password
              </label>
              <input
                required
                type="password"
                placeholder="ENTER ADMIN CREDENTIAL..."
                value={refundPassword}
                onChange={(e) => setRefundPassword(e.target.value)}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
              />
            </div>

            <div className="flex items-center gap-2 font-sans text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundRequestApproval}
                  onChange={(e) => setRefundRequestApproval(e.target.checked)}
                  className="accent-[#FF0055]"
                />
                Queue dual-approval (Requires Finance Operator signoff)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRefundDialog(null);
                  setRefundAmount("");
                  setRefundReason("");
                  setRefundPassword("");
                  setRefundRequestApproval(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2.5 rounded-xl bg-[#FF0055] text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                {mutating ? "Disbursing..." : "DISBURSE FUNDS"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- COUPON CREATE MODAL -------------------- */}
      {couponFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateCoupon} className="w-full max-w-md rounded-[2.5rem] border border-[#222] bg-[#0d0d12] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs text-slate-300">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans uppercase">
              <Ticket className="w-5 h-5 text-[#FF0055]" />
              REGISTER PROMO VOUCHER
            </h3>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Coupon Code</label>
              <input
                required
                type="text"
                placeholder="e.g. FLAT50"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value }))}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Voucher Description</label>
              <input
                type="text"
                placeholder="e.g. 50% discount for starters"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Discount Type</label>
                <select
                  value={newCoupon.discount_type}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, discount_type: e.target.value }))}
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-[#FF0055]"
                >
                  <option value="PERCENT">Percent (%)</option>
                  <option value="FLAT">Flat (INR)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  Value ({newCoupon.discount_type === "PERCENT" ? "%" : "INR"})
                </label>
                <input
                  required
                  type="number"
                  placeholder={newCoupon.discount_type === "PERCENT" ? "50" : "100"}
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, discount_value: e.target.value }))}
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Applicable Plans (Comma separated keys)</label>
              <input
                type="text"
                placeholder="pro, business"
                value={newCoupon.applicable_plans}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, applicable_plans: e.target.value }))}
                className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055] lowercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Max Redemptions</label>
                <input
                  type="number"
                  placeholder="100"
                  value={newCoupon.max_redemptions}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, max_redemptions: e.target.value }))}
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF0055]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Valid Until</label>
                <input
                  type="date"
                  value={newCoupon.valid_until}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, valid_until: e.target.value }))}
                  className="w-full bg-black border border-white/5 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-[#FF0055]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCouponFormOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-4 py-2.5 rounded-xl bg-[#FF0055] text-white font-bold transition cursor-pointer disabled:opacity-50"
              >
                {mutating ? "Saving..." : "REGISTER VOUCHER"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
