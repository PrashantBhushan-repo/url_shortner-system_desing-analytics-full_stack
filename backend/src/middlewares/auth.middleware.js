import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/user.repository.js";
import { getJwtSecret } from "../utils/auth.utils.js";
import { AppError } from "../utils/AppError.js";
import prisma from "../config/prismaClient.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import bcrypt from "bcrypt";

// Deliberate scope decision: Do not build a full permission-matrix (Role-Permission tables).
// Two platform roles (USER/ADMIN) plus resource ownership plus team roles (OWNER/ADMIN/MEMBER) are sufficient.

const STATUS_CACHE_PREFIX = "status:";
const STATUS_CACHE_TTL = 300; // 5 minutes cache TTL

/**
 * Fetch and cache user status in Redis
 */
export const getUserStatusCached = async (userId) => {
  const cacheKey = `${STATUS_CACHE_PREFIX}${userId}`;
  const redis = getRedisClient();

  if (isRedisReady()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      console.error("Redis error fetching user status:", err.message);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user) {
    return null;
  }

  if (isRedisReady()) {
    try {
      await redis.set(cacheKey, user.status, "EX", STATUS_CACHE_TTL);
    } catch (err) {
      console.error("Redis error caching user status:", err.message);
    }
  }

  return user.status;
};

/**
 * Invalidate cached user status in Redis
 */
export const invalidateUserStatusCache = async (userId) => {
  if (isRedisReady()) {
    const redis = getRedisClient();
    try {
      await redis.del(`${STATUS_CACHE_PREFIX}${userId}`);
    } catch (err) {
      console.error("Redis error invalidating user status:", err.message);
    }
  }
};

/**
 * JWT Verification Middleware with status enforcement
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await findUserById(decoded.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      throw new AppError("Session expired. Please sign in again.", 401);
    }

    // Verify account status
    const status = await getUserStatusCached(user.id);
    if (!status) {
      throw new AppError("User account not found", 401);
    }

    if (status === "SUSPENDED") {
      throw new AppError("Account suspended. Please contact support.", 403, null, "ACCOUNT_SUSPENDED");
    }

    if (status === "BANNED") {
      throw new AppError("Account banned.", 403, null, "ACCOUNT_BANNED");
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }

    const error = new AppError(err.name === "TokenExpiredError" ? "Token expired" : "Invalid or expired token", 401);
    return next(error);
  }
};

/**
 * Platform Role Authorization Middleware
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden: You do not have permission to perform this action", 403));
    }
    next();
  };
};

/**
 * Generic Resource Ownership Middleware Factory
 */
export const requireOwnership = (resourceType, getOwnerId) => {
  return async (req, res, next) => {
    try {
      const ownerId = await getOwnerId(req);
      if (ownerId === undefined || ownerId === null) {
        // Return 404 to avoid leaking existence
        return next(new AppError(`${resourceType} not found`, 404));
      }

      if (ownerId === req.user.id || req.user.role === "ADMIN") {
        return next();
      }

      // Return 404 instead of 403 to prevent leaking existence
      return next(new AppError(`${resourceType} not found`, 404));
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 404) {
        return next(err);
      }
      return next(err);
    }
  };
};

/**
 * Team Membership/Role Verification Middleware
 */
export const requireTeamRole = (...teamRoles) => {
  return async (req, res, next) => {
    try {
      const teamId = req.params.teamId || req.body.teamId;
      if (!teamId) {
        return next(new AppError("Team ID is required", 400));
      }

      // Explicitly name platformRole and teamRole to avoid confusion
      const platformRole = req.user.role;

      const member = await prisma.teamMember.findUnique({
        where: {
          team_id_user_id: {
            team_id: teamId,
            user_id: req.user.id,
          },
        },
      });

      if (!member || member.status !== "ACCEPTED") {
        return next(new AppError("Forbidden: You do not belong to this team", 403));
      }

      const teamRole = member.role;

      if (!teamRoles.includes(teamRole)) {
        return next(new AppError("Forbidden: You do not have the required team role", 403));
      }

      req.teamMember = member;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Admin Action Audit Logging Wrapper Middleware
 */
export const auditAdminAction = (action, targetType, getTargetId) => {
  return (handler) => {
    return async (req, res, next) => {
      const originalJson = res.json;
      let responseBody = null;
      res.json = function (body) {
        responseBody = body;
        return originalJson.apply(this, arguments);
      };

      try {
        await handler(req, res, next);

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const adminId = req.user.id;
          const targetId = await getTargetId(req, responseBody);
          const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
          const metadata = req.auditMetadata || {};

          await prisma.adminAuditLog.create({
            data: {
              admin_id: adminId,
              action,
              target_type: targetType,
              target_id: String(targetId),
              metadata,
              ip: typeof ip === "string" ? ip : Array.isArray(ip) ? ip[0] : null,
            },
          });
        }
      } catch (err) {
        next(err);
      }
    };
  };
};

/**
 * Admin Password Step-Up Confirmation Middleware
 */
export const requireStepUpConfirmation = async (req, res, next) => {
  try {
    const { adminPassword } = req.body;
    if (!adminPassword) {
      throw new AppError("Admin password confirmation required for this action", 401, null, "PASSWORD_REQUIRED");
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!adminUser) {
      throw new AppError("Admin user not found", 401);
    }

    const isMatch = await bcrypt.compare(adminPassword, adminUser.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid admin password", 401, null, "INVALID_PASSWORD");
    }

    next();
  } catch (err) {
    next(err);
  }
};
