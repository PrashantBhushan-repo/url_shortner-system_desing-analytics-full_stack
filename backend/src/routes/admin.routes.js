import express from "express";
import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { authMiddleware, authorize, auditAdminAction, requireStepUpConfirmation, adminIpAllowlistMiddleware } from "../middlewares/auth.middleware.js";
import { adminRateLimiter } from "../middlewares/rateLimit.middleware.js";
import { listPlansAdmin, updatePlanAdmin, listSubscriptionsAdmin } from "../controllers/adminPlan.controller.js";
import {
  listUsersAdmin,
  getUserDetailAdmin,
  updateUserStatusAdmin,
  updateUserRoleAdmin,
  listUrlsAdmin,
  moderateDeleteUrlAdmin,
  listAuditLogsAdmin
} from "../controllers/admin.controller.js";
import {
  getDashboardOverview,
  listPayments,
  refundPaymentAdmin,
  listWebhookEvents,
  reprocessWebhookEvent,
  listCoupons,
  createCoupon,
  updateCoupon
} from "../controllers/adminBusiness.controller.js";
import {
  cancelSubscriptionAdmin,
  resumeSubscriptionAdmin,
  renewSubscriptionAdmin,
  prorateSubscriptionAdmin,
  changePlanSubscriptionAdmin,
  updateInvoiceAdmin,
  triggerDunningRetry,
  writeOffFailedPayment,
  getReconciliationLogs,
  reconcilePaymentSync,
  getBillingReports,
  listApprovalsAdmin,
  decideApprovalAdmin
} from "../controllers/adminBilling.controller.js";

const router = express.Router();

// Apply auth and admin-only access constraints to all admin endpoints
router.use(adminIpAllowlistMiddleware);
router.use(authMiddleware);
router.use(authorize("ADMIN"));
router.use(adminRateLimiter);

// --- Plan & Subscription Endpoints ---
router.get("/plans", listPlansAdmin);
router.patch("/plans/:id", requireStepUpConfirmation, auditAdminAction("plan.update", "Plan", req => req.params.id)(updatePlanAdmin));
router.get("/subscriptions", listSubscriptionsAdmin);

// Subscription Lifecycle Operations
router.patch("/subscriptions/:id/cancel", auditAdminAction("subscription.cancel", "Subscription", req => req.params.id)(cancelSubscriptionAdmin));
router.patch("/subscriptions/:id/resume", auditAdminAction("subscription.resume", "Subscription", req => req.params.id)(resumeSubscriptionAdmin));
router.patch("/subscriptions/:id/renew", auditAdminAction("subscription.renew", "Subscription", req => req.params.id)(renewSubscriptionAdmin));
router.patch("/subscriptions/:id/prorate", auditAdminAction("subscription.prorate", "Subscription", req => req.params.id)(prorateSubscriptionAdmin));

// Change subscription plan directly (auto-queues for approval if requested)
router.post("/subscriptions/:id/change-plan", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { planKey, billingCycle, requestApproval } = req.body;
    
    if (requestApproval) {
      const request = await prisma.approvalRequest.create({
        data: {
          action: "subscription.change_plan",
          status: "PENDING",
          target_id: id,
          payload: { planKey, billingCycle },
          requester_id: req.user.id,
          requester_email: req.user.email,
          reason: `Manual tier modification to ${planKey} (${billingCycle}) requiring approval.`,
        }
      });
      return res.status(202).json({
        success: true,
        queued: true,
        message: "Manual plan modification request has been queued in the Approval Queue.",
        data: request,
      });
    }
    
    return changePlanSubscriptionAdmin(req, res, next);
  } catch (err) {
    next(err);
  }
});

// --- User Management Endpoints ---
router.get("/users", listUsersAdmin);
router.get("/users/:id", getUserDetailAdmin);

// Patch user status (step-up confirmation required if setting status to BANNED)
router.patch("/users/:id/status", (req, res, next) => {
  if (req.body.status === "BANNED") {
    return requireStepUpConfirmation(req, res, (err) => {
      if (err) return next(err);
      auditAdminAction("user.status_change", "User", req => req.params.id)(updateUserStatusAdmin)(req, res, next);
    });
  }
  return auditAdminAction("user.status_change", "User", req => req.params.id)(updateUserStatusAdmin)(req, res, next);
});

// Patch user platform role (USER <-> ADMIN)
router.patch("/users/:id/role", auditAdminAction("user.role_change", "User", req => req.params.id)(updateUserRoleAdmin));

// --- URL Moderation Endpoints ---
router.get("/urls", listUrlsAdmin);
router.delete("/urls/:id", requireStepUpConfirmation, auditAdminAction("url.moderate_delete", "Url", req => req.params.id)(moderateDeleteUrlAdmin));

// --- Audit Visibility ---
router.get("/audit-log", listAuditLogsAdmin);

// --- Business Operations Dashboard & Metrics ---
router.get("/dashboard/overview", getDashboardOverview);
router.get("/dashboard/billing-reports", getBillingReports);

// --- Payment & Refund Endpoints ---
router.get("/payments", listPayments);

// Refund processing: auto-queues for approvals if refund amount > ₹1,000 or explicitly requested
router.post("/payments/:id/refund", requireStepUpConfirmation, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, reason, requestApproval } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new AppError("Payment record not found.", 404);

    const refundAmount = amount ? parseInt(amount) * 100 : (payment.amount - payment.refunded_amount);

    if (refundAmount > 100000 || requestApproval) {
      const request = await prisma.approvalRequest.create({
        data: {
          action: "payment.refund",
          status: "PENDING",
          target_id: id,
          payload: { amount: refundAmount / 100, reason },
          requester_id: req.user.id,
          requester_email: req.user.email,
          reason: reason || "Large amount refund requiring dual-control authorization.",
        }
      });
      return res.status(202).json({
        success: true,
        queued: true,
        message: "Refund amount exceeds single-operator limit (₹1,000). Dual-control authorization request has been queued.",
        data: request,
      });
    }

    return refundPaymentAdmin(req, res, next);
  } catch (err) {
    next(err);
  }
});

// Invoice Edits & dunning retries
router.patch("/payments/:id/invoice", auditAdminAction("invoice.edit", "Payment", req => req.params.id)(updateInvoiceAdmin));
router.post("/payments/:id/dunning-retry", auditAdminAction("invoice.dunning_retry", "Payment", req => req.params.id)(triggerDunningRetry));
router.post("/payments/:id/write-off", requireStepUpConfirmation, auditAdminAction("invoice.write_off", "Payment", req => req.params.id)(writeOffFailedPayment));

// Webhook reconciliation
router.get("/payments/reconciliation", getReconciliationLogs);
router.post("/payments/:id/reconcile-sync", requireStepUpConfirmation, auditAdminAction("reconciliation.sync", "Payment", req => req.params.id)(reconcilePaymentSync));

// --- Webhook Events Logging ---
router.get("/webhooks/events", listWebhookEvents);
router.post("/webhooks/events/:id/reprocess", auditAdminAction("webhook.reprocess", "WebhookEvent", req => req.params.id)(reprocessWebhookEvent));

// --- Coupon Management Endpoints ---
router.get("/coupons", listCoupons);
router.post("/coupons", auditAdminAction("coupon.create", "Coupon", req => req.body.code || "unknown")(createCoupon));
router.patch("/coupons/:id", requireStepUpConfirmation, auditAdminAction("coupon.update", "Coupon", req => req.params.id)(updateCoupon));

// --- Dual Authorization Approval queue ---
router.get("/approvals", listApprovalsAdmin);
router.post("/approvals/:id/decide", decideApprovalAdmin);

export default router;
