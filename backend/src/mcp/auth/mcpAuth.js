import crypto from "crypto";
import prisma from "../../config/prismaClient.js";
import { hasFeature } from "../../services/planLimitService.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Validate an API key and return the associated user and plan permissions
 * @param {string} rawKey - The plaintext API key (e.g. "snap_...")
 * @returns {Promise<{ user: { id: string, email: string, role: string, name: string }, keyId: string }>}
 */
export const authenticateApiKey = async (rawKey) => {
  if (!rawKey || typeof rawKey !== "string") {
    throw new AppError("API key is required. Provide a valid 'snap_...' key.", 401);
  }

  const cleanKey = rawKey.startsWith("Bearer ") ? rawKey.slice(7).trim() : rawKey.trim();
  const hash = crypto.createHash("sha256").update(cleanKey).digest("hex");

  const keyRecord = await prisma.apiKey.findFirst({
    where: {
      key_hash: hash,
      revoked: false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!keyRecord || !keyRecord.user) {
    throw new AppError("Invalid or revoked API key.", 401);
  }

  if (keyRecord.user.status !== "ACTIVE") {
    throw new AppError(`User account is ${keyRecord.user.status.toLowerCase()}. Access denied.`, 403);
  }

  const userId = keyRecord.user.id;

  // Check if user's plan allows API access
  const hasAccess = await hasFeature(userId, "api_access");
  if (!hasAccess) {
    throw new AppError(
      "API & MCP access is not enabled on your current subscription plan. Please upgrade.",
      403
    );
  }

  // Update last_used_at timestamp asynchronously
  prisma.apiKey
    .update({
      where: { id: keyRecord.id },
      data: { last_used_at: new Date() },
    })
    .catch((err) => console.error("Failed to update API key last_used_at:", err.message));

  return {
    user: keyRecord.user,
    keyId: keyRecord.id,
    label: keyRecord.label,
  };
};
