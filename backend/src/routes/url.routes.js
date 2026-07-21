import express from "express";

import {
  createShortUrl,
  fetchUrlStats,
  deleteShortUrl,
  updateShortUrl,
  fetchUserUrls,
  fetchUrlHealth,
  fetchUrlById,
} from "../controllers/url.controller.js";

import { validateCreateUrl, validateUpdateUrl } from "../middlewares/validate.middleware.js";
import { validateShortCodeParam } from "../middlewares/validateShortCode.middleware.js";
import { createUrlLimiter } from "../middlewares/rateLimit.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/me", authMiddleware, fetchUserUrls);
router.post("/", createUrlLimiter, validateCreateUrl, authMiddleware, createShortUrl);
router.get("/:id/health", authMiddleware, fetchUrlHealth);
router.get("/id/:id", authMiddleware, fetchUrlById);
router.get("/:shortCode", validateShortCodeParam, authMiddleware, fetchUrlStats);
router.patch("/:shortCode", validateShortCodeParam, validateUpdateUrl, authMiddleware, updateShortUrl);
router.put("/:shortCode", validateShortCodeParam, validateUpdateUrl, authMiddleware, updateShortUrl);
router.delete("/:shortCode", validateShortCodeParam, authMiddleware, deleteShortUrl);

export default router;
