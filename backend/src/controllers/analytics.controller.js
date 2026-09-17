import prisma from "../config/prismaClient.js";
import { AppError } from "../utils/AppError.js";
import {
  getUrlOverview,
  getUrlTimeseries,
  getUrlGeo,
  getUrlDevices,
  getUrlReferrers,
  getUserTopLinks,
  exportClicksToCsv,
  getPlatformGlobalStats,
} from "../services/analytics.service.js";
import { getAnalyticsRetentionCutoff } from "../services/planLimitService.js";
import { traceAnalytics } from "../telemetry/businessSpans.js";

// Helper to verify that the URL belongs to the authenticated user (or user is ADMIN)
const checkOwnership = async (urlId, user) => {
  if (!urlId) {
    throw new AppError("URL ID is required", 400);
  }
  
  if (user.role === "ADMIN") return;

  const url = await prisma.url.findUnique({
    where: { id: BigInt(urlId) },
  });

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (url.user_id !== user.id) {
    throw new AppError("Unauthorized access to this URL's analytics", 403);
  }
};

export const fetchOverview = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query; // '24h', '7d', '30d'
    const data = await traceAnalytics({ operation: "overview", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return getUrlOverview(urlId, range, cutoff);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchTimeseries = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    const data = await traceAnalytics({ operation: "timeseries", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return getUrlTimeseries(urlId, range, cutoff);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchGeo = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    const data = await traceAnalytics({ operation: "geo", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return getUrlGeo(urlId, range, cutoff);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchDevices = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    const data = await traceAnalytics({ operation: "devices", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return getUrlDevices(urlId, range, cutoff);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchReferrers = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    const data = await traceAnalytics({ operation: "referrers", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return getUrlReferrers(urlId, range, cutoff);
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchAccountTopLinks = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
    const data = await traceAnalytics({ operation: "top_links" }, async () => getUserTopLinks(req.user.id, limit));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const exportClicks = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    const csvData = await traceAnalytics({ operation: "export", urlId }, async () => {
      await checkOwnership(urlId, req.user);
      const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
      return exportClicksToCsv(urlId, range, cutoff);
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=clicks-export-${urlId}.csv`);
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

export const fetchPlatformStats = async (req, res, next) => {
  try {
    // Only admins allowed (double checked)
    if (req.user.role !== "ADMIN") {
      throw new AppError("Admin resource. Access denied.", 403);
    }

    const data = await traceAnalytics({ operation: "platform_stats" }, async () => getPlatformGlobalStats());
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
