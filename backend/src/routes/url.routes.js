import express from "express";

import {
  createShortUrl,
  fetchUrlStats,
  deleteShortUrl,
  updateShortUrl,
} from "../controllers/url.controller.js";

import { validateCreateUrl, validateUpdateUrl } from "../middlewares/validate.middleware.js";
import { validateShortCodeParam } from "../middlewares/validateShortCode.middleware.js";
import { createUrlLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/", createUrlLimiter, validateCreateUrl, createShortUrl);
router.get("/:shortCode", validateShortCodeParam, fetchUrlStats);
router.patch("/:shortCode", validateShortCodeParam, validateUpdateUrl, updateShortUrl);
router.put("/:shortCode", validateShortCodeParam, validateUpdateUrl, updateShortUrl);
router.delete("/:shortCode", validateShortCodeParam, deleteShortUrl);

export default router;
