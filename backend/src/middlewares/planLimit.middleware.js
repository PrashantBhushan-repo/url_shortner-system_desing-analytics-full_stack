import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getRedisClient } from "../config/redisClient.js";
import { hasFeature, checkUrlLimit, getApiRateLimit, getActiveSubscription } from "../services/planLimitService.js";
import { PlanLimitError, AppError } from "../utils/AppError.js";

/**
 * Express middleware to gate a route behind a specific boolean feature check.
 */
export const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new AppError("Authentication required", 401));
      }

      const allowed = await hasFeature(req.user.id, featureKey);
      if (!allowed) {
        const sub = await getActiveSubscription(req.user.id);
        const currentPlan = sub?.plan?.name || "None";
        return res.status(403).json({
          success: false,
          code: "PLAN_LIMIT",
          feature: featureKey,
          currentPlan,
          message: `The feature "${featureKey}" is not available on your current plan (${currentPlan}). Please upgrade.`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Express middleware to enforce total active URL creation limit.
 */
export const enforceUrlLimit = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new AppError("Authentication required", 401));
    }
    await checkUrlLimit(req.user.id);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Dynamic rate limiter for API key authenticated routes.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: async (req) => {
    const userId = req.user?.id;
    if (!userId) return 10; // Default limit for safety if not resolved
    try {
      return await getApiRateLimit(userId);
    } catch {
      return 10;
    }
  },
  keyGenerator: (req) => {
    return req.apiKeyHash || req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new AppError("Too many API requests. Rate limit exceeded for your current plan.", 429));
  },
  store: new RedisStore({
    sendCommand: (command, ...args) => {
      const client = getRedisClient();
      return client.call(command, ...args);
    },
    prefix: "rate_limit:api:",
  }),
});
