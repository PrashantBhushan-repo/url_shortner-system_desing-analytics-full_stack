import express from "express";

import {
  createShortUrl,
  fetchUrlStats,
} from "../controllers/url.controller.js";

import { validateCreateUrl } from "../middlewares/validate.middleware.js";
import { validateShortCodeParam } from "../middlewares/validateShortCode.middleware.js";
import { createUrlLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/", createUrlLimiter, validateCreateUrl, createShortUrl);

router.get("/:shortCode", validateShortCodeParam, fetchUrlStats);

export default router;
