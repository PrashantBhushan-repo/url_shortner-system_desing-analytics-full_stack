import {
  shortenUrl,
  getOriginalUrl,
  getUrlStats,
  deactivateShortUrl,
  updateShortUrl as updateShortUrlService,
  listUserUrls,
  getUrlHealthStatus,
  getUrlById,
  generateUrlQrCode,
} from "../services/url.service.js";
import { addClickJob } from "../queues/clickQueue.js";
import { normalizeIpAddress } from "../utils/location.js";
import { randomUUID } from "crypto";
import { config } from "../config/config.js";
import bcrypt from "bcrypt";
import prisma from "../config/prismaClient.js";
import { getRedisClient } from "../config/redisClient.js";
import { getActiveSubscription } from "../services/planLimitService.js";
import { PlanLimitError } from "../utils/AppError.js";
import { traceRedirect } from "../telemetry/businessSpans.js";

export const createShortUrl = async (req, res, next) => {
  try {
    const { longUrl, customAlias, expiresAt, password, customDomainId } = req.body;
    const result = await shortenUrl(longUrl, customAlias, expiresAt, req.user, password, customDomainId);

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
    const urlData = await traceRedirect(
      {
        shortCode,
        customDomain: Boolean(req.headers.host && !req.headers.host.includes("localhost")),
      },
      async (span) => {
        const data = await getOriginalUrl(shortCode);
        if (data?.longUrl) span.setAttribute("url.target_url", data.longUrl);
        if (data?.id) span.setAttribute("url.id", String(data.id));
        if (typeof data?.isCacheHit === "boolean") span.setAttribute("redirect.cache_hit", data.isCacheHit);
        return data;
      }
    );

    const { id: urlId, longUrl, passwordHash } = urlData;


    if (passwordHash) {
      const providedPassword = req.query.password;
      let isMatch = false;
      if (providedPassword) {
        isMatch = await bcrypt.compare(providedPassword, passwordHash);
      }
      if (!isMatch) {
        return res.redirect(`${config.clientUrl}/p/${shortCode}${providedPassword ? "?error=true" : ""}`);
      }
    }

    const forwardedIps = req.headers["x-forwarded-for"]?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    const realIp = req.headers["x-real-ip"] || req.headers["cf-connecting-ip"] || req.headers["true-client-ip"] || forwardedIps[0] || req.socket.remoteAddress || req.ip || "unknown";
    const ip = normalizeIpAddress(realIp) || "unknown";
    const userAgent = req.headers["user-agent"] || "";
    const referrer = req.headers["referer"] || "";
    const sessionId = req.cookies?.session_id || "";
    const isQrScan = req.query.qr === "true" || req.query.qr === "1" || req.query.src === "qr";

    if (urlId) {
      const existingVisitorId = req.cookies?.visitor_id;
      const visitorId = existingVisitorId || randomUUID();

      if (!existingVisitorId) {
        res.cookie("visitor_id", visitorId, {
          httpOnly: true,
          sameSite: "lax",
          secure: config.nodeEnv === "production",
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        });
      }

      addClickJob({
        urlId: urlId.toString(),
        ip,
        userAgent,
        referrer,
        sessionId,
        visitorId,
        isQrScan,
        timestamp: new Date().toISOString(),
      }).catch((err) => {
        console.error("Failed to enqueue click job:", err.message);
      });
    }

    res.redirect(302, longUrl);
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

export const getUrlQrCode = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const qrCodeDataUrl = await generateUrlQrCode(shortCode, req.user);
    res.status(200).json({
      success: true,
      qrCodeDataUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const createBulkShortUrls = async (req, res, next) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new AppError("Invalid payload. Expected non-empty urls array.", 400);
    }

    const userId = req.user.id;
    // Count active URLs
    const activeCount = await prisma.url.count({
      where: { user_id: userId, is_active: true }
    });

    const sub = await getActiveSubscription(userId);
    if (!sub || !sub.plan || !sub.plan.limit) {
      throw new AppError("No active subscription found.", 403);
    }

    const maxUrls = sub.plan.limit.max_urls;
    // Reject entire batch if adding it would exceed user limit to keep data consistent.
    if (maxUrls !== null && activeCount + urls.length > maxUrls) {
      throw new PlanLimitError("max_urls", `Creating this batch of ${urls.length} URLs would exceed your plan limit of ${maxUrls} URLs (current: ${activeCount}). Batch rejected.`);
    }

    const results = [];
    for (const item of urls) {
      const { longUrl, customAlias, expiresAt, password, customDomainId } = item;
      const result = await shortenUrl(longUrl, customAlias, expiresAt, req.user, password, customDomainId);
      results.push(result);
    }

    res.status(201).json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

export const fetchPublicStats = async (req, res, next) => {
  try {
    const startDb = performance.now();
    const [totalUrls, activeUrls, totalClicks, uniqueClicks, qrScans] = await Promise.all([
      prisma.url.count(),
      prisma.url.count({ where: { is_active: true } }),
      prisma.click.count(),
      prisma.click.count({ where: { is_unique: true } }),
      prisma.click.count({ where: { is_qr_scan: true } }),
    ]);
    const dbLatencyMs = Math.max(0.5, parseFloat((performance.now() - startDb).toFixed(2)));

    let redisOk = false;
    let redisLatencyMs = 0.8;
    try {
      const redis = getRedisClient();
      if (redis) {
        const startRedis = performance.now();
        await redis.ping();
        redisLatencyMs = Math.max(0.3, parseFloat((performance.now() - startRedis).toFixed(2)));
        redisOk = true;
      }
    } catch {
      redisOk = false;
    }

    // Top locations from real click records
    const topCountriesGroup = await prisma.click.groupBy({
      by: ["country"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    // Top referrers from real click records
    const topReferrersGroup = await prisma.click.groupBy({
      by: ["referer_host"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    // Device breakdown
    const devicesGroup = await prisma.click.groupBy({
      by: ["device_type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Real pricing plans from database
    const plans = await prisma.plan.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        price_monthly: true,
        price_quarterly: true,
        price_yearly: true,
        currency: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalUrls,
        activeUrls,
        totalClicks,
        uniqueClicks,
        qrScans,
        dbStatus: "ONLINE",
        redisStatus: redisOk ? "ONLINE" : "STANDBY",
        dbLatencyMs,
        redisLatencyMs,
        meanLatencyMs: parseFloat(((dbLatencyMs + redisLatencyMs) / 2).toFixed(2)),
        topCountries: topCountriesGroup.map((c) => ({
          name: c.country || "Unknown",
          count: c._count.id,
        })),
        topReferrers: topReferrersGroup.map((r) => ({
          name: r.referer_host || "Direct",
          count: r._count.id,
        })),
        devices: devicesGroup.map((d) => ({
          name: d.device_type || "Desktop",
          count: d._count.id,
        })),
        plans,
      },
    });
  } catch (error) {
    next(error);
  }
};

