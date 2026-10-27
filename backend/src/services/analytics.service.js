import { analyticsWindow, fillTimeBuckets } from "../utils/analyticsWindow.js";
import { observePrismaQuery } from '../telemetry/database.js';
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient({ log: [{ level: 'query', emit: 'event' }] });
prisma.$on?.('query', observePrismaQuery);

// Helper to convert BigInts to numbers recursively (safe up to 9 quadrillion)
const serialize = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(serialize);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serialize(value)])
    );
  }
  return obj;
};

// Parse date range into start/end dates
const parseRange = analyticsWindow;

// Raw events make rolling windows accurate, including partial days and today's activity.
export const getUrlOverview = async (urlId, range = "7d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const prevStart = new Date(Math.max(start.getTime() - (end - start), cutoff ? new Date(cutoff).getTime() : 0));
  const id = BigInt(urlId);
  const [rows, liveClicks, recentClicks] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*) FILTER (WHERE clicked_at >= ${start}) AS total,
        COUNT(DISTINCT visitor_id) FILTER (WHERE clicked_at >= ${start} AND NOT is_bot) AS unique,
        COUNT(*) FILTER (WHERE clicked_at >= ${start} AND is_bot) AS bot,
        COUNT(*) FILTER (WHERE clicked_at < ${start}) AS previous,
        COUNT(DISTINCT visitor_id) FILTER (WHERE clicked_at < ${start} AND NOT is_bot) AS previous_unique,
        COUNT(*) FILTER (WHERE clicked_at >= ${start} AND is_qr_scan) AS scans
      FROM "Click" WHERE url_id = ${id} AND clicked_at >= ${prevStart} AND clicked_at <= ${end}
    `,
    prisma.click.count({ where: { url_id: id, clicked_at: { gte: new Date(Math.max(end - 900000, cutoff ? new Date(cutoff).getTime() : 0)), lte: end } } }),
    prisma.click.findMany({ where: { url_id: id, clicked_at: { gte: start, lte: end } }, select: { country: true, device_type: true, clicked_at: true }, orderBy: { clicked_at: "desc" }, take: 10 }),
  ]);
  const row = rows[0] || {};
  const total = Number(row.total || 0), unique = Number(row.unique || 0);
  const growth = (value, previous) => Number(previous) ? Math.round((value - Number(previous)) / Number(previous) * 1000) / 10 : null;
  return { totalClicks: total, uniqueClicks: unique, botClicks: Number(row.bot || 0), qrScans: Number(row.scans || 0), liveClicks, recentClicks: recentClicks.map(click => ({ country: click.country || "Unknown", device: click.device_type || "Unknown", timestamp: click.clicked_at.toISOString() })), growth: { total: growth(total, row.previous || 0), unique: growth(unique, row.previous_unique || 0) }, period: { start: start.toISOString(), end: end.toISOString() } };
};

export const getUrlTimeseries = async (urlId, range = "7d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const unit = range === "24h" ? "hour" : "day";
  const rows = await prisma.$queryRaw`
    SELECT date_trunc(${unit}, clicked_at) AS bucket,
      COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) FILTER (WHERE NOT is_bot) AS unique,
      COUNT(*) FILTER (WHERE is_bot) AS bots
    FROM "Click" WHERE url_id = ${BigInt(urlId)} AND clicked_at >= ${start} AND clicked_at <= ${end}
    GROUP BY bucket ORDER BY bucket
  `;
  return fillTimeBuckets(rows, range, start, end);
};

// 3. Location breakdown (from raw clicks in range)
export const getUrlGeo = async (urlId, range = "7d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const urlBigIntId = BigInt(urlId);

  const countries = await prisma.click.groupBy({
    by: ["country"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const cities = await prisma.click.groupBy({
    by: ["city", "country"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  return serialize({
    countries: countries.map(c => ({ country: c.country, count: c._count.id })),
    cities: cities.map(c => ({ city: c.city, country: c.country, count: c._count.id })),
  });
};

// 4. Device and browser breakdown
export const getUrlDevices = async (urlId, range = "7d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const urlBigIntId = BigInt(urlId);

  const devices = await prisma.click.groupBy({
    by: ["device_type"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const browsers = await prisma.click.groupBy({
    by: ["browser"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  const platforms = await prisma.click.groupBy({
    by: ["operating_system"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  return serialize({
    devices: devices.map(d => ({ name: d.device_type || "Desktop", count: d._count.id })),
    browsers: browsers.map(b => ({ name: b.browser || "Unknown", count: b._count.id })),
    platforms: platforms.map(p => ({ name: p.operating_system || "Unknown", count: p._count.id })),
  });
};

// 5. Referrer and UTM breakdown
export const getUrlReferrers = async (urlId, range = "7d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const urlBigIntId = BigInt(urlId);

  const referrers = await prisma.click.groupBy({
    by: ["referer_host"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const siteLocations = await prisma.click.groupBy({
    by: ["referer_host", "country"],
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  });

  const utmSources = await prisma.click.groupBy({
    by: ["utm_source"],
    where: {
      url_id: urlBigIntId,
      utm_source: { not: null },
      clicked_at: { gte: start, lte: end },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return serialize({
    referrers: referrers.map(r => ({ host: r.referer_host || "Direct", count: r._count.id })),
    siteLocations: siteLocations.map(sl => ({
      site: sl.referer_host || "Direct",
      country: sl.country || "Unknown",
      count: sl._count.id
    })),
    sources: utmSources.map(s => ({ source: s.utm_source, count: s._count.id })),
  });
};

// 6. User account top links over the last 30 days
export const getUserTopLinks = async (userId, limit = 5) => {
  const start = new Date();
  start.setDate(start.getDate() - 30); // 30 day range

  const urls = await prisma.url.findMany({
    where: {
      user_id: userId,
      is_active: true,
    },
    include: {
      stats_daily: {
        where: { bucket_date: { gte: start } },
        select: { total_clicks: true, unique_clicks: true },
      },
    },
  });

  const aggregated = urls.map(url => {
    const totalClicks = url.stats_daily.reduce((sum, s) => sum + s.total_clicks, 0);
    const uniqueClicks = url.stats_daily.reduce((sum, s) => sum + s.unique_clicks, 0);
    return {
      id: url.id.toString(),
      shortCode: url.short_code,
      longUrl: url.long_url,
      isAlive: url.is_alive ?? true,
      totalClicks,
      uniqueClicks,
    };
  });

  // Sort descending by total clicks
  aggregated.sort((a, b) => b.totalClicks - a.totalClicks);

  return serialize(aggregated.slice(0, limit));
};

// 7. Stream clicks as CSV format
export const exportClicksToCsv = async (urlId, range = "30d", cutoff = null) => {
  const { start, end } = parseRange(range, cutoff);
  const urlBigIntId = BigInt(urlId);

  const clicks = await prisma.click.findMany({
    where: {
      url_id: urlBigIntId,
      clicked_at: { gte: start, lte: end },
    },
    orderBy: { clicked_at: "desc" },
    select: {
      clicked_at: true,
      ip_address: true,
      country: true,
      city: true,
      browser: true,
      operating_system: true,
      device_type: true,
      referrer: true,
      is_bot: true,
      is_unique: true,
    },
  });

  let csvContent = "Timestamp,IP Address,Country,City,Browser,OS,Device Type,Referrer,Is Bot,Is Unique\n";
  clicks.forEach(c => {
    const line = [
      c.clicked_at.toISOString(),
      c.ip_address || "Unknown",
      c.country || "Unknown",
      c.city || "Unknown",
      c.browser || "Unknown",
      c.operating_system || "Unknown",
      c.device_type || "desktop",
      `"${(c.referrer || "Direct").replace(/"/g, '""')}"`,
      c.is_bot ? "TRUE" : "FALSE",
      c.is_unique ? "TRUE" : "FALSE",
    ].join(",");
    csvContent += line + "\n";
  });

  return csvContent;
};

// 8. Platform wide global statistics (Admin-only)
export const getPlatformGlobalStats = async () => {
  const totalUrls = await prisma.url.count();
  const activeUrls = await prisma.url.count({ where: { is_active: true } });
  
  const dailyRollups = await prisma.urlStatsDaily.aggregate({
    _sum: {
      total_clicks: true,
      unique_clicks: true,
      bot_clicks: true,
    },
  });

  const totalClicks = dailyRollups._sum.total_clicks || 0;
  const uniqueClicks = dailyRollups._sum.unique_clicks || 0;
  const botClicks = dailyRollups._sum.bot_clicks || 0;

  return serialize({
    totalUrls,
    activeUrls,
    totalClicks,
    uniqueClicks,
    botClicks,
  });
};
