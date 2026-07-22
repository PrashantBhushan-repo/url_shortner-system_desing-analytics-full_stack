import {
  shortenUrl,
  getOriginalUrl,
  getUrlStats,
  deactivateShortUrl,
  updateShortUrl as updateShortUrlService,
  listUserUrls,
  getUrlHealthStatus,
  getUrlById,
} from "../services/url.service.js";
import { addClickJob } from "../queues/clickQueue.js";
import { normalizeIpAddress } from "../utils/location.js";

export const createShortUrl = async (req, res, next) => {
  try {
    const { longUrl, customAlias, expiresAt } = req.body;
    const result = await shortenUrl(longUrl, customAlias, expiresAt, req.user);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const redirectUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { id: urlId, longUrl } = await getOriginalUrl(shortCode);

    res.redirect(302, longUrl);

    // Queue click ingestion asynchronously (non-blocking)
    const forwardedIps = req.headers["x-forwarded-for"]?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    const realIp = req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.headers["true-client-ip"] || forwardedIps[0] || req.socket.remoteAddress || req.ip || "unknown";
    const ip = normalizeIpAddress(realIp) || "unknown";
    const userAgent = req.headers["user-agent"] || "";
    const referrer = req.headers["referer"] || "";
    const sessionId = req.cookies?.session_id || "";
    const isQrScan = req.query.qr === "true";

    if (urlId) {
      addClickJob({
        urlId,
        ip,
        userAgent,
        referrer,
        sessionId,
        isQrScan,
        timestamp: new Date().toISOString(),
      }).catch((err) => {
        console.error("Failed to enqueue click job:", err.message);
      });
    }
  } catch (error) {
    next(error);
  }
};

export const fetchUrlStats = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const stats = await getUrlStats(shortCode, req.user);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const updateShortUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const result = await updateShortUrlService(shortCode, req.body, req.user);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteShortUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const result = await deactivateShortUrl(shortCode, req.user);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const fetchUserUrls = async (req, res, next) => {
  try {
    const urls = await listUserUrls(req.user);

    res.status(200).json({
      success: true,
      data: urls,
    });
  } catch (error) {
    next(error);
  }
};

export const fetchUrlHealth = async (req, res, next) => {
  try {
    const { id } = req.params;
    const url = await getUrlHealthStatus(id);
    res.status(200).json({
      success: true,
      data: url,
    });
  } catch (error) {
    next(error);
  }
};

export const fetchUrlById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const url = await getUrlById(id, req.user);
    res.status(200).json({
      success: true,
      data: url,
    });
  } catch (error) {
    next(error);
  }
};
