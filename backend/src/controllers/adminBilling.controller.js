import prisma from "../config/prismaClient.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { AppError } from "../utils/AppError.js";
import { invalidateSubscriptionCache } from "../services/planLimitService.js";

// Helper to invalidate dashboard cache
const clearDashboardCache = async () => {
  if (isRedisReady()) {
    try {
      const redis = getRedisClient();
      await redis.del("admin:dashboard:overview");
    } catch (err) {
      console.error("Cache clear error:", err.message);
    }
  }
};

/**
 * 1. SUBSCRIPTION LIFECYCLE MANAGEMENT
 */

// Cancel subscription instantly
export const cancelSubscriptionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new AppError("Subscription not found.", 404);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceled_at: new Date(),
        cancel_at_period_end: false,
      },
    });

    await invalidateSubscriptionCache(sub.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: "Subscription canceled immediately by admin.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Resume subscription auto-renewal
export const resumeSubscriptionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new AppError("Subscription not found.", 404);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        canceled_at: null,
        cancel_at_period_end: false,
      },
    });

    await invalidateSubscriptionCache(sub.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: "Subscription auto-renewal resumed by admin.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Renew subscription (Extend by 1 cycle)
export const renewSubscriptionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sub = await prisma.subscription.findUnique({ 
      where: { id },
      include: { plan: true },
    });
    if (!sub) throw new AppError("Subscription not found.", 404);

    const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
    const newEnd = new Date(currentEnd);

    if (sub.billing_cycle === "MONTHLY") newEnd.setMonth(newEnd.getMonth() + 1);
    else if (sub.billing_cycle === "QUARTERLY") newEnd.setMonth(newEnd.getMonth() + 3);
    else if (sub.billing_cycle === "YEARLY") newEnd.setFullYear(newEnd.getFullYear() + 1);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        current_period_end: newEnd,
      },
    });

    await invalidateSubscriptionCache(sub.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: "Subscription extended successfully.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Prorate/Adjust subscription expiration by days
export const prorateSubscriptionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days } = req.body; // e.g. +10, -5

    if (days === undefined || isNaN(days)) {
      throw new AppError("Valid days parameter is required.", 400);
    }

    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new AppError("Subscription not found.", 404);

    const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
    const newEnd = new Date(currentEnd.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

    const updated = await prisma.subscription.update({
      where: { id },
      data: { current_period_end: newEnd },
    });

    await invalidateSubscriptionCache(sub.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: `Subscription period adjusted by ${days} days.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Change Subscription Plan
export const changePlanSubscriptionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { planKey, billingCycle } = req.body;

    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new AppError("Subscription not found.", 404);

    const plan = await prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan) throw new AppError("Target plan not found.", 404);

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        plan_id: plan.id,
        billing_cycle: billingCycle || sub.billing_cycle,
        status: "ACTIVE",
      },
    });

    await invalidateSubscriptionCache(sub.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: `Subscription upgraded/changed to plan ${planKey}.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * 2. INVOICE AND DUNNING RETRY MANAGEMENT
 */

// Edit invoice metadata
export const updateInvoiceAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, taxId, companyName, status } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new AppError("Payment record not found.", 404);

    const existingMetadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    const updatedMetadata = {
      ...existingMetadata,
      taxId: taxId !== undefined ? taxId : existingMetadata.taxId,
      companyName: companyName !== undefined ? companyName : existingMetadata.companyName,
      adminNotes: notes !== undefined ? notes : existingMetadata.adminNotes,
    };

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: status || payment.status,
        metadata: updatedMetadata,
      },
    });

    res.status(200).json({
      success: true,
      message: "Invoice records updated successfully.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Simulate payment gateway retry trigger (dunning)
export const triggerDunningRetry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({ 
      where: { id },
      include: { user: true, plan: true }
    });
    if (!payment) throw new AppError("Payment record not found.", 404);

    if (payment.status !== "FAILED") {
      throw new AppError("Only failed payments can undergo dunning retry simulation.", 400);
    }

    const existingMetadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    const retryCount = (existingMetadata.retryCount || 0) + 1;

    // Simulate outcome (80% failure retry, 20% success recovery)
    const recoverySuccess = Math.random() < 0.20;
    let finalStatus = "FAILED";
    let message = `Dunning retry #${retryCount} failed. User notification email sent.`;

    if (recoverySuccess) {
      finalStatus = "CAPTURED";
      message = `Dunning retry #${retryCount} recovered successfully! Subscription activated.`;
      
      // Update/Create subscription
      const periodEnd = new Date();
      if (payment.billing_cycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (payment.billing_cycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      await prisma.subscription.create({
        data: {
          user_id: payment.user_id,
          plan_id: payment.plan_id,
          billing_cycle: payment.billing_cycle,
          status: "ACTIVE",
          started_at: new Date(),
          current_period_end: periodEnd,
        }
      });
      await invalidateSubscriptionCache(payment.user_id);
    } else if (retryCount >= 3) {
      message = `Dunning retry limit reached (3 attempts). Billing cycle written off.`;
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: finalStatus,
        metadata: {
          ...existingMetadata,
          retryCount,
          lastRetryAt: new Date().toISOString(),
          dunningLogs: [...(existingMetadata.dunningLogs || []), {
            timestamp: new Date().toISOString(),
            attempt: retryCount,
            result: finalStatus === "CAPTURED" ? "SUCCESS" : "FAILED",
          }],
        },
      },
    });

    res.status(200).json({
      success: true,
      message,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// Write off failed invoice
export const writeOffFailedPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new AppError("Payment record not found.", 404);

    const existingMetadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    const updated = await prisma.payment.update({
      where: { id },
      data: {
        metadata: {
          ...existingMetadata,
          writtenOff: true,
          writtenOffAt: new Date().toISOString(),
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Failed invoice written off successfully.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};


/**
 * 3. FINANCE RECONCILIATION AND SYNC
 */

// Scan for gateway status mismatches against webhook logs
export const getReconciliationLogs = async (req, res, next) => {
  try {
    // 1. Fetch Webhook Ingestion events
    const captureEvents = await prisma.webhookEvent.findMany({
      where: { event_type: "payment.captured" },
      orderBy: { received_at: "desc" },
      take: 100,
    });

    // 2. Scan for payments in CREATED/FAILED state that have matching CAPTURED webhook payloads
    const mismatches = [];
    const unreconciledCreated = await prisma.payment.findMany({
      where: {
        status: { in: ["CREATED", "FAILED"] },
        created_at: { lte: new Date(Date.now() - 30 * 60 * 1000) } // older than 30 mins
      },
      include: { user: { select: { email: true } } },
      orderBy: { created_at: "desc" },
    });

    for (const payment of unreconciledCreated) {
      // Find matching webhook event by order ID or payment ID
      const matchingEvent = captureEvents.find(evt => {
        const payload = evt.payload || {};
        const entity = payload.entity || payload.payment?.entity || {};
        return entity.order_id === payment.gateway_order_id || entity.id === payment.gateway_payment_id;
      });

      if (matchingEvent) {
        mismatches.push({
          paymentId: payment.id,
          email: payment.user.email,
          gatewayOrderId: payment.gateway_order_id,
          localStatus: payment.status,
          gatewayStatus: "CAPTURED",
          webhookEventId: matchingEvent.event_id,
          receivedAt: matchingEvent.received_at,
          type: "STATUS_MISMATCH",
        });
      } else {
        // Just flag as stale created order
        const timeDiffHours = (Date.now() - payment.created_at.getTime()) / (1000 * 60 * 60);
        if (timeDiffHours > 24) {
          mismatches.push({
            paymentId: payment.id,
            email: payment.user.email,
            gatewayOrderId: payment.gateway_order_id,
            localStatus: payment.status,
            gatewayStatus: "UNPAID_EXPIRED",
            type: "STALE_ABANDONED",
            hoursOld: Math.round(timeDiffHours),
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      data: mismatches,
    });
  } catch (err) {
    next(err);
  }
};

// Force Reconcile state mismatch
export const reconcilePaymentSync = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!payment) throw new AppError("Payment record not found.", 404);

    // Sync database payment to CAPTURED
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { status: "CAPTURED" },
      });

      // Revoke any current active sub
      await tx.subscription.updateMany({
        where: { user_id: payment.user_id, status: "ACTIVE" },
        data: { status: "CANCELED", canceled_at: new Date() },
      });

      // Construct subscription cycle dates
      const periodEnd = new Date();
      if (payment.billing_cycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (payment.billing_cycle === "QUARTERLY") periodEnd.setMonth(periodEnd.getMonth() + 3);
      else if (payment.billing_cycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      const sub = await tx.subscription.create({
        data: {
          user_id: payment.user_id,
          plan_id: payment.plan_id,
          billing_cycle: payment.billing_cycle,
          status: "ACTIVE",
          started_at: new Date(),
          current_period_end: periodEnd,
          external_subscription_id: payment.gateway_order_id,
        },
      });

      await tx.payment.update({
        where: { id },
        data: { subscription_id: sub.id },
      });
    });

    await invalidateSubscriptionCache(payment.user_id);
    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: "Payment successfully synchronized and reconciled with local tables.",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * 4. ADVANCED BILLING OPERATIONS & TELEMETRY
 */

export const getBillingReports = async (req, res, next) => {
  try {
    const now = new Date();
    
    // 1. Revenue Recognition Trend (Accrued monthly recognized values)
    const payments = await prisma.payment.findMany({
      where: { status: "CAPTURED" },
      orderBy: { created_at: "asc" },
    });

    const monthlyRevenue = {};
    // Seed monthly records
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short", year: "numeric" });
      monthlyRevenue[key] = { recognized: 0, deferred: 0 };
    }

    payments.forEach((p) => {
      const amt = p.amount;
      const start = new Date(p.created_at);
      let monthsToRecognize = 1;
      if (p.billing_cycle === "QUARTERLY") monthsToRecognize = 3;
      else if (p.billing_cycle === "YEARLY") monthsToRecognize = 12;

      const portion = Math.round(amt / monthsToRecognize);

      for (let m = 0; m < monthsToRecognize; m++) {
        const targetDate = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const key = targetDate.toLocaleString("default", { month: "short", year: "numeric" });
        if (monthlyRevenue[key] !== undefined) {
          monthlyRevenue[key].recognized += portion;
        }
      }
    });

    const revRecReport = Object.entries(monthlyRevenue).map(([month, data]) => ({
      month,
      recognized: data.recognized, // paise
      deferred: data.deferred,
    }));

    // 2. Refund Trends
    const refunds = await prisma.payment.findMany({
      where: { status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] } },
      select: { refunded_amount: true, amount: true, created_at: true },
    });

    const monthlyRefunds = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short", year: "numeric" });
      monthlyRefunds[key] = 0;
    }

    refunds.forEach((r) => {
      const key = r.created_at.toLocaleString("default", { month: "short", year: "numeric" });
      if (monthlyRefunds[key] !== undefined) {
        monthlyRefunds[key] += r.refunded_amount || r.amount;
      }
    });

    const refundReport = Object.entries(monthlyRefunds).map(([month, amount]) => ({
      month,
      refunded: amount,
    }));

    // 3. Cohort Churn Analysis Grid
    // Group user signups by month (cohorts)
    const users = await prisma.user.findMany({
      select: { id: true, createdAt: true, subscriptions: { select: { status: true, started_at: true } } },
      orderBy: { createdAt: "asc" },
    });

    const cohortGroups = {};
    users.forEach((usr) => {
      const signupDate = new Date(usr.createdAt);
      const key = signupDate.toLocaleString("default", { month: "short", year: "numeric" });
      if (!cohortGroups[key]) {
        cohortGroups[key] = { name: key, totalUsers: 0, retained: [0, 0, 0, 0] };
      }
      cohortGroups[key].totalUsers++;

      // Check if user has active sub starting in month + 1, +2, +3...
      const activeSubs = usr.subscriptions || [];
      activeSubs.forEach((sub) => {
        if (sub.status === "ACTIVE") {
          const subDate = new Date(sub.started_at);
          const monthDiff = (subDate.getFullYear() - signupDate.getFullYear()) * 12 + (subDate.getMonth() - signupDate.getMonth());
          for (let idx = 0; idx < 4; idx++) {
            if (monthDiff >= idx && cohortGroups[key].retained[idx] !== undefined) {
              cohortGroups[key].retained[idx]++;
            }
          }
        }
      });
    });

    // Format cohort data
    const cohortReport = Object.values(cohortGroups).slice(-6).map((c) => {
      const retentionPercentages = c.retained.map((count) => {
        if (c.totalUsers === 0) return 0;
        const pct = Math.round((count / c.totalUsers) * 100);
        return Math.min(100, pct);
      });
      return {
        cohort: c.name,
        size: c.totalUsers,
        m0: 100,
        m1: retentionPercentages[1] || 0,
        m2: retentionPercentages[2] || 0,
        m3: retentionPercentages[3] || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        revRec: revRecReport,
        refunds: refundReport,
        cohorts: cohortReport,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * 5. ROLE-BASED DUAL AUTHORIZATION APPROVAL QUEUE
 */

// List approvals
export const listApprovalsAdmin = async (req, res, next) => {
  try {
    const approvals = await prisma.approvalRequest.findMany({
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      success: true,
      data: approvals,
    });
  } catch (err) {
    next(err);
  }
};

// Decide approval status (Approve / Reject)
export const decideApprovalAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // APPROVED or REJECTED

    if (!["APPROVED", "REJECTED"].includes(status)) {
      throw new AppError("Invalid decision status.", 400);
    }

    const request = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!request) throw new AppError("Approval request not found.", 404);

    if (request.status !== "PENDING") {
      throw new AppError("Approval request already resolved.", 400);
    }

    const adminUser = req.user;

    // Prevent self-approval to enforce dual-control checks
    if (request.requester_id === adminUser.id) {
      throw new AppError("Enforce dual-control checks: Administrators cannot approve their own requests.", 400);
    }

    const payload = request.payload && typeof request.payload === "object" ? request.payload : {};

    let executionMessage = "";

    if (status === "APPROVED") {
      // Execute queued action
      if (request.action === "payment.refund") {
        const payment = await prisma.payment.findUnique({ where: { id: request.target_id } });
        if (!payment) throw new AppError("Payment record no longer exists.", 404);

        // Update Payment status to REFUNDED
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "REFUNDED",
            refunded_amount: payment.amount,
          },
        });

        // Deactivate User Subscription
        if (payment.subscription_id) {
          await prisma.subscription.update({
            where: { id: payment.subscription_id },
            data: { status: "CANCELED", canceled_at: new Date() },
          });
          await invalidateSubscriptionCache(payment.user_id);
        }

        executionMessage = "Goodwill refund processed in database.";
      } else if (request.action === "subscription.change_plan") {
        const sub = await prisma.subscription.findUnique({ where: { id: request.target_id } });
        if (!sub) throw new AppError("Subscription record no longer exists.", 404);

        const plan = await prisma.plan.findUnique({ where: { key: payload.planKey } });
        if (!plan) throw new AppError("Target plan not found.", 404);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            plan_id: plan.id,
            billing_cycle: payload.billingCycle || sub.billing_cycle,
            status: "ACTIVE",
          },
        });

        await invalidateSubscriptionCache(sub.user_id);
        executionMessage = "Subscription tier modification applied successfully.";
      }
    }

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status,
        approver_id: adminUser.id,
        approver_email: adminUser.email,
        reason: reason || "Approved/Rejected by Finance Officer",
      },
    });

    await clearDashboardCache();

    res.status(200).json({
      success: true,
      message: `Request status successfully set to ${status}. ${executionMessage}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
