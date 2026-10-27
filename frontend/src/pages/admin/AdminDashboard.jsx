import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from '../../layout/SiteHeader';
import SiteFooter from '../../layout/SiteFooter';
import API from "../../services/urlApi";
import BillingRecoveryPanel from '../../components/admin/BillingRecoveryPanel';
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
import { Users, Link as LinkIcon, Shield, Clock, Search, Ban, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, User as UserIcon, Trash2, Lock, Calendar, CreditCard, Ticket, Activity, TrendingUp, Download, RefreshCw, Plus, Cpu, Server, ExternalLink } from "lucide-react";

const COLORS = ["#475569", "#6366f1", "#FF0055", "#10b981"]; // Free, Starter, Pro, Business

function AdminDashboard() {
  const { section: activeTab } = useParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [traceService, setTraceService] = useState("all");

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
      if (response.data?.data) {
        setOverviewData(response.data.data);
      } else {
        setOverviewData({
          mrr: 0,
          revenue: { thisMonth: 0, lastMonth: 0 },
          failedPayments: { count: 0, amount: 0 },
          growth: { newSubscriptions: 0, cancellations: 0, churnRate: 0 },
          subscribers: { free: 0, starter: 0, pro: 0, business: 0 },
          mrrTrend: [],
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard overview:", err);
      const errMsg = err.response?.data?.message || err.message || "Failed to load dashboard overview.";
      setError(errMsg);
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

      const plansArray = Array.isArray(newCoupon.applicable_plans)
        ? newCoupon.applicable_plans
        : typeof newCoupon.applicable_plans === "string" && newCoupon.applicable_plans.trim()
        ? newCoupon.applicable_plans.split(",").map(p => p.trim()).filter(Boolean)
        : [];

      const payload = {
        code: newCoupon.code.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, ""),
        description: newCoupon.description || undefined,
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_type === "FLAT" ? parseInt(newCoupon.discount_value) * 100 : parseInt(newCoupon.discount_value),
        applicable_plans: plansArray,
        max_redemptions: newCoupon.max_redemptions ? parseInt(newCoupon.max_redemptions) : undefined,
        valid_until: newCoupon.valid_until || undefined,
      };

      await API.post("/admin/coupons", payload);
      setSuccess(`Promo voucher '${payload.code}' created successfully.`);
      setCouponFormOpen(false);
      setNewCoupon({
        code: "",
        description: "",
        discount_type: "PERCENT",
        discount_value: "",
        applicable_plans: [],
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
    <div className="site-page admin-console"><a className="site-skip" href="#main-content">Skip to administration</a><SiteHeader workspace /><main id="main-content" className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-slate-200 font-sans p-4 md:p-8 relative overflow-hidden transition-colors duration-200">
      
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] opacity-30 dark:opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">

        <header className="admin-page-heading"><nav aria-label="Breadcrumb"><Link to="/dashboard">Workspace</Link><span aria-hidden="true">/</span><Link to="/admin/overview">Administration</Link><span aria-hidden="true">/</span><span aria-current="page">{activeTab === 'revops' ? 'Revenue operations' : activeTab === 'reconcile' ? 'Reconciliation' : activeTab}</span></nav><div><span className="site-eyebrow">Administration</span><h1>Platform management.</h1><p>Accounts, billing, and operations. Review changes before applying them.</p></div></header>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-100 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 text-xs flex items-center justify-between gap-3 font-mono shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0" />
              <div className="font-bold">{error}</div>
            </div>
            <button
              onClick={() => setError("")}
              className="text-rose-800 hover:text-rose-950 dark:text-rose-300 dark:hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-200/80 dark:bg-rose-900/40 cursor-pointer transition uppercase"
            >
              DISMISS
            </button>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 font-mono shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div className="font-bold">{success}</div>
            </div>
            <button
              onClick={() => setSuccess("")}
              className="text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-200/80 dark:bg-emerald-900/40 cursor-pointer transition uppercase"
            >
              DISMISS
            </button>
          </div>
        )}

        <nav className="admin-sections" aria-label="Administration sections">{[
          {label:'Platform',items:[['overview','Overview',TrendingUp],['users','Accounts',Users],['urls','Links',LinkIcon]]},
          {label:'Finance',items:[['payments','Payments',CreditCard],['coupons','Coupons',Ticket],['revops','Revenue',Cpu],['reconcile','Reconciliation',Server]]},
          {label:'Operations',items:[['webhooks','Webhook delivery',Activity],['approvals','Approvals',Shield],['audit','Audit log',Clock],['traces','Traces',Activity]]},
        ].map(group=><div className="admin-nav-group" key={group.label}><span>{group.label}</span><div>{group.items.map(([id,label,Icon])=><Link key={id} to={'/admin/'+id} aria-current={activeTab===id?'page':undefined}><Icon size={16}/>{label}</Link>)}</div></div>)}</nav>

        {/* Tab Viewports */}

        {/* Distributed Trace Explorer */}
        {activeTab === "traces" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-xl text-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-[#E50914] font-mono text-xs font-black uppercase tracking-widest">
                    <Activity className="w-4 h-4" /> Distributed tracing
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Follow one request across every service</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                    A single trace can contain the API request, Redis, PostgreSQL, BullMQ, and worker spans. Use All Services when investigating the complete request path.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Service filter
                    <select
                      value={traceService}
                      onChange={(event) => setTraceService(event.target.value)}
                      className="mt-1.5 block min-w-52 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#E50914]"
                    >
                      <option value="all">All Services</option>
                      <option value="pburls-backend">Backend API</option>
                      <option value="pburls-worker">Background Worker</option>
                    </select>
                  </label>
                  <a
                    href={`${import.meta.env.VITE_JAEGER_URL || "http://localhost:16686"}/search${traceService === "all" ? "" : `?service=${encodeURIComponent(traceService)}`}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E50914] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#F40B16]"
                  >
                    Open Jaeger <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-5">
                {[
                  ["01", "HTTP request", "pburls-backend"],
                  ["02", "Redis / PostgreSQL", "database spans"],
                  ["03", "BullMQ publish", "pburls-backend"],
                  ["04", "BullMQ process", "pburls-worker"],
                  ["05", "Analytics write", "pburls-worker"],
                ].map(([step, title, owner], index) => (
                  <div key={step} className="relative rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <span className="font-mono text-[10px] font-black text-[#E50914]">{step}</span>
                    <div className="mt-3 text-sm font-bold text-white">{title}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{owner}</div>
                    {index < 4 && <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-zinc-700 md:block" />}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold">Investigation rule</div>
                  <div className="mt-1 text-cyan-200/70">Start with All Services, then follow the same trace ID across backend and worker spans.</div>
                </div>
                <code className="rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-cyan-300">trace_id = one request</code>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900/60 rounded-3xl border border-slate-300 dark:border-zinc-800 shadow-sm">
                <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                <span className="text-xs text-slate-700 dark:text-slate-400 font-mono tracking-wider uppercase font-bold">Loading system metrics...</span>
              </div>
            ) : !overviewData ? (
              <div className="p-12 text-center text-slate-800 dark:text-slate-400 bg-white dark:bg-zinc-900/60 border border-slate-300 dark:border-zinc-800 rounded-3xl font-mono text-xs shadow-sm flex flex-col items-center justify-center gap-3">
                <span className="font-bold text-sm">FAIL_FETCH: OVERVIEW_METRICS_DATA</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">Failed to connect to analytics telemetry endpoint.</p>
                <button
                  onClick={fetchOverview}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition cursor-pointer shadow-md font-mono flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Loading Metrics
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Normalized MRR", val: `₹${(overviewData.mrr / 100).toLocaleString("en-IN")}`, sub: "Active recurrent plan value", color: "border-cyan-500/40 text-cyan-700 dark:text-cyan-400" },
                    { label: "Revenue This Month", val: `₹${(overviewData.revenue.thisMonth / 100).toLocaleString("en-IN")}`, sub: `Prev: ₹${(overviewData.revenue.lastMonth / 100).toLocaleString("en-IN")}`, color: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
                    { label: "Failed Invoices (7d)", val: overviewData.failedPayments.count, sub: `Attempted: ₹${(overviewData.failedPayments.amount / 100).toLocaleString("en-IN")}`, color: "border-[#E50914]/40 text-rose-700 dark:text-[#E50914]" },
                    { label: "Net Growth (Month)", val: `+${overviewData.growth.newSubscriptions - overviewData.growth.cancellations}`, sub: `Churn Rate: ${overviewData.growth.churnRate}%`, color: "border-amber-500/40 text-amber-700 dark:text-amber-400" }
                  ].map((card, idx) => (
                    <div key={idx} className={`bg-white dark:bg-zinc-900/80 border border-slate-300 dark:${card.color.split(" ")[0]} p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[125px] shadow-md`}>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">{card.label}</span>
                      <h2 className={`text-3xl font-black font-mono tracking-tight mt-2 ${card.color.split(" ")[1]}`}>
                        {card.val}
                      </h2>
                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-2 uppercase font-semibold">{card.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#E50914]" /> REVENUE TELEMETRY (12m Trend)
                      </h3>
                      <button
                        onClick={fetchOverview}
                        className="text-[10px] font-mono text-slate-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={overviewData.mrrTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontClassName="font-mono" />
                          <YAxis stroke="#94a3b8" fontSize={10} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", fontFamily: "monospace", fontSize: "12px", color: "#f8fafc" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Revenue"]}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#E50914" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4 font-mono">ACTIVE SUBSCRIPTIONS MIX</h3>
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
                          <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", fontFamily: "monospace", fontSize: "12px", color: "#f8fafc" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-zinc-800 pt-4 mt-2">
                      {Object.entries(overviewData.subscribers).map(([key, value], idx) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-slate-400 capitalize">{key}:</span>
                          <span className="font-bold text-white">{value}</span>
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
            <form onSubmit={handleUsersSearchSubmit} className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-lg">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH USERS BY EMAIL OR NAME..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] w-full font-mono uppercase placeholder-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={usersStatusFilter}
                  onChange={(e) => { setUsersStatusFilter(e.target.value); setUsersPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="BANNED">BANNED</option>
                  <option value="PENDING">PENDING</option>
                </select>

                <select
                  value={usersRoleFilter}
                  onChange={(e) => { setUsersRoleFilter(e.target.value); setUsersPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL ROLES</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <select
                  value={usersPlanFilter}
                  onChange={(e) => { setUsersPlanFilter(e.target.value); setUsersPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL PLANS</option>
                  <option value="free">FREE</option>
                  <option value="starter">STARTER</option>
                  <option value="pro">PRO</option>
                  <option value="business">BUSINESS</option>
                </select>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md uppercase font-mono"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {usersLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Fetching user registers...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_REGISTRY_RESULTS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">User Information</th>
                        <th className="p-4 font-bold">Security Role</th>
                        <th className="p-4 font-bold">Active Plan</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {usersList.map((usr) => (
                        <tr key={usr.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <div className="font-bold text-white">{usr.name}</div>
                            <div className="text-slate-400 text-xs lowercase mt-0.5">{usr.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-bold ${
                              usr.role === "ADMIN" ? "bg-red-950/30 border-red-500/40 text-[#E50914]" : "bg-zinc-800 border-zinc-700 text-slate-300"
                            }`}>
                              {usr.role}
                            </span>
                          </td>
                          <td className="p-4 uppercase text-slate-200 font-bold">{usr.planKey || "free"}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                              usr.status === "ACTIVE" ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" :
                              usr.status === "BANNED" ? "bg-rose-950/30 border-rose-500/40 text-rose-400" :
                              "bg-amber-950/30 border-amber-500/40 text-amber-400"
                            }`}>
                              {usr.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-3">
                            <button
                              onClick={() => { setSelectedUser(usr); fetchUserDetail(usr.id); }}
                              className="text-cyan-400 hover:text-cyan-300 hover:underline uppercase font-bold text-xs cursor-pointer"
                            >
                              Profile
                            </button>
                            
                            {usr.status === "BANNED" ? (
                              <button
                                onClick={() => setStatusDialog({ userId: usr.id, targetStatus: "ACTIVE", userEmail: usr.email })}
                                className="text-emerald-400 hover:text-emerald-300 hover:underline uppercase font-bold text-xs cursor-pointer"
                              >
                                Unban
                              </button>
                            ) : (
                              usr.role !== "ADMIN" && (
                                <button
                                  onClick={() => setStatusDialog({ userId: usr.id, targetStatus: "BANNED", userEmail: usr.email })}
                                  className="text-rose-400 hover:text-rose-300 hover:underline uppercase font-bold text-xs cursor-pointer"
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
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-slate-400">
                <span>Page {usersPage} of {usersTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={usersPage === 1}
                    onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={usersPage === usersTotalPages}
                    onClick={() => setUsersPage(prev => Math.min(prev + 1, usersTotalPages))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
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
            <form onSubmit={handleUrlsSearchSubmit} className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-lg">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH LINKS BY KEYWORD, ALIAS, CODE..."
                  value={urlsSearch}
                  onChange={(e) => setUrlsSearch(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] w-full font-mono uppercase placeholder-slate-500"
                />
              </div>

              <div className="flex gap-3 items-center">
                <select
                  value={urlsStatusFilter}
                  onChange={(e) => { setUrlsStatusFilter(e.target.value); setUrlsPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md uppercase font-mono"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {urlsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Pulling link telemetry logs...</span>
                </div>
              ) : urlsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_SHORTURL_ENTRIES</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Shortened Link</th>
                        <th className="p-4 font-bold">Destination URL</th>
                        <th className="p-4 font-bold">Created At</th>
                        <th className="p-4 font-bold text-center">Redirects</th>
                        <th className="p-4 font-bold text-right">Moderation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {urlsList.map((url) => (
                        <tr key={url.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <a
                              href={url.shortUrl || `${API.defaults.baseURL.replace(/\/api\/?$/, "")}/r/${url.short_code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 hover:underline font-bold"
                            >
                              /{url.short_code}
                            </a>
                            {url.custom_alias && (
                              <span className="text-[8px] uppercase tracking-wider border border-cyan-500/40 text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 ml-2 rounded font-mono">
                                ALIAS
                              </span>
                            )}
                          </td>
                          <td className="p-4 max-w-xs truncate text-slate-300 lowercase">{url.long_url}</td>
                          <td className="p-4 text-slate-400 text-xs">{new Date(url.created_at).toLocaleDateString("en-GB")}</td>
                          <td className="p-4 text-center font-bold text-white">{url.clicks_count?.toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setDeleteUrlDialog({ urlId: url.id, shortCode: url.short_code })}
                              className="text-rose-400 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
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
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-slate-400">
                <span>Page {urlsPage} of {urlsTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={urlsPage === 1}
                    onClick={() => setUrlsPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={urlsPage === urlsTotalPages}
                    onClick={() => setUrlsPage(prev => Math.min(prev + 1, urlsTotalPages))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
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
            <form onSubmit={handlePaymentsSearchSubmit} className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl flex flex-wrap gap-4 items-center shadow-lg">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH PAYMENTS BY EMAIL..."
                  value={paymentsEmail}
                  onChange={(e) => setPaymentsEmail(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] w-full font-mono uppercase placeholder-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={paymentsStatusFilter}
                  onChange={(e) => { setPaymentsStatusFilter(e.target.value); setPaymentsPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
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
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL PLANS</option>
                  <option value="starter">STARTER</option>
                  <option value="pro">PRO</option>
                  <option value="business">BUSINESS</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportPaymentsCsv}
                  className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> CSV EXPORT
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md uppercase font-mono"
                >
                  RUN QUERY
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {paymentsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Retrieving transaction audit logs...</span>
                </div>
              ) : paymentsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_PAYMENT_RECORDS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Transaction IDs</th>
                        <th className="p-4 font-bold">Payer Account</th>
                        <th className="p-4 font-bold">Plan Details</th>
                        <th className="p-4 font-bold">Amount</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Accounting Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {paymentsList.map((pay) => {
                        const meta = pay.metadata || {};
                        return (
                          <tr key={pay.id} className="hover:bg-zinc-800/40 transition">
                            <td className="p-4 space-y-0.5">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">ORD: {pay.gateway_order_id}</div>
                              {pay.gateway_payment_id && (
                                <div className="text-[10px] text-slate-300 uppercase">PAY: {pay.gateway_payment_id}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-white lowercase">{pay.user?.email || "N/A"}</div>
                              <div className="text-slate-400 text-[10px] lowercase">Name: {pay.user?.name || "N/A"}</div>
                            </td>
                            <td className="p-4 uppercase text-slate-200 font-bold">
                              {pay.plan?.name || "Tier"} ({pay.billing_cycle})
                            </td>
                            <td className="p-4 font-bold text-emerald-400 text-sm">
                              ₹{(pay.amount / 100).toFixed(0)}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                                pay.status === "CAPTURED" ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" :
                                pay.status === "FAILED" ? "bg-rose-950/30 border-rose-500/40 text-rose-400" :
                                pay.status === "REFUNDED" ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-400" :
                                "bg-amber-950/30 border-amber-500/40 text-amber-400"
                              }`}>
                                {pay.status}
                              </span>
                              {meta.writtenOff && (
                                <span className="ml-1 text-[8px] border border-zinc-700 bg-zinc-950 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                                  WRITTEN-OFF
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => openInvoiceEdit(pay)}
                                className="text-cyan-400 hover:text-cyan-300 hover:underline text-xs font-bold uppercase cursor-pointer"
                              >
                                Edit Statement
                              </button>

                              {pay.status === "CAPTURED" && (
                                <button
                                  onClick={() => setRefundDialog({ paymentId: pay.id, amount: pay.amount, currency: pay.currency })}
                                  className="text-slate-300 hover:text-rose-400 border border-zinc-700 bg-zinc-800 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
                                >
                                  Refund
                                </button>
                              )}

                              {pay.status === "FAILED" && !meta.writtenOff && (
                                <>
                                  <button
                                    onClick={() => triggerDunningRetryAction(pay.id)}
                                    className="text-amber-400 hover:text-amber-300 border border-amber-500/30 bg-amber-950/20 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
                                  >
                                    Retry Invc
                                  </button>
                                  <button
                                    onClick={() => triggerWriteOffAction(pay.id)}
                                    className="text-rose-400 hover:text-rose-300 border border-rose-500/30 bg-rose-950/20 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
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
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-slate-400">
                <span>Page {paymentsPage} of {paymentsTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={paymentsPage === 1}
                    onClick={() => setPaymentsPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={paymentsPage === paymentsTotalPages}
                    onClick={() => setPaymentsPage(prev => Math.min(prev + 1, paymentsTotalPages))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
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
            <div className="flex justify-between items-center bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl shadow-lg">
              <div>
                <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#E50914]" /> DISCOUNT VOUCHERS REGISTRY
                </h3>
                <p className="text-xs text-slate-400 mt-1">Manage 100% discount bypasses and percentage promotionals.</p>
              </div>
              <button
                onClick={() => setCouponFormOpen(true)}
                className="flex items-center gap-1.5 bg-[#E50914] hover:bg-[#F40B16] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shadow-lg shadow-[#E50914]/25 uppercase font-mono"
              >
                <Plus className="w-4 h-4" /> CREATE VOUCHER
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {couponsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Retrieving coupon definitions...</span>
                </div>
              ) : couponsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_COUPONS_SEEDED</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Promo Code</th>
                        <th className="p-4 font-bold">Voucher Description</th>
                        <th className="p-4 font-bold">Discount Rate</th>
                        <th className="p-4 font-bold">Usage Metrics</th>
                        <th className="p-4 font-bold">Expiry Date</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {couponsList.map((cp) => (
                        <tr key={cp.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4 font-bold text-white tracking-wider text-sm uppercase">{cp.code}</td>
                          <td className="p-4 text-slate-300">{cp.description || "—"}</td>
                          <td className="p-4 text-emerald-400 font-bold">
                            {cp.discount_type === "PERCENT" ? `${cp.discount_value}%` : `₹${(cp.discount_value / 100).toFixed(0)}`}
                          </td>
                          <td className="p-4 text-slate-300">
                            {cp.times_redeemed} / {cp.max_redemptions !== null ? cp.max_redemptions : "∞"}
                          </td>
                          <td className="p-4 text-slate-400 text-xs">
                            {cp.valid_until ? new Date(cp.valid_until).toLocaleDateString("en-GB") : "LIFETIME"}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                              cp.is_active ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" : "bg-rose-950/30 border-rose-500/40 text-rose-400"
                            }`}>
                              {cp.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleToggleCoupon(cp.id, cp.is_active)}
                              className="text-slate-300 hover:text-white border border-zinc-700 bg-zinc-800 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
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
            <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl flex flex-wrap gap-4 items-center text-xs shadow-lg">
              <div className="flex-1 min-w-[220px]">
                <h3 className="font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> GATEWAY WEBHOOK TELEMETRY
                </h3>
                <p className="text-xs text-slate-400 mt-1">Monitor live callbacks from payment gateways for subscription verification.</p>
              </div>

              <div className="flex gap-3 items-center">
                <select
                  value={webhooksProcessedFilter}
                  onChange={(e) => { setWebhooksProcessedFilter(e.target.value); setWebhooksPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL EVENTS</option>
                  <option value="true">PROCESSED SUCCESSFULLY</option>
                  <option value="false">UNPROCESSED / FAILING</option>
                </select>

                <select
                  value={webhooksTypeFilter}
                  onChange={(e) => { setWebhooksTypeFilter(e.target.value); setWebhooksPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-[#E50914] font-mono"
                >
                  <option value="">ALL CALLBACK TYPES</option>
                  <option value="payment.captured">PAYMENT.CAPTURED</option>
                  <option value="payment.failed">PAYMENT.FAILED</option>
                  <option value="refund.processed">REFUND.PROCESSED</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {webhooksLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider font-bold uppercase">Analyzing webhook ingestion logs...</span>
                </div>
              ) : webhooksList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_WEBHOOK_CALLBACKS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Event ID & Gateway</th>
                        <th className="p-4 font-bold">Callback Action Type</th>
                        <th className="p-4 font-bold text-center">Execution Status</th>
                        <th className="p-4 font-bold">Received At</th>
                        <th className="p-4 font-bold">System Log Error</th>
                        <th className="p-4 font-bold text-right">Reprocess</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {webhooksList.map((wh) => (
                        <tr key={wh.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <div className="font-bold text-white uppercase">{wh.event_id}</div>
                            <div className="text-[10px] text-slate-400 uppercase">Provider: {wh.gateway}</div>
                          </td>
                          <td className="p-4 text-slate-200 font-bold uppercase">{wh.event_type}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                              wh.processed ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" : "bg-rose-950/30 border-rose-500/40 text-rose-400"
                            }`}>
                              {wh.processed ? "PROCESSED" : "FAILED"}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-xs">{new Date(wh.received_at).toLocaleString("en-GB")}</td>
                          <td className="p-4 max-w-xs truncate text-rose-400 font-semibold">{wh.processing_error || "—"}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleReprocessWebhook(wh.id)}
                              className="text-cyan-400 hover:text-cyan-300 hover:underline uppercase font-bold text-xs cursor-pointer"
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
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-slate-400">
                <span>Page {webhooksPage} of {webhooksTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={webhooksPage === 1}
                    onClick={() => setWebhooksPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={webhooksPage === webhooksTotalPages}
                    onClick={() => setWebhooksPage(prev => Math.min(prev + 1, webhooksTotalPages))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
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
              <div className="p-20 flex flex-col items-center justify-center gap-3 bg-zinc-900/60 rounded-3xl border border-zinc-800">
                <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                <span className="text-xs text-slate-400 font-mono tracking-wider font-bold uppercase">Calculating accrued finance telemetry...</span>
              </div>
            ) : !billingReports ? (
              <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs border border-zinc-800 rounded-3xl">NO_REVOPS_REPORTS_AVAILABLE</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Recognition Line Chart */}
                  <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> REVENUE RECOGNITION (Monthly Accrued)
                    </h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={billingReports.revRec}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontClassName="font-mono" />
                          <YAxis stroke="#94a3b8" fontSize={10} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", fontFamily: "monospace", fontSize: "12px", color: "#f8fafc" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Recognized"]}
                          />
                          <Line type="monotone" dataKey="recognized" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Refund Trend Bar Chart */}
                  <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono mb-4 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#E50914]" /> REFUND OUTFLOW TREND
                    </h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={billingReports.refunds}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} fontClassName="font-mono" />
                          <YAxis stroke="#94a3b8" fontSize={10} fontClassName="font-mono" tickFormatter={(v) => `₹${v / 100}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", fontFamily: "monospace", fontSize: "12px", color: "#f8fafc" }}
                            formatter={(v) => [`₹${(v / 100).toFixed(0)}`, "Refunded"]}
                          />
                          <Bar dataKey="refunded" fill="#E50914" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Cohort Churn Matrix */}
                <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono mb-4">CHURN COHORT RETENTION (%)</h3>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                          <th className="p-4">Signup Cohort</th>
                          <th className="p-4 text-center">Cohort Size</th>
                          <th className="p-4 text-center">Month 0</th>
                          <th className="p-4 text-center">Month 1</th>
                          <th className="p-4 text-center">Month 2</th>
                          <th className="p-4 text-center">Month 3</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/80">
                        {billingReports.cohorts.map((c, i) => (
                          <tr key={i} className="hover:bg-zinc-800/40 transition">
                            <td className="p-4 font-bold text-white uppercase">{c.cohort}</td>
                            <td className="p-4 text-center text-slate-300">{c.size} Users</td>
                            <td className="p-4 text-center bg-emerald-950/40 text-emerald-400 font-bold">{c.m0}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m1 > 70 ? "bg-emerald-950/30 text-emerald-400" :
                              c.m1 > 40 ? "bg-amber-950/30 text-amber-400" : "bg-rose-950/30 text-rose-400"
                            }`}>{c.m1}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m2 > 70 ? "bg-emerald-950/30 text-emerald-400" :
                              c.m2 > 40 ? "bg-amber-950/30 text-amber-400" : "bg-rose-950/30 text-rose-400"
                            }`}>{c.m2}%</td>
                            <td className={`p-4 text-center font-bold ${
                              c.m3 > 70 ? "bg-emerald-950/30 text-emerald-400" :
                              c.m3 > 40 ? "bg-amber-950/30 text-amber-400" : "bg-rose-950/30 text-rose-400"
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
            <BillingRecoveryPanel />
            <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center text-xs shadow-lg">
              <div>
                <h3 className="font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" /> GATEWAY RECONCILIATION DIAGNOSTICS
                </h3>
                <p className="text-xs text-slate-400 mt-1">Resolves anomalies between local payment records and capture log signatures.</p>
              </div>
              <button
                onClick={fetchReconciliation}
                className="bg-zinc-800 hover:bg-zinc-750 text-slate-200 border border-zinc-700 py-2 px-4 rounded-xl font-mono tracking-wider flex items-center gap-1.5 uppercase cursor-pointer font-bold transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Scan Audit
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {reconciliationLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase font-bold">Running transaction sync scan...</span>
                </div>
              ) : reconciliationList.length === 0 ? (
                <div className="p-16 text-center text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 font-mono text-xs rounded-2xl flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="h-9 w-9 text-emerald-400" />
                  <span className="font-bold tracking-wider">ALL SYSTEMS RECONCILED. NO EXCEPTIONS DETECTED.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Exceptions Type</th>
                        <th className="p-4 font-bold">Local Reference</th>
                        <th className="p-4 font-bold text-center">Local Status</th>
                        <th className="p-4 font-bold text-center">Gateway Status</th>
                        <th className="p-4 font-bold">Details</th>
                        <th className="p-4 font-bold text-right font-sans">Resolve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {reconciliationList.map((rec, i) => (
                        <tr key={i} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full border border-rose-500/40 bg-rose-950/30 text-rose-400 font-bold text-[9px] tracking-wider uppercase">
                              {rec.type}
                            </span>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <div className="text-white font-bold">{rec.email}</div>
                            <div className="text-[10px] text-slate-400 uppercase">ORD: {rec.gatewayOrderId}</div>
                          </td>
                          <td className="p-4 text-center uppercase font-bold text-rose-400">{rec.localStatus}</td>
                          <td className="p-4 text-center uppercase font-bold text-emerald-400">{rec.gatewayStatus}</td>
                          <td className="p-4 text-slate-400 text-xs">
                            {rec.webhookEventId ? `Capture Hook: ${rec.webhookEventId}` : `Stale created transaction (${rec.hoursOld} hrs old)`}
                          </td>
                          <td className="p-4 text-right">
                            {rec.type === "STATUS_MISMATCH" && (
                              <button
                                onClick={() => handleReconcileSyncAction(rec.paymentId)}
                                className="bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
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
            <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl flex justify-between items-center text-xs shadow-lg">
              <div>
                <h3 className="font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#E50914]" /> DUAL-AUTHORIZATION APPROVAL QUEUE
                </h3>
                <p className="text-xs text-slate-400 mt-1">Provides dual-control verification for sensitive administrative actions (Refunds, Upgrades).</p>
              </div>
              <button
                onClick={fetchApprovalsQueue}
                className="bg-zinc-800 hover:bg-zinc-750 text-slate-200 border border-zinc-700 py-2 px-4 rounded-xl font-mono tracking-wider flex items-center gap-1.5 uppercase cursor-pointer font-bold transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
              </button>
            </div>

            {/* Approval Decisions Reason Input */}
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl text-xs space-y-2 shadow-lg">
              <label className="font-bold text-slate-300 uppercase tracking-wider block font-mono">FINANCE OFFICER DECISION COMMENT</label>
              <input
                type="text"
                placeholder="INPUT REASON TO RESOLVE APPROVAL OR REJECTION..."
                value={approvalDecisionReason}
                onChange={(e) => setApprovalDecisionReason(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] w-full font-mono uppercase placeholder-slate-500"
              />
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {approvalsLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider uppercase font-bold">Retrieving approval request trails...</span>
                </div>
              ) : approvalsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_PENDING_APPROVALS_QUEUE</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Action</th>
                        <th className="p-4 font-bold">Requester</th>
                        <th className="p-4 font-bold">Target PK</th>
                        <th className="p-4 font-bold">Reason</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Decide Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {approvalsList.map((app) => (
                        <tr key={app.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4 font-bold text-white uppercase tracking-wider">{app.action}</td>
                          <td className="p-4 text-slate-300 lowercase">{app.requester_email}</td>
                          <td className="p-4 text-cyan-400 font-bold truncate max-w-[120px]">{app.target_id}</td>
                          <td className="p-4 text-slate-400 max-w-xs truncate uppercase">{app.reason || "—"}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                              app.status === "PENDING" ? "bg-amber-950/30 border-amber-500/40 text-amber-400" :
                              app.status === "APPROVED" ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400" :
                              "bg-rose-950/30 border-rose-500/40 text-rose-400"
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {app.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => handleApprovalDecisionSubmit(app.id, "APPROVED")}
                                  className="text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApprovalDecisionSubmit(app.id, "REJECTED")}
                                  className="text-rose-400 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition uppercase"
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
            <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl flex flex-wrap gap-4 items-center text-xs shadow-lg">
              <div className="flex-1 min-w-[220px]">
                <h3 className="font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" /> SYSTEM AUDIT REGISTRY
                </h3>
                <p className="text-xs text-slate-400 mt-1">Full administrative audit records mapping modifications, security status changes, and coupon setups.</p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="SEARCH KEYWORD..."
                  value={auditSearch}
                  onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] font-mono uppercase placeholder-slate-500"
                />

                <input
                  type="text"
                  placeholder="FILTER ACTION..."
                  value={auditActionFilter}
                  onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] font-mono uppercase placeholder-slate-500"
                />

                <input
                  type="text"
                  placeholder="FILTER TARGET..."
                  value={auditTargetFilter}
                  onChange={(e) => { setAuditTargetFilter(e.target.value); setAuditPage(1); }}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#E50914] font-mono uppercase placeholder-slate-500"
                />

                <button
                  type="button"
                  onClick={() => { setAuditActionFilter(""); setAuditTargetFilter(""); setAuditSearch(""); setAuditPage(1); }}
                  className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer font-mono uppercase shadow-sm"
                >
                  RESET
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
              {auditLoading ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#E50914]" />
                  <span className="text-xs text-slate-400 font-mono tracking-wider font-bold uppercase">Ingesting administrative action audits...</span>
                </div>
              ) : auditLogsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-zinc-900/40 font-mono text-xs">NO_AUDIT_RECORDS</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/80 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-bold">Timestamp</th>
                        <th className="p-4 font-bold">Admin Operator</th>
                        <th className="p-4 font-bold">Logged Action</th>
                        <th className="p-4 font-bold">Target Identity</th>
                        <th className="p-4 font-bold">Metadata Details</th>
                        <th className="p-4 font-bold">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {auditLogsList.map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-800/40 transition">
                          <td className="p-4 text-slate-400 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString("en-GB")}</td>
                          <td className="p-4">
                            <div className="font-bold text-white">{log.admin?.name || "System"}</div>
                            <div className="text-[10px] text-slate-400 lowercase mt-0.5">{log.admin?.email || "N/A"}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full border border-blue-500/40 bg-blue-950/30 text-blue-400 font-bold text-[9px] tracking-wider uppercase">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-200 uppercase">{log.target_type}</div>
                            <div className="text-[10px] text-slate-400 uppercase mt-0.5">{log.target_id}</div>
                          </td>
                          <td className="p-4 max-w-sm">
                            <pre className="text-[10px] text-slate-300 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 max-h-24 overflow-y-auto font-mono">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                          <td className="p-4 text-slate-400 text-xs font-mono">{log.ip || "0.0.0.0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 font-mono text-xs text-slate-400">
                <span>Page {auditPage} of {auditTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={auditPage === 1}
                    onClick={() => setAuditPage(prev => Math.max(prev - 1, 1))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={auditPage === auditTotalPages}
                    onClick={() => setAuditPage(prev => Math.min(prev + 1, auditTotalPages))}
                    className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 disabled:opacity-30 hover:bg-zinc-800 transition cursor-pointer text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900 p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto font-mono text-xs text-slate-200">
            <button
              onClick={() => { setSelectedUser(null); setUserDetail(null); }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer font-bold text-sm"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4 text-white uppercase tracking-tight font-mono">
              <UserIcon className="w-5 h-5 text-[#E50914]" /> USER TELEMETRY PROFILE
            </h2>

            {userDetailLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[#E50914]" />
                <span className="uppercase tracking-wider">Pulling user profile logs...</span>
              </div>
            ) : !userDetail ? (
              <div className="p-12 text-center text-rose-400 uppercase font-bold">FAIL_PULL: PROFILE_DATA</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 shadow-inner">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block border-b border-zinc-800 pb-2">ACCOUNT DATA</span>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">ID:</span> <span className="text-slate-300 truncate max-w-[150px] font-bold">{userDetail.profile.id}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Name:</span> <span className="text-white font-bold">{userDetail.profile.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Email:</span> <span className="text-slate-200 lowercase">{userDetail.profile.email}</span></div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Role:</span> 
                        <select
                          value={userDetail.profile.role}
                          onChange={(e) => handleRoleChange(userDetail.profile.id, e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#E50914] font-bold"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>
                      <div className="flex justify-between"><span className="text-slate-400">Status:</span> <span className="font-bold text-emerald-400">{userDetail.profile.status}</span></div>
                    </div>
                  </div>

                  <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 shadow-inner">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block border-b border-zinc-800 pb-2">SYSTEM STATISTICS</span>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">Created At:</span> <span className="text-slate-300">{new Date(userDetail.profile.createdAt).toLocaleDateString("en-GB")}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Active Plan:</span> <span className="uppercase font-bold text-cyan-400">{userDetail.currentSubscription?.plan?.name || "Free Plan"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">URLs Count:</span> <span className="font-bold text-white">{userDetail.urlCount}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Email Verified:</span> <span className="text-white font-bold">{userDetail.profile.emailVerified ? "Yes ✅" : "No ❌"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">2FA Security:</span> <span className={`font-bold ${userDetail.profile.twoFactorEnabled ? "text-emerald-400" : "text-slate-400"}`}>{userDetail.profile.twoFactorEnabled ? "ACTIVE" : "INACTIVE"}</span></div>
                    </div>
                  </div>
                </div>

                {/* Subscription Lifecycle Manager Console */}
                {userDetail.currentSubscription && (
                  <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 shadow-inner space-y-3">
                    <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-widest block border-b border-zinc-800 pb-2">SUBSCRIPTION LIFECYCLE MANAGEMENT</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-loose">
                      <div className="space-y-1.5">
                        <div><span className="text-slate-400">Subscription ID:</span> <span className="text-slate-200 font-bold ml-1">{userDetail.currentSubscription.id}</span></div>
                        <div><span className="text-slate-400">Expiration:</span> <span className="text-slate-200 font-bold ml-1">{userDetail.currentSubscription.current_period_end ? new Date(userDetail.currentSubscription.current_period_end).toLocaleString("en-GB") : "LIFETIME"}</span></div>
                        <div><span className="text-slate-400">Cycle:</span> <span className="text-slate-200 font-bold uppercase ml-1">{userDetail.currentSubscription.billing_cycle}</span></div>
                        <div><span className="text-slate-400">Status:</span> <span className="text-emerald-400 font-bold uppercase border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 rounded-full ml-1 text-[10px]">{userDetail.currentSubscription.status}</span></div>
                      </div>

                      <div className="space-y-3 font-sans">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleLifecycleAction("cancel", userDetail.currentSubscription.id)}
                            className="bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-500/40 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition uppercase font-mono"
                          >
                            Cancel Sub
                          </button>
                          <button
                            onClick={() => handleLifecycleAction("resume", userDetail.currentSubscription.id)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-slate-200 border border-zinc-700 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition uppercase font-mono"
                          >
                            Resume Renew
                          </button>
                          <button
                            onClick={() => handleLifecycleAction("renew", userDetail.currentSubscription.id)}
                            className="bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/40 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition uppercase font-mono"
                          >
                            Manual Renew
                          </button>
                        </div>

                        {/* Proration Adjustments */}
                        <div className="flex gap-2 items-center font-mono">
                          <input
                            type="number"
                            placeholder="DAYS (+10, -5)"
                            value={prorateDays}
                            onChange={(e) => setProrateDays(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#E50914] w-32 text-center text-xs uppercase font-mono"
                          />
                          <button
                            onClick={() => {
                              handleLifecycleAction("prorate", userDetail.currentSubscription.id, { days: prorateDays });
                              setProrateDays("");
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-1.5 px-3 rounded-lg text-xs font-mono font-bold text-slate-200 cursor-pointer uppercase transition"
                          >
                            Prorate Shift
                          </button>
                        </div>

                        {/* Plan change direct/approval queue */}
                        <div className="border-t border-zinc-800 pt-3 space-y-2 font-mono">
                          <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">MANUAL TIER UPGRADE/DOWNGRADE</span>
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              value={changePlanKey}
                              onChange={(e) => setChangePlanKey(e.target.value)}
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#E50914] uppercase font-bold"
                            >
                              <option value="starter">starter</option>
                              <option value="pro">pro</option>
                              <option value="business">business</option>
                            </select>

                            <select
                              value={changePlanCycle}
                              onChange={(e) => setChangePlanCycle(e.target.value)}
                              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#E50914] uppercase font-bold"
                            >
                              <option value="MONTHLY">monthly</option>
                              <option value="QUARTERLY">quarterly</option>
                              <option value="YEARLY">yearly</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                checked={lifecycleRequestApproval}
                                onChange={(e) => setLifecycleRequestApproval(e.target.checked)}
                                className="accent-[#E50914]"
                              />
                              Queue dual-approval
                            </label>

                            <button
                              onClick={() => handlePlanChangeSubmit(userDetail.currentSubscription.id)}
                              className="bg-[#E50914] hover:bg-[#F40B16] text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition uppercase font-mono shadow-md"
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
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5 font-mono">
                    <Lock className="w-4 h-4 text-cyan-400" /> Active Session Authorization Tokens ({userDetail.activeSessions.length})
                  </h3>
                  {userDetail.activeSessions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic uppercase">No active authorizations detected.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-2 border border-zinc-800 p-3 bg-zinc-950/80 rounded-2xl">
                      {userDetail.activeSessions.map((session) => (
                        <div key={session.id} className="text-xs flex justify-between items-center border-b border-zinc-800 pb-1.5 last:border-b-0">
                          <div>
                            <span className="font-semibold text-slate-200">{session.device || "Unknown Hardware"}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono">({session.ip})</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Expires: {new Date(session.expiresAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Logins */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5 font-mono">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Access Events History (Last 10)
                  </h3>
                  {userDetail.recentLoginHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 italic uppercase">No access events logged.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-zinc-800 p-3 bg-zinc-950/80 rounded-2xl">
                      {userDetail.recentLoginHistory.map((evt) => (
                        <div key={evt.id} className="text-xs flex justify-between items-center border-b border-zinc-800 pb-1.5 last:border-b-0">
                          <div>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${evt.success ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30" : "bg-rose-950/40 text-rose-400 border border-rose-500/30"}`}>
                              {evt.success ? "SUCCESS" : "FAILURE"}
                            </span>
                            <span className="text-slate-300 ml-2">on {evt.device || "Unknown browser"}</span>
                            <span className="text-[10px] text-slate-400 ml-2 font-mono">({evt.ip})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(evt.createdAt).toLocaleString()}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleInvoiceEditSubmit} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase">
              <CreditCard className="w-5 h-5 text-[#E50914]" />
              EDIT BILLING STATEMENT
            </h3>

            <p className="text-xs text-slate-400">
              Adjusting statement parameters for Order: <span className="font-bold text-white">{invoiceEditDialog.gateway_order_id}</span>
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Company Billing Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={invoiceCompanyName}
                onChange={(e) => setInvoiceCompanyName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Corporate Tax ID / GSTIN</label>
              <input
                type="text"
                placeholder="e.g. 22AAAAA0000A1Z5"
                value={invoiceTaxId}
                onChange={(e) => setInvoiceTaxId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Invoice Status Override</label>
              <select
                value={invoiceStatusOverride}
                onChange={(e) => setInvoiceStatusOverride(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#E50914] font-bold"
              >
                <option value="CREATED">CREATED</option>
                <option value="AUTHORIZED">AUTHORIZED</option>
                <option value="CAPTURED">CAPTURED / PAID</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Admin Audit Notes</label>
              <textarea
                rows={2}
                placeholder="Billing audit note logs..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceEditDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-slate-300 hover:text-white transition cursor-pointer font-bold uppercase font-mono text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40B16] text-white font-bold transition cursor-pointer uppercase font-mono text-xs shadow-md shadow-[#E50914]/25"
              >
                SAVE INVOICE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- USER STATUS CHANGE MODAL -------------------- */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleStatusSubmit} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase">
              <Ban className="w-5 h-5 text-[#E50914]" />
              UPDATE ACCOUNT STATUS
            </h3>
            
            <p className="text-xs text-slate-300 leading-normal">
              Change status of <span className="font-bold text-white">{statusDialog.userEmail}</span> to{" "}
              <span className="font-bold text-[#E50914]">{statusDialog.targetStatus}</span>.
            </p>

            {statusDialog.targetStatus === "BANNED" && (
              <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 text-rose-300 rounded-xl flex gap-2.5 leading-relaxed text-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <div>
                  <strong className="text-rose-200">WARNING:</strong> Banning restricts login credentials and invalidates active session tokens immediately.
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Reason For Action</label>
              <textarea
                required
                rows={3}
                placeholder="Enter logs reason for modification..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-500"
              />
            </div>

            {statusDialog.targetStatus === "BANNED" && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-rose-400" /> Confirm Administrator Password
                </label>
                <input
                  required
                  type="password"
                  placeholder="ENTER ADMIN PASSWORD..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] placeholder-slate-500"
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
                className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-slate-300 hover:text-white transition cursor-pointer font-bold uppercase font-mono text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40B16] text-white font-bold transition cursor-pointer disabled:opacity-50 uppercase font-mono text-xs shadow-md shadow-[#E50914]/25"
              >
                {mutating ? "Processing..." : "CONFIRM UPDATE"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- URL DELETION MODAL -------------------- */}
      {deleteUrlDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleDeleteUrlSubmit} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase">
              <Trash2 className="w-5 h-5 text-[#E50914]" />
              URL MODERATION REMOVAL
            </h3>
            
            <p className="text-xs text-slate-300 leading-normal">
              Permanently purge short code <span className="text-cyan-400 font-bold">/{deleteUrlDialog.shortCode}</span>.
            </p>

            <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 text-rose-300 rounded-xl flex gap-2.5 leading-relaxed text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div>
                <strong className="text-rose-200">DESTRUCTIVE ACTION:</strong> Short redirect keys and QR codes will be permanently destroyed.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Moderation Purge Reason</label>
              <textarea
                required
                rows={3}
                placeholder="Enter audit logs reason..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteUrlDialog(null);
                  setDeleteReason("");
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-slate-300 hover:text-white transition cursor-pointer font-bold uppercase font-mono text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40B16] text-white font-bold transition cursor-pointer disabled:opacity-50 uppercase font-mono text-xs shadow-md shadow-[#E50914]/25"
              >
                {mutating ? "Purging..." : "PURGE LINK"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- ADMIN REFUND MODAL -------------------- */}
      {refundDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleRefundSubmit} className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-200">
            <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono uppercase">
              <CreditCard className="w-5 h-5 text-[#E50914]" />
              FINANCIAL REFUND DISBURSE
            </h3>

            <p className="text-xs text-slate-300">
              Issuing refund for transaction order: <span className="font-bold text-white">{refundDialog.paymentId.slice(0, 18)}...</span>
            </p>

            <div className="p-3.5 bg-rose-950/30 border border-rose-500/40 text-rose-300 rounded-xl flex gap-2.5 leading-relaxed text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div>
                <strong className="text-rose-200">FINANCIAL IMPACT:</strong> Funds will be debited from merchant accounts back to the customer.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Refund Amount (INR, Blank for FULL)</label>
              <input
                type="number"
                placeholder={`Max available: ₹${(refundDialog.amount / 100).toFixed(2)}`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Refund Reason</label>
              <textarea
                required
                rows={2}
                placeholder="Dispute resolution, billing query..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] placeholder-slate-500 uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-rose-400" /> Confirm Administrator Password
              </label>
              <input
                required
                type="password"
                placeholder="ENTER ADMIN PASSWORD..."
                value={refundPassword}
                onChange={(e) => setRefundPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#E50914] placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={refundRequestApproval}
                  onChange={(e) => setRefundRequestApproval(e.target.checked)}
                  className="accent-[#E50914]"
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
                className="px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-slate-300 hover:text-white transition cursor-pointer font-bold uppercase font-mono text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40B16] text-white font-bold transition cursor-pointer disabled:opacity-50 uppercase font-mono text-xs shadow-md shadow-[#E50914]/25"
              >
                {mutating ? "Disbursing..." : "DISBURSE FUNDS"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- COUPON CREATE MODAL -------------------- */}
      {couponFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form onSubmit={handleCreateCoupon} className="w-full max-w-lg rounded-3xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-mono uppercase">
                <Ticket className="w-5 h-5 text-[#E50914]" />
                REGISTER PROMO VOUCHER
              </h3>
              <button
                type="button"
                onClick={() => setCouponFormOpen(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Quick 1-Click Presets */}
            <div className="space-y-1.5 bg-slate-100 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">⚡ 1-Click Discount Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "50% OFF", type: "PERCENT", val: "50", code: "PBURLS50", desc: "50% off all plans" },
                  { label: "25% OFF", type: "PERCENT", val: "25", code: "SAVE25", desc: "25% discount promotion" },
                  { label: "10% OFF", type: "PERCENT", val: "10", code: "WELCOME10", desc: "10% off new user discount" },
                  { label: "👑 100% Free VIP", type: "PERCENT", val: "100", code: "VIPFREE100", desc: "100% Free VIP Subscription Pass" },
                  { label: "₹500 Flat", type: "FLAT", val: "500", code: "FLAT500", desc: "Flat ₹500 off order" },
                  { label: "₹100 Flat", type: "FLAT", val: "100", code: "FLAT100", desc: "Flat ₹100 off order" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setNewCoupon({
                        code: preset.code,
                        description: preset.desc,
                        discount_type: preset.type,
                        discount_value: preset.val,
                        applicable_plans: [],
                        max_redemptions: preset.val === "100" ? "1" : "100",
                        valid_until: "",
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-slate-200 hover:border-[#E50914] hover:text-[#E50914] font-bold text-[11px] transition shadow-xs cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Input & Randomizer */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Coupon Code</label>
                <button
                  type="button"
                  onClick={() => {
                    const rnd = "PB_" + Math.random().toString(36).substring(2, 7).toUpperCase();
                    setNewCoupon(p => ({ ...p, code: rnd }));
                  }}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                >
                  ⚡ Auto-Generate Code
                </button>
              </div>
              <input
                required
                type="text"
                placeholder="e.g. PBURLS50 or SUMMER2026"
                value={newCoupon.code}
                onChange={(e) => {
                  const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                  setNewCoupon(prev => ({ ...prev, code: cleaned }));
                }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#E50914] uppercase placeholder-slate-400"
              />
              <p className="text-[10px] text-slate-500">Only letters, numbers, and hyphens (auto-sanitized, no `%` symbol required).</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Voucher Description</label>
              <input
                type="text"
                placeholder="e.g. Special 50% discount for all subscribers"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#E50914] placeholder-slate-400"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Discount Calculation</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-300 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setNewCoupon(prev => ({ ...prev, discount_type: "PERCENT" }))}
                    className={`py-2 rounded-lg font-bold text-[11px] transition text-center ${newCoupon.discount_type === "PERCENT" ? "bg-[#E50914] text-white shadow-xs" : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`}
                  >
                    Percent (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCoupon(prev => ({ ...prev, discount_type: "FLAT" }))}
                    className={`py-2 rounded-lg font-bold text-[11px] transition text-center ${newCoupon.discount_type === "FLAT" ? "bg-[#E50914] text-white shadow-xs" : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`}
                  >
                    Flat (₹ INR)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">
                  Discount Value ({newCoupon.discount_type === "PERCENT" ? "%" : "₹ INR"})
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max={newCoupon.discount_type === "PERCENT" ? "100" : "100000"}
                  placeholder={newCoupon.discount_type === "PERCENT" ? "50" : "500"}
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, discount_value: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#E50914] placeholder-slate-400 font-bold"
                />
              </div>
            </div>

            {/* Applicable Plans Chips */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Eligible Subscription Plans</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "🌐 All Plans" },
                  { key: "starter", label: "⚡ Starter" },
                  { key: "pro", label: "🚀 Pro" },
                  { key: "business", label: "💼 Business" },
                ].map((plan) => {
                  const currentPlans = Array.isArray(newCoupon.applicable_plans) ? newCoupon.applicable_plans : [];
                  const isAll = currentPlans.length === 0;
                  const isSelected = plan.key === "all" ? isAll : currentPlans.includes(plan.key);

                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => {
                        if (plan.key === "all") {
                          setNewCoupon(prev => ({ ...prev, applicable_plans: [] }));
                        } else {
                          let nextPlans;
                          if (isAll) {
                            nextPlans = [plan.key];
                          } else if (currentPlans.includes(plan.key)) {
                            nextPlans = currentPlans.filter(k => k !== plan.key);
                          } else {
                            nextPlans = [...currentPlans, plan.key];
                          }
                          setNewCoupon(prev => ({ ...prev, applicable_plans: nextPlans }));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border cursor-pointer ${
                        isSelected
                          ? "bg-red-50 dark:bg-red-950/40 border-[#E50914] text-[#E50914]"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-slate-400 hover:border-slate-400"
                      }`}
                    >
                      {plan.label} {isSelected && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Max Redemptions & Expiration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Max Redemptions</label>
                  <button
                    type="button"
                    onClick={() => setNewCoupon(p => ({ ...p, max_redemptions: "" }))}
                    className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Unlimited (∞)
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  value={newCoupon.max_redemptions}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, max_redemptions: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#E50914] placeholder-slate-400 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold block">Valid Until</label>
                <input
                  type="date"
                  value={newCoupon.valid_until}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, valid_until: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#E50914] font-bold"
                />
              </div>
            </div>

            {/* Live Discount Summary Box */}
            {newCoupon.code && newCoupon.discount_value && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <span>✓</span> Promo Summary:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Code <strong className="font-mono bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-900 dark:text-emerald-200">{newCoupon.code}</strong> grants a{" "}
                  <strong>{newCoupon.discount_type === "PERCENT" ? `${newCoupon.discount_value}%` : `₹${newCoupon.discount_value}`} discount</strong> on{" "}
                  <strong>
                    {(!newCoupon.applicable_plans || newCoupon.applicable_plans.length === 0)
                      ? "All Subscription Plans"
                      : newCoupon.applicable_plans.join(", ").toUpperCase()}
                  </strong>.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setCouponFormOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer font-bold uppercase font-mono text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutating}
                className="px-5 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#F40B16] text-white font-bold transition cursor-pointer disabled:opacity-50 uppercase font-mono text-xs shadow-md shadow-[#E50914]/25"
              >
                {mutating ? "Saving..." : "REGISTER VOUCHER"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main><SiteFooter /></div>
  );
}

export default AdminDashboard;
