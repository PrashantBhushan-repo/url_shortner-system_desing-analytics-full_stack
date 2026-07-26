import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";

/**
 * Register a new webhook target
 */
export const createWebhook = async (req, res, next) => {
  try {
    const { targetUrl, event, secret } = req.body;

    if (!targetUrl || !event || !secret) {
      throw new AppError("targetUrl, event, and secret are required fields.", 400);
    }

    const webhook = await prisma.webhook.create({
      data: {
        user_id: req.user.id,
        target_url: targetUrl,
        event,
        secret,
      },
    });

    res.status(201).json({
      success: true,
      data: webhook,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List all active webhooks for the user
 */
export const listWebhooks = async (req, res, next) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        user_id: req.user.id,
        is_active: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: webhooks,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a webhook target (soft delete)
 */
export const deleteWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;

    const webhook = await prisma.webhook.findFirst({
      where: {
        id,
        user_id: req.user.id,
      },
    });

    if (!webhook) {
      throw new AppError("Webhook not found", 404);
    }

    await prisma.webhook.update({
      where: { id },
      data: { is_active: false },
    });

    res.status(200).json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
