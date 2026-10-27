import express from "express";
import { parseUrlId } from "../utils/urlAccess.js";
import {
  fetchOverview,
  fetchTimeseries,
  fetchGeo,
  fetchLocations,
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
router.param("urlId", (req, res, next, id) => { try { parseUrlId(id); next(); } catch (error) { next(error); } });

router.get("/account/top-links", fetchAccountTopLinks);
router.get("/platform", fetchPlatformStats); // Additional verification in controller check

router.get("/:urlId/overview", fetchOverview);
router.get("/:urlId/timeseries", fetchTimeseries);
router.get("/:urlId/geo", requireFeature("geo_analytics"), fetchGeo);
router.get('/:urlId/locations', requireFeature('geo_analytics'), fetchLocations);
router.get('/:urlId/locations/detail', requireFeature('geo_analytics'), fetchLocations);
router.get("/:urlId/devices", requireFeature("device_browser_analytics"), fetchDevices);
router.get("/:urlId/referrers", fetchReferrers);
router.get("/:urlId/export", requireFeature("csv_export"), exportClicks);

export default router;
