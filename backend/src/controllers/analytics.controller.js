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
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const data = await getUrlOverview(urlId, range, cutoff);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchTimeseries = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const data = await getUrlTimeseries(urlId, range, cutoff);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchGeo = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const data = await getUrlGeo(urlId, range, cutoff);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchDevices = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const data = await getUrlDevices(urlId, range, cutoff);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchReferrers = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const data = await getUrlReferrers(urlId, range, cutoff);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const fetchAccountTopLinks = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
    const data = await getUserTopLinks(req.user.id, limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const exportClicks = async (req, res, next) => {
  try {
    const { urlId } = req.params;
    const { range } = req.query;
    await checkOwnership(urlId, req.user);

    const cutoff = await getAnalyticsRetentionCutoff(req.user.id);
    const csvData = await exportClicksToCsv(urlId, range, cutoff);
    
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

    const data = await getPlatformGlobalStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
