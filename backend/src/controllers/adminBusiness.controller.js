import { requestAdministrativeRefund } from '../services/billing.service.js';
import prisma from "../config/prismaClient.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { AppError } from "../utils/AppError.js";
import { config } from "../config/config.js";
import { processWebhookPayload } from "./payments.controller.js";
import Razorpay from "razorpay";

const getRazorpayInstance = () => {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) {
    throw new AppError("Razorpay credentials are not configured.", 500);
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * Get subscription revenue dashboard metrics (MRR, trends, subscribers)
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    const cacheKey = "admin:dashboard:overview";
    
    // Check cache
    if (isRedisReady()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const cachedData = await redis.get(cacheKey);
          if (cachedData) {
            return res.status(200).json({
              success: true,
              data: JSON.parse(cachedData),
            });
          }
        }
      } catch (cacheErr) {
        console.error("Dashboard overview read cache error:", cacheErr.message);
      }
    }

    const now = new Date();
    
    // 1. Calculate Active Subscriber Count by Plan & MRR
    let activeSubs = [];
    try {
      activeSubs = await prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      });
    } catch (dbErr) {
      console.warn("Active subs query error:", dbErr.message);
    }

    let totalMrr = 0;
    const subscribersByPlan = { free: 0, starter: 0, pro: 0, business: 0 };

    for (const sub of activeSubs) {
      const planKey = sub.plan?.key || "free";
      if (subscribersByPlan[planKey] !== undefined) {
        subscribersByPlan[planKey]++;
      }

      if (planKey === "free" || !sub.plan) continue;

      let subMrr = 0;
      if (sub.billing_cycle === "MONTHLY") {
        subMrr = sub.plan.price_monthly || 0;
      } else if (sub.billing_cycle === "QUARTERLY") {
        subMrr = Math.round((sub.plan.price_quarterly || ((sub.plan.price_monthly || 0) * 3)) / 3);
      } else if (sub.billing_cycle === "YEARLY") {
        subMrr = Math.round((sub.plan.price_yearly || ((sub.plan.price_monthly || 0) * 12)) / 12);
      }
      totalMrr += subMrr;
    }

    // 2. MRR Trend (Total Captured Payments in each month for the last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    let paymentsLast12Months = [];
    try {
      paymentsLast12Months = await prisma.payment.findMany({
        where: {
          status: "CAPTURED",
          created_at: { gte: twelveMonthsAgo },
        },
        select: {
          amount: true,
          created_at: true,
        },
      });
    } catch (payErr) {
      console.warn("Payments query error:", payErr.message);
    }

    const mrrTrendMap = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleString("default", { month: "short", year: "numeric" });
      mrrTrendMap[key] = 0;
    }

    for (const p of paymentsLast12Months) {
      if (!p.created_at) continue;
      const key = p.created_at.toLocaleString("default", { month: "short", year: "numeric" });
      if (mrrTrendMap[key] !== undefined) {
        mrrTrendMap[key] += (p.amount || 0);
      }
    }

    const mrrTrend = Object.entries(mrrTrendMap).map(([month, revenue]) => ({
      month,
      revenue: revenue || 0,
    }));

    // 3. New Subscriptions vs Cancellations this month, Churn rate
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let newSubsThisMonth = 0;
    let canceledSubsThisMonth = 0;
    let activeAtStart = 0;

    try {
      newSubsThisMonth = await prisma.subscription.count({
        where: {
          started_at: { gte: startOfMonth },
          status: "ACTIVE",
        },
      });

      canceledSubsThisMonth = await prisma.subscription.count({
        where: {
          canceled_at: { gte: startOfMonth },
        },
      });

      activeAtStart = await prisma.subscription.count({
        where: {
          started_at: { lt: startOfMonth },
          OR: [
            { canceled_at: null },
            { canceled_at: { gte: startOfMonth } },
          ],
        },
      });
    } catch (cntErr) {
      console.warn("Subscription count error:", cntErr.message);
    }

    const churnRate = activeAtStart > 0 ? parseFloat(((canceledSubsThisMonth / activeAtStart) * 100).toFixed(2)) : 0;

    // 4. Failed payments in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let failedCount = 0;
    let failedAmount = 0;

    try {
      const failedPaymentsData = await prisma.payment.aggregate({
        where: {
          status: "FAILED",
          created_at: { gte: sevenDaysAgo },
        },
        _count: { id: true },
        _sum: { amount: true },
      });
      failedCount = failedPaymentsData._count?.id || 0;
      failedAmount = failedPaymentsData._sum?.amount || 0;
    } catch (fErr) {
      console.warn("Failed payments aggregate error:", fErr.message);
    }

    // 5. Total revenue this month vs last month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    let revenueThisMonth = 0;
    let revenueLastMonth = 0;

    try {
      const revenueThisMonthData = await prisma.payment.aggregate({
        where: {
          status: "CAPTURED",
          created_at: { gte: startOfMonth },
        },
        _sum: { amount: true },
      });
      revenueThisMonth = revenueThisMonthData._sum?.amount || 0;

      const revenueLastMonthData = await prisma.payment.aggregate({
        where: {
          status: "CAPTURED",
          created_at: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      });
      revenueLastMonth = revenueLastMonthData._sum?.amount || 0;
    } catch (revErr) {
      console.warn("Revenue aggregate error:", revErr.message);
    }

    const data = {
      mrr: totalMrr || 0,
      subscribers: subscribersByPlan,
      mrrTrend,
      growth: {
        newSubscriptions: newSubsThisMonth || 0,
        cancellations: canceledSubsThisMonth || 0,
        churnRate: churnRate || 0,
      },
      failedPayments: {
        count: failedCount || 0,
        amount: failedAmount || 0,
      },
      revenue: {
        thisMonth: revenueThisMonth || 0,
        lastMonth: revenueLastMonth || 0,
      },
    };

    // Save to Cache (5 mins TTL)
    if (isRedisReady()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.set(cacheKey, JSON.stringify(data), "EX", 300);
        }
      } catch (cacheErr) {
        console.error("Dashboard overview set cache error:", cacheErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all payments (paginated, filterable)
 */
export const listPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, email, planKey, startDate, endDate } = req.query;

    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (email) {
      where.user = {
        email: { contains: email, mode: "insensitive" },
      };
    }

    if (planKey) {
      where.plan = { key: planKey };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    // CSV format trigger check
    if (req.query.export === "csv") {
      const allPayments = await prisma.payment.findMany({
        where,
        include: {
          user: { select: { email: true, name: true } },
          plan: { select: { name: true, key: true } },
        },
        orderBy: { created_at: "desc" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=payments_export_${Date.now()}.csv`);
      
      let csvContent = "ID,User Name,User Email,Plan,Billing Cycle,Amount (INR),Status,Gateway Order ID,Gateway Payment ID,Refunded Amount (INR),Created At\n";
      for (const p of allPayments) {
        csvContent += `"${p.id}","${p.user.name}","${p.user.email}","${p.plan.name}","${p.billing_cycle}",${(p.amount / 100).toFixed(2)},"${p.status}","${p.gateway_order_id}","${p.gateway_payment_id || ""}",${(p.refunded_amount / 100).toFixed(2)},"${p.created_at.toISOString()}"\n`;
      }
      return res.status(200).send(csvContent);
    }

    const [total, payments] = await prisma.$transaction([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          user: { select: { email: true, name: true } },
          plan: { select: { name: true, key: true } },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Refund a payment (Admin action, destructive)
 */
export const refundPaymentAdmin = async (req, res, next) => {
  try {
    const refund = await requestAdministrativeRefund(req.params.id, req.body.amount, req.body.reason);
    req.auditMetadata = { paymentId: req.params.id, refundId: refund.id, amount: refund.amount };
    res.status(refund.status === 'PROCESSED' ? 200 : 202).json({ success: true, message: 'Refund recorded with the provider. Payment history shows its confirmed status.', data: refund });
  } catch (error) { next(error); }
};

/**
 * List webhook events
 */
export const listWebhookEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const { processed, eventType } = req.query;

    const where = {};
    if (processed !== undefined) {
      where.processed = processed === "true";
    }
    if (eventType) {
      where.event_type = eventType;
    }

    const [total, events] = await prisma.$transaction([
      prisma.webhookEvent.count({ where }),
      prisma.webhookEvent.findMany({
        where,
        orderBy: { received_at: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Force reprocess a webhook event manually
 */
export const reprocessWebhookEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await prisma.webhookEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new AppError("Webhook event not found.", 404);
    }

    req.auditMetadata = {
      webhookEventId: event.id,
      eventType: event.event_type,
    };

    // Reset status to unprocessed and execute webhook business logic
    await processWebhookPayload(event.event_id, event.event_type, event.payload);

    res.status(200).json({
      success: true,
      message: `Webhook event ${event.event_id} processed successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Coupon CRUD - List all coupons
 */
export const listCoupons = async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      success: true,
      data: coupons,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Coupon CRUD - Create a coupon
 */
export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      applicable_plans,
      max_redemptions,
      valid_from,
      valid_until,
    } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      throw new AppError("code, discount_type, and discount_value are required.", 400);
    }

    const couponCodeFormatted = code.toUpperCase().trim();

    const existing = await prisma.coupon.findUnique({
      where: { code: couponCodeFormatted },
    });

    if (existing) {
      throw new AppError("Coupon code already exists.", 400);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: couponCodeFormatted,
        description,
        discount_type,
        discount_value: parseInt(discount_value),
        applicable_plans: applicable_plans || [],
        max_redemptions: max_redemptions !== undefined ? parseInt(max_redemptions) : null,
        valid_from: valid_from ? new Date(valid_from) : new Date(),
        valid_until: valid_until ? new Date(valid_until) : null,
      },
    });

    req.auditMetadata = {
      couponId: coupon.id,
      code: coupon.code,
    };

    res.status(201).json({
      success: true,
      data: coupon,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Coupon CRUD - Update active toggle status or modify coupon properties
 */
export const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, description, valid_until, max_redemptions } = req.body;

    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new AppError("Coupon not found.", 404);
    }

    const updateData = {};
    if (is_active !== undefined) updateData.is_active = !!is_active;
    if (description !== undefined) updateData.description = description;
    if (valid_until !== undefined) updateData.valid_until = valid_until ? new Date(valid_until) : null;
    if (max_redemptions !== undefined) updateData.max_redemptions = max_redemptions ? parseInt(max_redemptions) : null;

    const updated = await prisma.coupon.update({
      where: { id },
      data: updateData,
    });

    req.auditMetadata = {
      couponId: coupon.id,
      code: coupon.code,
      changes: updateData,
    };

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
