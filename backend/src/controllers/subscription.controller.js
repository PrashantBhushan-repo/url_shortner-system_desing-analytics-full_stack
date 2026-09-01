import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { config } from "../config/config.js";
import { getActiveSubscription, invalidateSubscriptionCache } from "../services/planLimitService.js";
import Razorpay from "razorpay";

// Initialize Razorpay client safely
const getRazorpayInstance = () => {
  const { keyId, keySecret } = config.razorpay || {};
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * Fetch current subscription details, plan limits, and current usage metrics
 */
export const getSubscriptionInfo = async (req, res, next) => {
  try {
    const sub = await getActiveSubscription(req.user.id);
    if (!sub) {
      throw new AppError("No active subscription found for user.", 404);
    }

    // Calculate usage
    const urlCount = await prisma.url.count({
      where: {
        user_id: req.user.id,
        is_active: true,
      },
    });

    const teamMembersCount = await prisma.teamMember.count({
      where: {
        team: {
          owner_id: req.user.id,
        },
        status: "ACCEPTED",
      },
    });

    const webhooksCount = await prisma.webhook.count({
      where: {
        user_id: req.user.id,
        is_active: true,
      },
    });

    const customDomainsCount = await prisma.customDomain.count({
      where: {
        user_id: req.user.id,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          id: sub.id,
          billingCycle: sub.billing_cycle,
          status: sub.status,
          startedAt: sub.started_at,
          currentPeriodEnd: sub.current_period_end,
        },
        plan: {
          key: sub.plan.key,
          name: sub.plan.name,
          description: sub.plan.description,
          currency: sub.plan.currency,
          priceMonthly: sub.plan.price_monthly,
        },
        limits: sub.plan.limit,
        usage: {
          urlsCount: urlCount,
          teamMembersCount,
          webhooksCount,
          customDomainsCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually switch subscription plans (for testing)
 */
export const changeSubscription = async (req, res, next) => {
  try {
    const { planKey, billingCycle } = req.body;
    if (!planKey) {
      throw new AppError("planKey is required.", 400);
    }

    const newPlan = await prisma.plan.findUnique({
      where: { key: planKey },
    });

    if (!newPlan) {
      throw new AppError("Target plan not found.", 404);
    }
    if (newPlan.key !== "free") {
      throw new AppError("Direct manual upgrades are not permitted. Please use the checkout flow.", 403);
    }
    
    // Find active subscription
    const activeSub = await prisma.subscription.findFirst({
      where: {
        user_id: req.user.id,
        status: "ACTIVE",
      },
    });

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      if (activeSub) {
        // Cancel the current subscription
        await tx.subscription.update({
          where: { id: activeSub.id },
          data: {
            status: "CANCELED",
            current_period_end: new Date(),
            canceled_at: new Date(),
          },
        });
      }

      // Create new subscription row
      return await tx.subscription.create({
        data: {
          user_id: req.user.id,
          plan_id: newPlan.id,
          billing_cycle: billingCycle || "MONTHLY",
          status: "ACTIVE",
          started_at: new Date(),
        },
        include: {
          plan: true,
        },
      });
    });

    // Invalidate Redis cache
    await invalidateSubscriptionCache(req.user.id);

    res.status(200).json({
      success: true,
      message: `Subscription successfully changed to ${result.plan.name}.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all available plans for pricing presentation (public route)
 */
export const listPlansPublic = async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { is_active: true },
      include: { limit: true },
      orderBy: { sort_order: "asc" },
    });

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Schedule cancellation of active subscription at the end of the period
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find active subscription
    const activeSub = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
    });

    if (!activeSub) {
      throw new AppError("No active subscription found to cancel.", 404);
    }

    if (activeSub.plan.key === "free") {
      throw new AppError("Cannot cancel the default Free subscription.", 400);
    }

    // Schedule cancellation by setting cancel_at_period_end to true
    const updatedSub = await prisma.subscription.update({
      where: { id: activeSub.id },
      data: {
        cancel_at_period_end: true,
        canceled_at: new Date(),
      },
    });

    await invalidateSubscriptionCache(userId);

    res.status(200).json({
      success: true,
      message: "Subscription successfully scheduled for cancellation at the end of the billing period.",
      data: updatedSub,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Re-enable auto-renewal for a subscription scheduled to cancel
 */
export const resumeSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find active subscription scheduled to cancel
    const activeSub = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: "ACTIVE",
        cancel_at_period_end: true,
      },
    });

    if (!activeSub) {
      throw new AppError("No active subscription scheduled to cancel was found.", 404);
    }

    const updatedSub = await prisma.subscription.update({
      where: { id: activeSub.id },
      data: {
        cancel_at_period_end: false,
        canceled_at: null,
      },
    });

    await invalidateSubscriptionCache(userId);

    res.status(200).json({
      success: true,
      message: "Subscription auto-renewal successfully re-enabled.",
      data: updatedSub,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve billing history (payments/invoices) for the current user
 */
export const getInvoices = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const payments = await prisma.payment.findMany({
      where: { user_id: userId },
      include: {
        plan: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Customer Self-Service Refund Request (14-Day Guarantee Policy)
 */
export const requestRefund = async (req, res, next) => {
  try {
    const { paymentId, reason, note } = req.body;
    const userId = req.user.id;

    if (!paymentId) {
      throw new AppError("paymentId is required.", 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        user: true,
      },
    });

    if (!payment) {
      throw new AppError("Payment transaction not found.", 404);
    }

    if (payment.user_id !== userId) {
      throw new AppError("You do not have permission to request a refund for this transaction.", 403);
    }

    if (payment.status !== "CAPTURED") {
      throw new AppError(`Cannot refund payment in status '${payment.status}'. Only captured payments are eligible.`, 400);
    }

    if (payment.refunded_amount >= payment.amount) {
      throw new AppError("This payment transaction has already been fully refunded.", 400);
    }

    // Check 14-Day refund policy guarantee window
    const now = new Date();
    const daysSincePayment = (now.getTime() - new Date(payment.created_at).getTime()) / (1000 * 3600 * 24);
    if (daysSincePayment > 14) {
      throw new AppError("The 14-day money-back guarantee window for this payment has expired. Please contact support@pburls.online for manual billing review.", 400);
    }

    const refundAmount = payment.amount - payment.refunded_amount;

    // Trigger Razorpay Refund API if live gateway payment ID exists and Razorpay is configured
    if (payment.gateway_payment_id && !payment.gateway_payment_id.startsWith("pay_mock_")) {
      const razorpay = getRazorpayInstance();
      if (razorpay) {
        try {
          await razorpay.payments.refund(payment.gateway_payment_id, {
            amount: refundAmount,
            notes: {
              reason: reason || "Customer self-service 14-day refund",
              note: note || "",
              userId,
            },
          });
        } catch (rzpErr) {
          console.error("[Refund] Gateway refund attempt:", rzpErr.message || rzpErr);
        }
      }
    }

    // Execute database transaction: update payment status & revert user to Free tier
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Payment
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "REFUNDED",
          refunded_amount: payment.amount,
          metadata: {
            ...((payment.metadata && typeof payment.metadata === "object") ? payment.metadata : {}),
            refundRequestedAt: now.toISOString(),
            refundReason: reason || "Customer Satisfaction Guarantee",
            refundNote: note || "",
            refundStatus: "COMPLETED",
          },
        },
        include: {
          plan: true,
        },
      });

      // 2. Find and cancel active paid subscription
      const activeSub = await tx.subscription.findFirst({
        where: {
          user_id: userId,
          status: "ACTIVE",
        },
      });

      if (activeSub) {
        await tx.subscription.update({
          where: { id: activeSub.id },
          data: {
            status: "CANCELED",
            canceled_at: now,
            current_period_end: now,
          },
        });
      }

      // 3. Ensure user has a Free plan active subscription
      const freePlan = await tx.plan.findUnique({
        where: { key: "free" },
      });

      if (freePlan) {
        await tx.subscription.create({
          data: {
            user_id: userId,
            plan_id: freePlan.id,
            billing_cycle: "MONTHLY",
            status: "ACTIVE",
            started_at: now,
          },
        });
      }

      return updatedPayment;
    });

    await invalidateSubscriptionCache(userId);

    res.status(200).json({
      success: true,
      message: `Refund of ₹${(refundAmount / 100).toFixed(0)} has been processed successfully under our 14-Day Money-Back Guarantee. Amount will be credited to your original payment method within 5-7 business days.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

