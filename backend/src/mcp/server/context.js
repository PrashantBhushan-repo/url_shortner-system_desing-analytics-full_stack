import crypto from "crypto";
import { getActiveSubscription, hasFeature } from "../../services/planLimitService.js";

/**
 * Immutable Server-Side UserContext for the MCP Gateway
 */
export class UserContext {
  /**
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.email
   * @param {string} params.name
   * @param {"USER"|"ADMIN"} params.role
   * @param {string} params.planKey
   * @param {Object} params.planLimits
   * @param {"stdio"|"sse"} params.clientType
   */
  constructor({ userId, email, name, role, planKey, planLimits, clientType }) {
    this.userId = String(userId);
    this.email = email || "";
    this.name = name || "";
    this.role = role || "USER";
    this.plan = {
      key: planKey || "FREE",
      limits: planLimits || {},
    };
    this.clientType = clientType || "stdio";
    this.requestId = crypto.randomUUID();
    this.timestamp = new Date().toISOString();

    // Freeze instance to guarantee immutability
    Object.freeze(this);
    Object.freeze(this.plan);
  }

  /**
   * Checks if user has access to a specific enterprise feature
   * @param {string} featureKey
   * @returns {Promise<boolean>}
   */
  async checkFeature(featureKey) {
    if (this.role === "ADMIN") return true;
    return await hasFeature(this.userId, featureKey);
  }

  /**
   * Create a child request context with a unique request ID
   * @returns {UserContext}
   */
  cloneWithNewRequestId() {
    return new UserContext({
      userId: this.userId,
      email: this.email,
      name: this.name,
      role: this.role,
      planKey: this.plan.key,
      planLimits: this.plan.limits,
      clientType: this.clientType,
    });
  }
}

/**
 * Builds an authenticated UserContext from database records
 * @param {Object} user - User record from Prisma
 * @param {"stdio"|"sse"} [clientType="stdio"]
 * @returns {Promise<UserContext>}
 */
export const buildUserContext = async (user, clientType = "stdio") => {
  if (!user || !user.id) {
    throw new Error("Cannot build UserContext without an authenticated user.");
  }

  const sub = await getActiveSubscription(user.id);
  const planLimits = sub?.plan?.limit || {};
  const planKey = sub?.plan?.key || user.plan || "FREE";

  return new UserContext({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    planKey,
    planLimits,
    clientType,
  });
};
