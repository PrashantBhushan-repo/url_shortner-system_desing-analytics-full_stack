import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import { getActiveSubscription, invalidateSubscriptionCache } from "../services/planLimitService.js";

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

