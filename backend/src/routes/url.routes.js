import express from "express";

import {
  createShortUrl,
  fetchUrlStats,
  deleteShortUrl,
  updateShortUrl,
  fetchUserUrls,
  fetchUrlHealth,
  fetchUrlById,
  getUrlQrCode,
  createBulkShortUrls,
} from "../controllers/url.controller.js";

import { validateCreateUrl, validateUpdateUrl } from "../middlewares/validate.middleware.js";
import { validateShortCodeParam } from "../middlewares/validateShortCode.middleware.js";
import { createUrlLimiter } from "../middlewares/rateLimit.middleware.js";
import { authMiddleware, requireOwnership } from "../middlewares/auth.middleware.js";
import { enforceUrlLimit } from "../middlewares/planLimit.middleware.js";
import { requireFeature } from "../middlewares/planLimit.middleware.js";
import prisma from "../config/prismaClient.js";

const router = express.Router();

router.get("/me", authMiddleware, fetchUserUrls);
router.post("/bulk", authMiddleware, requireFeature("bulk_url_creation"), createBulkShortUrls);
router.post("/", authMiddleware, enforceUrlLimit, createUrlLimiter, validateCreateUrl, createShortUrl);

router.get("/:id/health", authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { id: BigInt(req.params.id) } });
  return url?.user_id;
}), fetchUrlHealth);

router.get("/id/:id", authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { id: BigInt(req.params.id) } });
  return url?.user_id;
}), fetchUrlById);

router.get("/:shortCode/qr", validateShortCodeParam, authMiddleware, requireFeature("qr_code_allowed"), requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { short_code: req.params.shortCode } });
  return url?.user_id;
}), getUrlQrCode);

router.get("/:shortCode", validateShortCodeParam, authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { short_code: req.params.shortCode } });
  return url?.user_id;
}), fetchUrlStats);

router.patch("/:shortCode", validateShortCodeParam, validateUpdateUrl, authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { short_code: req.params.shortCode } });
  return url?.user_id;
}), updateShortUrl);

router.put("/:shortCode", validateShortCodeParam, validateUpdateUrl, authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { short_code: req.params.shortCode } });
  return url?.user_id;
}), updateShortUrl);

router.delete("/:shortCode", validateShortCodeParam, authMiddleware, requireOwnership("Url", async (req) => {
  const url = await prisma.url.findUnique({ where: { short_code: req.params.shortCode } });
  return url?.user_id;
}), deleteShortUrl);

export default router;

