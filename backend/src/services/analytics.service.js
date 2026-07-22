import { PrismaClient } from "../generated/prisma/index.js";
import { getRedisClient, isRedisReady } from "../config/redisClient.js";

const prisma = new PrismaClient();

// Helper to convert BigInts to numbers recursively (safe up to 9 quadrillion)
const serialize = (obj) => {
  if (obj === null || obj === undefined) return obj;
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
const parseRange = (range) => {
  const end = new Date();
  let start = new Date();
  
  if (range === "24h") {
    start.setHours(end.getHours() - 24);
  } else if (range === "7d") {
    start.setDate(end.getDate() - 7);
  } else if (range === "30d") {
    start.setDate(end.getDate() - 30);
  } else {
    // Default to 7 days
    start.setDate(end.getDate() - 7);
  }
  return { start, end };
};

// 1. Overview stats: total, unique, bot clicks + growth comparison
export const getUrlOverview = async (urlId, range = "7d") => {
  const redis = getRedisClient();
  const cacheKey = `dash_cache:${urlId}:overview:${range}`;

  // Check cache
  if (isRedisReady()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.error("Cache read error in analytics overview:", err.message);
    }
  }

  const { start, end } = parseRange(range);
  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);

  const urlBigIntId = BigInt(urlId);

  // Get current period rollups from UrlStatsDaily
  const currentDailyStats = await prisma.urlStatsDaily.aggregate({
    _sum: {
      total_clicks: true,
      unique_clicks: true,
      bot_clicks: true,
    },
    where: {
      url_id: urlBigIntId,
      bucket_date: {
        gte: start,
        lte: end,
      },
    },
  });

  // Get previous period rollups for growth comparison
  const previousDailyStats = await prisma.urlStatsDaily.aggregate({
    _sum: {
      total_clicks: true,
      unique_clicks: true,
      bot_clicks: true,
    },
    where: {
      url_id: urlBigIntId,
      bucket_date: {
        gte: prevStart,
        lt: start,
      },
    },
  });

  const total = currentDailyStats._sum.total_clicks || 0;
  const unique = currentDailyStats._sum.unique_clicks || 0;
  const bot = currentDailyStats._sum.bot_clicks || 0;

  const prevTotal = previousDailyStats._sum.total_clicks || 0;
  const prevUnique = previousDailyStats._sum.unique_clicks || 0;

  // Calculate Growth percentages
  const totalGrowth = prevTotal === 0 ? (total > 0 ? 100 : 0) : ((total - prevTotal) / prevTotal) * 100;
  const uniqueGrowth = prevUnique === 0 ? (unique > 0 ? 100 : 0) : ((unique - prevUnique) / prevUnique) * 100;

  // Query live click volume in the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const liveClicksCount = await prisma.click.count({
    where: {
      url_id: urlBigIntId,
      clicked_at: {
        gte: fifteenMinutesAgo,
      },
    },
  });

  const recentClicks = await prisma.click.findMany({
    where: {
      url_id: urlBigIntId,
    },
    select: {
      country: true,
      device_type: true,
      clicked_at: true,
    },
    orderBy: {
      clicked_at: "desc",
    },
    take: 10,
  });

  const result = serialize({
    totalClicks: total,
    uniqueClicks: unique,
    botClicks: bot,
    liveClicks: liveClicksCount,
    recentClicks: recentClicks.map(rc => ({
      country: rc.country || "Unknown",
      device: rc.device_type || "desktop",
      timestamp: rc.clicked_at.toISOString(),
    })),
    growth: {
      total: Math.round(totalGrowth * 10) / 10,
      unique: Math.round(uniqueGrowth * 10) / 10,
    },
  });

  // Save to cache (2 mins TTL)
  if (isRedisReady()) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), "EX", 120);
    } catch (err) {
      console.error("Cache write error in analytics overview:", err.message);
    }
  }

  return result;
};

// 2. Time-series chart: hourly or daily logs
export const getUrlTimeseries = async (urlId, range = "7d") => {
  const { start, end } = parseRange(range);
  const urlBigIntId = BigInt(urlId);

  let data = [];

  if (range === "24h") {
    // Fetch hourly rollup bucket stats
    const hourly = await prisma.urlStatsHourly.findMany({
      where: {
        url_id: urlBigIntId,
        bucket_start: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { bucket_start: "asc" },
    });

    data = hourly.map(h => ({
      label: new Date(h.bucket_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      clicks: h.total_clicks,
      unique: h.unique_clicks,
      bots: h.bot_clicks,
    }));
  } else {
    // Fetch daily rollup bucket stats
    const daily = await prisma.urlStatsDaily.findMany({
      where: {
        url_id: urlBigIntId,
        bucket_date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { bucket_date: "asc" },
    });

    data = daily.map(d => ({
      label: new Date(d.bucket_date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      clicks: d.total_clicks,
      unique: d.unique_clicks,
      bots: d.bot_clicks,
    }));
  }

  return serialize(data);
};

// 3. Location breakdown (from raw clicks in range)
export const getUrlGeo = async (urlId, range = "7d") => {
  const { start, end } = parseRange(range);
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
export const getUrlDevices = async (urlId, range = "7d") => {
  const { start, end } = parseRange(range);
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
export const getUrlReferrers = async (urlId, range = "7d") => {
  const { start, end } = parseRange(range);
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
export const exportClicksToCsv = async (urlId, range = "30d") => {
  const { start, end } = parseRange(range);
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
