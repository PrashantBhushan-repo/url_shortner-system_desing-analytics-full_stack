import prisma from "../config/prismaClient.js";
import crypto from "crypto";
import { AppError } from "../utils/AppError.js";

/**
 * Generate a new API key (SHA-256 hashed in database, shown once in plaintext)
 */
export const generateApiKey = async (req, res, next) => {
  try {
    const { label } = req.body;

    const rawKey = `snap_${crypto.randomBytes(24).toString("hex")}`;
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: {
        user_id: req.user.id,
        key_hash: hash,
        label: label || "Unnamed API Key",
      },
    });

    res.status(201).json({
      success: true,
      apiKey: rawKey, // Render only once
      data: {
        id: apiKey.id,
        label: apiKey.label,
        createdAt: apiKey.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List active API keys belonging to the authenticated user
 */
export const listApiKeys = async (req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: {
        user_id: req.user.id,
        revoked: false,
      },
      select: {
        id: true,
        label: true,
        last_used_at: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: keys,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Revoke an API key (soft delete)
 */
export const revokeApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;

    const key = await prisma.apiKey.findFirst({
      where: {
        id,
        user_id: req.user.id,
      },
    });

    if (!key) {
      throw new AppError("API key not found", 404);
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revoked: true },
    });

    res.status(200).json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (err) {
    next(err);
  }
};
