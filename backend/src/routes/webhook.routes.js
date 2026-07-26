import express from "express";
import { createWebhook, listWebhooks, deleteWebhook } from "../controllers/webhook.controller.js";
import { authMiddleware, requireOwnership } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/planLimit.middleware.js";
import prisma from "../config/prismaClient.js";

const router = express.Router();

// Webhook endpoints require authentication and plan level webhook access
router.use(authMiddleware);
router.use(requireFeature("webhooks_allowed"));

router.post("/", createWebhook);
router.get("/", listWebhooks);
router.delete("/:id", requireOwnership("Webhook", async (req) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  return webhook?.user_id;
}), deleteWebhook);

export default router;

