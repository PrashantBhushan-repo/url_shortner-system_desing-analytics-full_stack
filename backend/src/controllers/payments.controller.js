import prisma from "../config/prismaClient.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { AppError } from "../utils/AppError.js";
import { config } from "../config/config.js";
import { invalidateSubscriptionCache } from "../services/planLimitService.js";
import crypto from "crypto";
import Razorpay from "razorpay";

// Initialize Razorpay client safely
const getRazorpayInstance = () => {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) {
    throw new AppError("Razorpay credentials are not configured.", 500);
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Coupon Validation Helper
const validateCouponHelper = async (couponCode, planKey, userId) => {
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode.toUpperCase().trim() },
  });

  if (!coupon) {
    throw new AppError("Invalid coupon code.", 404);
  }

  if (!coupon.is_active) {
    throw new AppError("Coupon is inactive.", 400);
  }

  const now = new Date();
  if (coupon.valid_from > now || (coupon.valid_until && coupon.valid_until < now)) {
    throw new AppError("Coupon has expired.", 400);
  }

  if (coupon.max_redemptions !== null && coupon.times_redeemed >= coupon.max_redemptions) {
    throw new AppError("Coupon redemption limit reached.", 400);
  }

  if (coupon.applicable_plans.length > 0 && !coupon.applicable_plans.includes(planKey)) {
    throw new AppError("Coupon is not applicable to this plan.", 400);
  }

  // Check if already redeemed by this user
  const existingRedemption = await prisma.couponRedemption.findUnique({
    where: {
      coupon_id_user_id: {
        coupon_id: coupon.id,
        user_id: userId,
      },
    },
  });

  if (existingRedemption) {
    throw new AppError("You have already redeemed this coupon.", 400);
  }

  return coupon;
};

// Calculate Discount
const calculateDiscount = (coupon, amount) => {
  if (coupon.discount_type === "PERCENT") {
    const discount = Math.round((amount * coupon.discount_value) / 100);
    return Math.max(0, amount - discount);
  } else if (coupon.discount_type === "FLAT") {
    return Math.max(0, amount - coupon.discount_value);
  }
  return amount;
};

/**
 * Create order for Razorpay checkout
 */
