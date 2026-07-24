import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/**
 * List all plans with their limits
 */
export const listPlansAdmin = async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        limit: true,
      },
      orderBy: {
        sort_order: "asc",
      },
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
 * Update plan limits and details
 */
export const updatePlanAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price_monthly, price_quarterly, price_yearly, currency, limit } = req.body;

    const plan = await prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new AppError("Plan not found", 404);
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        name,
        description,
        price_monthly,
        price_quarterly,
        price_yearly,
        currency,
        limit: limit ? {
          update: limit,
        } : undefined,
      },
      include: {
        limit: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all user subscriptions with filtering options
 */
export const listSubscriptionsAdmin = async (req, res, next) => {
  try {
    const { status, planKey } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (planKey) {
      where.plan = {
        key: planKey,
      };
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        plan: true,
      },
      orderBy: {
        started_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: subscriptions,
    });
  } catch (err) {
    next(err);
  }
};
