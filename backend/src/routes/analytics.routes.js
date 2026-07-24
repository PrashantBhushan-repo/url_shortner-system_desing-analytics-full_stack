import express from "express";
import {
  fetchOverview,
  fetchTimeseries,
  fetchGeo,
  fetchDevices,
  fetchReferrers,
  fetchAccountTopLinks,
  exportClicks,
  fetchPlatformStats,
} from "../controllers/analytics.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

import { requireFeature } from "../middlewares/planLimit.middleware.js";

const router = express.Router();

// Apply auth middleware to protect all analytics routes
router.use(authMiddleware);

router.get("/account/top-links", fetchAccountTopLinks);
router.get("/platform", fetchPlatformStats); // Additional verification in controller check

router.get("/:urlId/overview", fetchOverview);
router.get("/:urlId/timeseries", fetchTimeseries);
router.get("/:urlId/geo", requireFeature("geo_analytics"), fetchGeo);
router.get("/:urlId/devices", requireFeature("device_browser_analytics"), fetchDevices);
router.get("/:urlId/referrers", fetchReferrers);
router.get("/:urlId/export", requireFeature("csv_export"), exportClicks);

export default router;