export const createOrder = async (req, res, next) => {
  try {
    const { planKey, billingCycle, couponCode } = req.body;
    const userId = req.user.id;

    if (!planKey || !billingCycle) {
      throw new AppError("planKey and billingCycle are required.", 400);
    }

    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
    });

    if (!plan) {
      throw new AppError("Plan not found.", 404);
    }

    let amount = 0;
    if (billingCycle === "MONTHLY") {
      amount = plan.price_monthly;
    } else if (billingCycle === "QUARTERLY") {
      amount = plan.price_quarterly || (plan.price_monthly * 3);
    } else if (billingCycle === "YEARLY") {
      amount = plan.price_yearly || (plan.price_monthly * 12);
    } else {
      throw new AppError("Invalid billing cycle.", 400);
    }

    let coupon = null;
    if (couponCode) {
      coupon = await validateCouponHelper(couponCode, planKey, userId);
      amount = calculateDiscount(coupon, amount);
    }

    // Zero-charge bypass (e.g. 100% discount coupons)
    if (amount <= 0) {
      const orderId = `free_order_${crypto.randomBytes(12).toString("hex")}`;
      
      const payment = await prisma.payment.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          billing_cycle: billingCycle,
          amount: 0,
          status: "CAPTURED",
          gateway: "coupon_bypass",
          gateway_order_id: orderId,
        },
      });

      await prisma.$transaction(async (tx) => {
        // Cancel active subscriptions
        await tx.subscription.updateMany({
          where: { user_id: userId, status: "ACTIVE" },
          data: { status: "CANCELED", canceled_at: new Date() },
        });

        const periodEnd = new Date();
        if (billingCycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (billingCycle === "QUARTERLY") periodEnd.setMonth(periodEnd.getMonth() + 3);
        if (billingCycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        const sub = await tx.subscription.create({
          data: {
            user_id: userId,
            plan_id: plan.id,
            billing_cycle: billingCycle,
            status: "ACTIVE",
            started_at: new Date(),
            current_period_end: periodEnd,
            external_subscription_id: orderId,
          },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: { subscription_id: sub.id },
        });

        if (coupon) {
          await tx.couponRedemption.create({
            data: {
              coupon_id: coupon.id,
              user_id: userId,
              payment_id: payment.id,
            },
          });

          await tx.coupon.update({
            where: { id: coupon.id },
            data: { times_redeemed: { increment: 1 } },
          });
        }
      });

      await invalidateSubscriptionCache(userId);

      return res.status(201).json({
        success: true,
        zeroCharge: true,
        message: "Subscription activated successfully via 100% discount coupon.",
      });
    }

    // Check if Razorpay keys are configured
    const { keyId, keySecret } = config.razorpay;
    const isMockMode = !keyId || !keySecret;

    if (isMockMode) {
      const mockOrderId = `mock_order_${crypto.randomBytes(12).toString("hex")}`;
      
      const payment = await prisma.payment.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          billing_cycle: billingCycle,
          amount,
          currency: plan.currency || "INR",
          status: "CREATED",
          gateway: "mock_payment",
          gateway_order_id: mockOrderId,
          metadata: {
            couponCode: couponCode || null,
            receipt: `receipt_mock_${userId.slice(0, 8)}_${Date.now()}`,
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          orderId: mockOrderId,
          amount,
          currency: plan.currency || "INR",
          keyId: "rzp_mock_key_id",
          paymentId: payment.id,
          isMock: true,
        },
      });
    }

    const razorpay = getRazorpayInstance();
    const orderReceipt = `receipt_${userId.slice(0, 8)}_${Date.now()}`;
    
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: plan.currency || "INR",
      receipt: orderReceipt,
      notes: {
        userId,
        planId: plan.id,
        planKey,
        billingCycle,
        couponId: coupon?.id || "",
      },
    });

    const payment = await prisma.payment.create({
      data: {
        user_id: userId,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        amount,
        currency: plan.currency || "INR",
        status: "CREATED",
        gateway_order_id: razorpayOrder.id,
        metadata: {
          couponCode: couponCode || null,
          receipt: orderReceipt,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: config.razorpay.keyId,
        paymentId: payment.id,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify Mock payment checkout client-side simulation
 */
export const verifyMockPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      throw new AppError("orderId is required.", 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { gateway_order_id: orderId },
      include: { plan: true },
    });

    if (!payment) {
      throw new AppError("Mock payment order not found.", 404);
    }

    if (payment.user_id !== userId) {
      throw new AppError("Unauthorized.", 403);
    }

    if (payment.status === "CAPTURED") {
      return res.status(200).json({
        success: true,
        message: "Payment already captured.",
      });
    }

    // Capture payment and activate subscription
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          gateway_payment_id: paymentId || `pay_mock_${crypto.randomBytes(10).toString("hex")}`,
        },
      });

      const periodEnd = new Date();
      if (payment.billing_cycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
      if (payment.billing_cycle === "QUARTERLY") periodEnd.setMonth(periodEnd.getMonth() + 3);
      if (payment.billing_cycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      // Cancel previous active subscriptions
      await tx.subscription.updateMany({
        where: { user_id: userId, status: "ACTIVE" },
        data: { status: "CANCELED", canceled_at: new Date() },
      });

      // Create new active subscription
      const sub = await tx.subscription.create({
        data: {
          user_id: userId,
          plan_id: payment.plan_id,
          billing_cycle: payment.billing_cycle,
          status: "ACTIVE",
          started_at: new Date(),
          current_period_end: periodEnd,
          external_subscription_id: orderId,
        },
      });

      // Associate subscription to payment
      await tx.payment.update({
        where: { id: payment.id },
        data: { subscription_id: sub.id },
      });

      // Handle coupon redemption tracking if any
      const couponCode = payment.metadata?.couponCode;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode.toUpperCase().trim() },
        });
        if (coupon) {
          await tx.couponRedemption.create({
            data: {
              coupon_id: coupon.id,
              user_id: userId,
              payment_id: payment.id,
            },
          });

          await tx.coupon.update({
            where: { id: coupon.id },
            data: { times_redeemed: { increment: 1 } },
          });
        }
      }
    });

    await invalidateSubscriptionCache(userId);

    res.status(200).json({
      success: true,
      message: "Mock payment successfully verified and subscription activated.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark mock payment order as failed
 */
export const failMockPayment = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      throw new AppError("orderId is required.", 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { gateway_order_id: orderId },
    });

    if (!payment) {
      throw new AppError("Mock payment order not found.", 404);
    }

    if (payment.user_id !== userId) {
      throw new AppError("Unauthorized.", 403);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failure_reason: reason || "User simulated checkout failure.",
      },
    });

    res.status(200).json({
      success: true,
      message: "Mock payment marked as failed.",
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Verify Razorpay checkout signature
 */
export const verifySignature = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError("razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.", 400);
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new AppError("Invalid payment signature verification failed.", 400);
    }

    // Signature verified!
    // Update payment status to AUTHORIZED (awaiting capturing webhook)
    await prisma.payment.update({
      where: { gateway_order_id: razorpay_order_id },
      data: {
        status: "AUTHORIZED",
        gateway_payment_id: razorpay_payment_id,
        gateway_signature: razorpay_signature,
      },
    });

    // Set Redis pending flag
    if (isRedisReady()) {
      try {
        const redis = getRedisClient();
        await redis.set(`payment_pending:${razorpay_order_id}`, "1", "EX", 180); // 3 minutes expiration
      } catch (redisErr) {
        console.error("Redis pending flag error:", redisErr.message);
      }
    }

    res.status(200).json({
      success: true,
      status: "processing",
      message: "Payment signature verified. Subscription activation is processing.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Validate Coupon code (Read-only preview)
 */
export const validateCoupon = async (req, res, next) => {
  try {
    const { couponCode, planKey } = req.body;
    const userId = req.user.id;

    if (!couponCode || !planKey) {
      throw new AppError("couponCode and planKey are required.", 400);
    }

    const coupon = await validateCouponHelper(couponCode, planKey, userId);

    res.status(200).json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        description: coupon.description,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Webhook Processor Business Logic (Shared with Reprocess Event)
 */
export const processWebhookPayload = async (eventId, eventType, payload) => {
  let webhookEvent = await prisma.webhookEvent.findUnique({
    where: { event_id: eventId },
  });

  if (webhookEvent && webhookEvent.processed) {
    console.log(`[Webhook] Event ${eventId} was already processed successfully.`);
    return { success: true };
  }

  if (!webhookEvent) {
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        event_id: eventId,
        event_type: eventType,
        payload,
        processed: false,
      },
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (eventType === "payment.captured") {
        const paymentEntity = payload.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;

        const payment = await tx.payment.findUnique({
          where: { gateway_order_id: orderId },
          include: { plan: true },
        });

        if (payment) {
          // Update payment state
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "CAPTURED",
              gateway_payment_id: paymentId,
            },
          });

          // Set period end
          const periodEnd = new Date();
          if (payment.billing_cycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
          if (payment.billing_cycle === "QUARTERLY") periodEnd.setMonth(periodEnd.getMonth() + 3);
          if (payment.billing_cycle === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

          // Cancel other active subscriptions for this user
          await tx.subscription.updateMany({
            where: { user_id: payment.user_id, status: "ACTIVE" },
            data: { status: "CANCELED", canceled_at: new Date() },
          });

          // Create new active subscription
          const sub = await tx.subscription.create({
            data: {
              user_id: payment.user_id,
              plan_id: payment.plan_id,
              billing_cycle: payment.billing_cycle,
              status: "ACTIVE",
              started_at: new Date(),
              current_period_end: periodEnd,
              external_subscription_id: orderId,
            },
          });

          // Associate subscription to payment
          await tx.payment.update({
            where: { id: payment.id },
            data: { subscription_id: sub.id },
          });

          // Handle coupon redemption tracking if any notes contain couponId
          const notes = paymentEntity.notes || {};
          if (notes.couponId) {
            await tx.couponRedemption.create({
              data: {
                coupon_id: notes.couponId,
                user_id: payment.user_id,
                payment_id: payment.id,
              },
            });

            await tx.coupon.update({
              where: { id: notes.couponId },
              data: { times_redeemed: { increment: 1 } },
            });
          }
        }
      } 
      else if (eventType === "payment.failed") {
        const paymentEntity = payload.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const failReason = paymentEntity.error_description || "Payment failed.";

        const payment = await tx.payment.findUnique({
          where: { gateway_order_id: orderId },
        });

        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "FAILED",
              failure_reason: failReason,
            },
          });

          // Dunning: set current subscription to PAST_DUE if this was a renewal attempt
          const currentSub = await tx.subscription.findFirst({
            where: { user_id: payment.user_id, status: "ACTIVE" },
          });

          if (currentSub && currentSub.plan_id === payment.plan_id) {
            await tx.subscription.update({
              where: { id: currentSub.id },
              data: { status: "PAST_DUE" },
            });
          }
        }
      } 
      else if (eventType === "refund.processed") {
        const refundEntity = payload.payload.refund.entity;
        const paymentId = refundEntity.payment_id;
        const refundAmt = refundEntity.amount; // in paise

        const payment = await tx.payment.findFirst({
          where: { gateway_payment_id: paymentId },
        });

        if (payment) {
          const newRefundedAmount = payment.refunded_amount + refundAmt;
          const fullRefund = newRefundedAmount >= payment.amount;

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
              refunded_amount: newRefundedAmount,
            },
          });

          if (fullRefund && payment.subscription_id) {
            // Cancel subscription
            await tx.subscription.update({
              where: { id: payment.subscription_id },
              data: { status: "CANCELED", canceled_at: new Date() },
            });
          }
        }
      }
    });

    // Post-transaction Cache invalidation
    if (eventType === "payment.captured" || eventType === "payment.failed" || eventType === "refund.processed") {
      const orderId = payload.payload.payment?.entity?.order_id || payload.payload.refund?.entity?.payment_id;
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { gateway_order_id: orderId || undefined },
            { gateway_payment_id: orderId || undefined },
          ],
        },
        select: { user_id: true },
      });
      if (payment) {
        await invalidateSubscriptionCache(payment.user_id);
      }
    }

    // Mark event processed successfully
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: true,
        processed_at: new Date(),
        processing_error: null,
      },
    });

    return { success: true };
  } catch (err) {
    console.error(`[Webhook Process] Error processing event ${eventId}:`, err.message);
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processed: false,
        processing_error: err.message,
      },
    });
    throw err;
  }
};

/**
 * Public Webhook receiver for Razorpay events
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = config.razorpay.webhookSecret;

    if (!signature) {
      throw new AppError("Signature header missing", 400);
    }

    // Verify HMAC webhook signature
    const rawBody = req.body.toString("utf8");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new AppError("Signature verification failed", 400);
    }

    const payload = JSON.parse(rawBody);
    
    // Use x-razorpay-event-id or payload event_id if present, otherwise fallback
    const eventId = req.headers["x-razorpay-event-id"] || payload.event_id || `evt_${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 16)}`;

    await processWebhookPayload(eventId, payload.event, payload);

    res.status(200).json({ success: true, message: "Webhook processed." });
  } catch (err) {
    next(err);
  }
};
