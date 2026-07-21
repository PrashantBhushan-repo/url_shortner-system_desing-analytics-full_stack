import express from "express";
import prisma from "../config/prismaClient.js";
import { authorize } from "../middlewares/auth.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getRedisClient } from "../config/redisClient.js";

const router = express.Router();

const resolveUrlId = async (req) => {
  const rawValue = req.params.urlId || req.params.id;
  const shortCode = String(rawValue);
  const url = await prisma.url.findFirst({
    where: {
      OR: [{ short_code: shortCode }, { id: Number.isNaN(Number(shortCode)) ? undefined : Number(shortCode) }],
    },
    select: { id: true, user_id: true },
  });

  if (!url) {
    return null;
  }

  if (req.user?.role !== "ADMIN" && url.user_id && req.user?.id && url.user_id !== req.user.id) {
    return null;
  }

  return url.id;
};

router.get("/:urlId/overview", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }

    const [hourlyRows, dailyRows, urlMeta, clicks] = await Promise.all([
      prisma.urlStatsHourly.findMany({ where: { url_id: Number(urlId) }, orderBy: { bucket_start: "asc" } }),
      prisma.urlStatsDaily.findMany({ where: { url_id: Number(urlId) }, orderBy: { bucket_date: "asc" } }),
      prisma.url.findUnique({
        where: { id: Number(urlId) },
        select: { short_code: true, is_alive: true, last_checked_at: true, health_check_failures: true },
      }),
      prisma.click.findMany({
        where: { url_id: Number(urlId) },
        select: {
          id: true,
          country: true,
          device_type: true,
          browser: true,
          operating_system: true,
          referrer: true,
          clicked_at: true,
          is_bot: true,
        },
        orderBy: { clicked_at: "desc" },
        take: 300,
      }),
    ]);

    const total = dailyRows.reduce((sum, row) => sum + (row.total_clicks || 0), 0);
    const unique = dailyRows.reduce((sum, row) => sum + (row.unique_clicks || 0), 0);
    const bot = dailyRows.reduce((sum, row) => sum + (row.bot_clicks || 0), 0);

    const toBreakdown = (field, fallback = "Unknown") => Object.entries(
      clicks.reduce((acc, row) => {
        const value = row[field] || fallback;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return res.json({
      success: true,
      data: {
        total,
        unique,
        bot,
        hourlyRows,
        dailyRows,
        recentClicks: clicks.slice(0, 10),
        geoBreakdown: toBreakdown("country"),
        deviceBreakdown: toBreakdown("device_type"),
        referrerBreakdown: toBreakdown("referrer"),
        health: {
          shortCode: urlMeta?.short_code || null,
          isAlive: urlMeta?.is_alive ?? true,
          lastCheckedAt: urlMeta?.last_checked_at ?? null,
          healthCheckFailures: urlMeta?.health_check_failures ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:urlId/timeseries", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }
    const { range = "24h" } = req.query;
    const rows = range === "24h"
      ? await prisma.urlStatsHourly.findMany({ where: { url_id: Number(urlId) }, orderBy: { bucket_start: "asc" } })
      : await prisma.urlStatsDaily.findMany({ where: { url_id: Number(urlId) }, orderBy: { bucket_date: "asc" } });
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:urlId/geo", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }
    const rows = await prisma.click.findMany({
      where: { url_id: Number(urlId) },
      select: { country: true, city: true },
      orderBy: { clicked_at: "desc" },
      take: 100,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:urlId/devices", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }
    const rows = await prisma.click.findMany({
      where: { url_id: Number(urlId) },
      select: { device_type: true, browser: true, operating_system: true },
      orderBy: { clicked_at: "desc" },
      take: 100,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:urlId/referrers", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }
    const rows = await prisma.click.findMany({
      where: { url_id: Number(urlId) },
      select: { referrer: true, utm_source: true, utm_medium: true, utm_campaign: true },
      orderBy: { clicked_at: "desc" },
      take: 100,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/account/top-links", authMiddleware, async (req, res, next) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT u.id, u.short_code, u.long_url, s.total_clicks, s.bucket_date
      FROM "Url" u
      LEFT JOIN "UrlStatsDaily" s ON s.url_id = u.id
      WHERE u.user_id = $1
      ORDER BY s.total_clicks DESC NULLS LAST
      LIMIT 10
    `, req.user.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:urlId/export", authMiddleware, async (req, res, next) => {
  try {
    const urlId = await resolveUrlId(req);
    if (!urlId) {
      return res.status(404).json({ success: false, message: "URL not found" });
    }
    const rows = await prisma.click.findMany({
      where: { url_id: Number(urlId) },
      orderBy: { clicked_at: "asc" },
    });
    const header = "id,url_id,country,device_type,browser,referrer,clicked_at\n";
    const csv = rows.map((row) => `${row.id},${row.url_id},${row.country || ""},${row.device_type || ""},${row.browser || ""},${row.referrer || ""},${row.clicked_at.toISOString()}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    return res.send(header + csv);
  } catch (error) {
    next(error);
  }
});

router.get("/admin/platform", authMiddleware, authorize("ADMIN"), async (req, res, next) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total_urls FROM "Url"
    `);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
