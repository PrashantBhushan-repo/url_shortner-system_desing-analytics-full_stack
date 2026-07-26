import crypto from "crypto";
import prisma from "../config/prismaClient.js";
import { hasFeature } from "../services/planLimitService.js";
import { AppError } from "../utils/AppError.js";

/**
 * Middleware to authenticate requests via API Key header
 */
export const apiKeyAuthMiddleware = async (req, res, next) => {
  try {
    const rawKey = req.headers["x-api-key"] || 
      (req.headers.authorization?.startsWith("Bearer snap_") ? req.headers.authorization.slice(7) : null);

    if (!rawKey) {
      return next(new AppError("API key required (use x-api-key header or Bearer auth)", 401));
    }

    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        key_hash: hash,
        revoked: false,
      },
      include: {
        user: true,
      },
    });

    if (!keyRecord || !keyRecord.user) {
      return next(new AppError("Invalid or revoked API key", 401));
    }

    const userId = keyRecord.user.id;

    // Check if the user's plan has API access allowed
    const hasAccess = await hasFeature(userId, "api_access");
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        code: "PLAN_LIMIT",
        feature: "api_access",
        message: "API access is not available on your current plan. Please upgrade.",
      });
    }

    // Attach user profile to request
    req.user = {
      id: userId,
      email: keyRecord.user.email,
      role: keyRecord.user.role,
    };
    req.apiKeyHash = hash;

    // Asynchronously update last used timestamp
    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { last_used_at: new Date() },
    }).catch(err => console.error("Failed to update API key last used time:", err.message));

    next();
  } catch (err) {
    next(err);
  }
};
export default apiKeyAuthMiddleware;
