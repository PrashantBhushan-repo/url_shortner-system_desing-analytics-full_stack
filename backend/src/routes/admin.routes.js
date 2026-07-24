import express from "express";
import { authMiddleware, authorize, auditAdminAction, requireStepUpConfirmation } from "../middlewares/auth.middleware.js";
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

const router = express.Router();

// Apply auth and admin-only access constraints to all admin endpoints
router.use(authMiddleware);
router.use(authorize("ADMIN"));
router.use(adminRateLimiter);

// --- Plan & Subscription Endpoints ---
router.get("/plans", listPlansAdmin);
router.patch("/plans/:id", auditAdminAction("plan.update", "Plan", req => req.params.id)(updatePlanAdmin));
router.get("/subscriptions", listSubscriptionsAdmin);

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
router.delete("/urls/:id", auditAdminAction("url.moderate_delete", "Url", req => req.params.id)(moderateDeleteUrlAdmin));

// --- Audit Visibility ---
router.get("/audit-log", listAuditLogsAdmin);

// --- Business Operations Dashboard & Metrics ---
router.get("/dashboard/overview", getDashboardOverview);

// --- Payment & Refund Endpoints ---
router.get("/payments", listPayments);
router.post("/payments/:id/refund", requireStepUpConfirmation, auditAdminAction("payment.refund", "Payment", req => req.params.id)(refundPaymentAdmin));

// --- Webhook Events Logging ---
router.get("/webhooks/events", listWebhookEvents);
router.post("/webhooks/events/:id/reprocess", auditAdminAction("webhook.reprocess", "WebhookEvent", req => req.params.id)(reprocessWebhookEvent));

// --- Coupon Management Endpoints ---
router.get("/coupons", listCoupons);
router.post("/coupons", auditAdminAction("coupon.create", "Coupon", req => req.body.code || "unknown")(createCoupon));
router.patch("/coupons/:id", auditAdminAction("coupon.update", "Coupon", req => req.params.id)(updateCoupon));

export default router;
