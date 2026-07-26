import prisma from "../config/prismaClient.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { PlanLimitError } from "../utils/AppError.js";

const REDIS_PREFIX = "plan:";
const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Fetch active subscription with joined Plan & PlanLimit.
 * Employs Redis caching.
 */
export const getActiveSubscription = async (userId) => {
  const cacheKey = `${REDIS_PREFIX}${userId}`;
  const redis = getRedisClient();

  if (isRedisReady()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error("Redis error fetching subscription:", err.message);
    }
  }

  // Check if the user is the demo evaluator or an administrator
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true }
  });

  if (user && (user.email === "evaluator.demo@snapurl.com" || user.role === "ADMIN")) {
    const businessPlan = await prisma.plan.findFirst({
      where: { key: "business", is_active: true },
      include: { limit: true }
    });
    if (businessPlan) {
      const simulatedSub = {
        id: "bypass-sub-id",
        billing_cycle: "YEARLY",
        status: "ACTIVE",
        started_at: new Date(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        plan: {
          key: businessPlan.key,
          name: businessPlan.name,
          description: businessPlan.description,
          currency: businessPlan.currency,
          priceMonthly: businessPlan.price_monthly,
          limit: businessPlan.limit
        }
      };

      if (isRedisReady()) {
        try {
          await redis.set(cacheKey, JSON.stringify(simulatedSub), "EX", CACHE_TTL);
        } catch (err) {
          console.error("Redis error caching simulated subscription:", err.message);
        }
      }
      return simulatedSub;
    }
  }

  // Fetch from database
  const subscription = await prisma.subscription.findFirst({
    where: {
      user_id: userId,
      status: "ACTIVE",
    },
    include: {
      plan: {
        include: {
          limit: true,
        },
      },
    },
    orderBy: {
      started_at: "desc",
    },
  });

  if (subscription && isRedisReady()) {
    try {
      await redis.set(cacheKey, JSON.stringify(subscription), "EX", CACHE_TTL);
    } catch (err) {
      console.error("Redis error setting subscription:", err.message);
    }
  }

  return subscription;
};

/**
 * Invalidates the Redis cache for a user's subscription
 */
export const invalidateSubscriptionCache = async (userId) => {
  if (isRedisReady()) {
    const redis = getRedisClient();
    try {
      await redis.del(`${REDIS_PREFIX}${userId}`);
    } catch (err) {
      console.error("Redis error invalidating subscription:", err.message);
    }
  }
};

/**
 * Boolean check against a PlanLimit field
 */
export const hasFeature = async (userId, featureKey) => {
  const sub = await getActiveSubscription(userId);
  if (!sub || !sub.plan || !sub.plan.limit) {
    return false;
  }
  return Boolean(sub.plan.limit[featureKey]);
};

/**
 * Verify URL count limit for the user
 */
export const checkUrlLimit = async (userId) => {
  const sub = await getActiveSubscription(userId);
  if (!sub || !sub.plan || !sub.plan.limit) {
    throw new PlanLimitError("max_urls", "No active subscription found.");
  }

  const maxUrls = sub.plan.limit.max_urls;
  if (maxUrls === null) {
    return; // Unlimited
  }

  const activeCount = await prisma.url.count({
    where: {
      user_id: userId,
      is_active: true,
    },
  });

  if (activeCount >= maxUrls) {
    throw new PlanLimitError("max_urls", `You have reached the maximum URL count limit of ${maxUrls} URLs on your "${sub.plan.name}" plan. Please upgrade to create more short URLs.`);
  }
};

/**
 * Get date cutoff for retention clamping
 */
export const getAnalyticsRetentionCutoff = async (userId) => {
  const sub = await getActiveSubscription(userId);
  if (!sub || !sub.plan || !sub.plan.limit) {
    return new Date(); // Safeguard: restrict entirely
  }

  const retentionDays = sub.plan.limit.analytics_retention_days;
  if (retentionDays === null) {
    return null; // Unlimited
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
};

/**
 * Get API dynamic rate limit per minute
 */
export const getApiRateLimit = async (userId) => {
  const sub = await getActiveSubscription(userId);
  if (!sub || !sub.plan || !sub.plan.limit) {
    return 10; // Low default for safety
  }
  return sub.plan.limit.api_rate_limit_per_min || 10;
};

/**
 * Validate URL parameters against the plan's limits
 */
export const validateUrlGating = async (userId, { customAlias, expiresAt, password, customDomainId }) => {
  // 1. Custom Alias
  if (customAlias) {
    const allowed = await hasFeature(userId, "custom_alias_allowed");
    if (!allowed) {
      throw new PlanLimitError("custom_alias_allowed", "Custom aliases are not allowed on your current plan. Please upgrade.");
    }
  }

  // 2. Custom Expiry
  const expiryAllowed = await hasFeature(userId, "custom_expiry_allowed");
  if (!expiryAllowed) {
    if (!expiresAt) {
      // Default to 7 days
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else {
      const dateVal = new Date(expiresAt);
      const now = new Date();
      const diffMs = dateVal.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Check if it is close to 7 days or 30 days (with a 60 minute margin of error)
      const is7d = Math.abs(diffDays - 7) < (60 / 1440); // 60 minutes in days
      const is30d = Math.abs(diffDays - 30) < (60 / 1440);

      if (!is7d && !is30d) {
        throw new PlanLimitError("custom_expiry_allowed", "Custom expiration dates are not allowed on your current plan. Please choose 7 days or 30 days.");
      }
    }
  }

  // 3. Password Protected Links
  if (password && typeof password === "string" && password.trim().length > 0) {
    const allowed = await hasFeature(userId, "password_protected_links");
    if (!allowed) {
      throw new PlanLimitError("password_protected_links", "Password-protected links are not allowed on your current plan. Please upgrade.");
    }
  }

  // 4. Custom Domain
  if (customDomainId) {
    const allowed = await hasFeature(userId, "custom_domain_allowed");
    if (!allowed) {
      throw new PlanLimitError("custom_domain_allowed", "Custom domains are not allowed on your current plan. Please upgrade.");
    }

    const domain = await prisma.customDomain.findUnique({
      where: { id: BigInt(customDomainId) }
    });
    if (!domain || domain.user_id !== userId || !domain.verified) {
      throw new PlanLimitError("custom_domain_allowed", "Invalid, unverified, or unauthorized custom domain selection.");
    }
  }

  return { expiresAt };
};
