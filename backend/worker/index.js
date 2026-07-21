import { Worker, Queue } from "bullmq";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { initRedis, getRedisClient } from "../src/config/redisClient.js";
import { queueConnectionOptions } from "../src/queues/clickQueue.js";

const prisma = new PrismaClient();

// Helper to hash IP and User Agent to create a consistent visitor ID
const getVisitorId = (ip, ua) => {
  return crypto.createHash("sha256").update(`${ip || ""}-${ua || ""}`).digest("hex");
};

// Heuristic to check if a user-agent represents a search bot or crawler
const isUserAgentBot = (ua, parserResult) => {
  if (parserResult.device?.type === "bot") return true;
  const botRegex = /bot|crawl|spider|slurp|tracker|googlebot|bingbot|yandex|baidu|duckduckbot/i;
  return botRegex.test(ua);
};

// Rate-limiting check to spot spam bots (sliding window in Redis)
const checkRateLimitBot = async (redis, ip, urlId) => {
  const rateKey = `rate:${ip}:${urlId}`;
  try {
    const currentRate = await redis.incr(rateKey);
    if (currentRate === 1) {
      await redis.expire(rateKey, 10); // 10 second window
    }
    return currentRate > 10; // Flag as bot if more than 10 clicks in 10 seconds
  } catch (err) {
    console.error("Redis rate limit check error:", err.message);
    return false;
  }
};

// Worker job processor for Click Events
const processClickEvent = async (job) => {
  const { urlId, ip, userAgent, referrer, sessionId, isQrScan, timestamp } = job.data;
  
  const redis = getRedisClient();
  const clickTime = new Date(timestamp);
  
  // 1. Parse User Agent
  const uaParser = new UAParser(userAgent);
  const parsedUa = uaParser.getResult();
  const device = parsedUa.device || {};
  const browser = parsedUa.browser || {};
  const os = parsedUa.os || {};

  // 2. Parse GeoIP Location
  const geo = geoip.lookup(ip) || {};

  // 3. Bot Detection Heuristics
  const isUaBot = isUserAgentBot(userAgent, parsedUa);
  const isRateBot = await checkRateLimitBot(redis, ip, urlId);
  const isBot = isUaBot || isRateBot;

  // 4. Calculate Unique Visitor status (Daily HyperLogLog in Redis)
  const visitorId = getVisitorId(ip, userAgent);
  const dateBucketStr = clickTime.toISOString().split("T")[0]; // YYYY-MM-DD
  const hllKey = `hll:${urlId}:${dateBucketStr}`;
  
  let isUnique = false;
  try {
    const added = await redis.pfadd(hllKey, visitorId);
    if (added === 1) {
      isUnique = true;
      await redis.expire(hllKey, 86400 * 2); // 2 days TTL
    }
  } catch (err) {
    console.error("Redis HyperLogLog error:", err.message);
  }

  // Parse Referrer Host
  let referrerHost = "Direct";
  if (referrer) {
    try {
      referrerHost = new URL(referrer).hostname;
    } catch {
      referrerHost = "Unknown";
    }
  }

  // 5. Database Writes: Insert click record
  const urlBigIntId = BigInt(urlId);
  await prisma.click.create({
    data: {
      url_id: urlBigIntId,
      visitor_id: visitorId,
      ip_address: ip,
      clicked_at: clickTime,
      browser: browser.name || "Unknown",
      browser_version: browser.version || "Unknown",
      operating_system: os.name || "Unknown",
      os_version: os.version || "Unknown",
      device_type: device.type || "desktop",
      device_name: device.model || "Unknown",
      platform: os.name || "Unknown",
      user_agent: userAgent,
      country: geo.country || "Unknown",
      state: geo.region || "Unknown",
      city: geo.city || "Unknown",
      latitude: geo.ll?.[0] || null,
      longitude: geo.ll?.[1] || null,
      timezone: geo.timezone || "Unknown",
      referrer: referrer || "Direct",
      referer_host: referrerHost,
      is_qr_scan: isQrScan || false,
      is_unique: isUnique,
      is_bot: isBot,
      session_id: sessionId || null,
    },
  });

  // 6. Hourly & Daily Pre-Aggregated Rollups (Upserts)
  const bucketStart = new Date(clickTime);
  bucketStart.setUTCMinutes(0, 0, 0);
  bucketStart.setUTCMilliseconds(0);

  const bucketDate = new Date(clickTime);
  bucketDate.setUTCHours(0, 0, 0, 0);

  // Stats updates payload
  const incrementTotal = isBot ? 0 : 1;
  const incrementUnique = (!isBot && isUnique) ? 1 : 0;
  const incrementBot = isBot ? 1 : 0;

  // Hourly update
  const hourlyUpdate = {
    total_clicks: { increment: incrementTotal },
    unique_clicks: { increment: incrementUnique },
    bot_clicks: { increment: incrementBot },
  };
  if (geo.country && geo.country !== "Unknown") hourlyUpdate.top_country = geo.country;
  if (referrerHost && referrerHost !== "Direct" && referrerHost !== "Unknown") hourlyUpdate.top_referrer = referrerHost;
  if (device.type) hourlyUpdate.top_device = device.type;

  await prisma.urlStatsHourly.upsert({
    where: {
      url_id_bucket_start: {
        url_id: urlBigIntId,
        bucket_start: bucketStart,
      },
    },
    create: {
      url_id: urlBigIntId,
      bucket_start: bucketStart,
      total_clicks: incrementTotal,
      unique_clicks: incrementUnique,
      bot_clicks: incrementBot,
      top_country: geo.country || "Unknown",
      top_referrer: referrerHost,
      top_device: device.type || "desktop",
    },
    update: hourlyUpdate,
  });

  // Daily update
  const dailyUpdate = {
    total_clicks: { increment: incrementTotal },
    unique_clicks: { increment: incrementUnique },
    bot_clicks: { increment: incrementBot },
  };
  if (geo.country && geo.country !== "Unknown") dailyUpdate.top_country = geo.country;
  if (referrerHost && referrerHost !== "Direct" && referrerHost !== "Unknown") dailyUpdate.top_referrer = referrerHost;
  if (device.type) dailyUpdate.top_device = device.type;

  await prisma.urlStatsDaily.upsert({
    where: {
      url_id_bucket_date: {
        url_id: urlBigIntId,
        bucket_date: bucketDate,
      },
    },
    create: {
      url_id: urlBigIntId,
      bucket_date: bucketDate,
      total_clicks: incrementTotal,
      unique_clicks: incrementUnique,
      bot_clicks: incrementBot,
      top_country: geo.country || "Unknown",
      top_referrer: referrerHost,
      top_device: device.type || "desktop",
    },
    update: dailyUpdate,
  });

  // 7. Increment Real-time Minute Counter (10 min TTL)
  const minuteBucket = Math.floor(Date.now() / 60000);
  const rtKey = `rt_clicks:${urlId}:${minuteBucket}`;
  try {
    const currentRt = await redis.incr(rtKey);
    if (currentRt === 1) {
      await redis.expire(rtKey, 600); // 10 min TTL
    }
  } catch (err) {
    console.error("Redis real-time click count error:", err.message);
  }

  // 8. Publish Live Broadcast message to Redis
  const wsChannel = `ws:url:${urlId}`;
  const tickPayload = {
    urlId: urlId.toString(),
    country: geo.country || "Unknown",
    device: device.type || "desktop",
    timestamp: clickTime.toISOString(),
  };
  try {
    await redis.publish(wsChannel, JSON.stringify(tickPayload));
  } catch (err) {
    console.error("Redis publish error:", err.message);
  }
};

// URL Destination health check bot
const checkLinkHealth = async (longUrl) => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const res = await fetch(longUrl, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "SnapURL-Health-Bot/1.0" },
    });
    clearTimeout(id);
    return res.status >= 200 && res.status < 400;
  } catch {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(longUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "SnapURL-Health-Bot/1.0" },
      });
      clearTimeout(id);
      return res.status >= 200 && res.status < 400;
    } catch {
      return false;
    }
  }
};

// Health Check Repeater Task
const processHealthCheck = async () => {
  console.log("Checking URLs health...");
  const urls = await prisma.url.findMany({
    where: { is_active: true },
  });

  for (const url of urls) {
    const isAlive = await checkLinkHealth(url.long_url);
    const lastChecked = new Date();
    
    if (isAlive) {
      await prisma.url.update({
        where: { id: url.id },
        data: {
          is_alive: true,
          health_check_failures: 0,
          last_checked_at: lastChecked,
        },
      });
    } else {
      const newFailures = url.health_check_failures + 1;
      await prisma.url.update({
        where: { id: url.id },
        data: {
          health_check_failures: newFailures,
          is_alive: newFailures >= 3 ? false : url.is_alive,
          last_checked_at: lastChecked,
        },
      });
    }
  }
  console.log(`Processed health checks for ${urls.length} URLs.`);
};

// Start background worker
const startWorker = async () => {
  console.log("Starting background ingestion worker process...");
  
  const redisConnected = await initRedis();
  if (!redisConnected) {
    console.error("Failed to connect to Redis. Worker exiting.");
    process.exit(1);
  }

  // 1. Click Ingestion Worker
  const clickWorker = new Worker("click-queue", processClickEvent, {
    connection: queueConnectionOptions,
    concurrency: 5,
  });

  clickWorker.on("completed", (job) => {
    console.log(`✅ Click ingestion job completed: ${job.id}`);
  });

  clickWorker.on("failed", (job, err) => {
    console.error(`❌ Click ingestion job failed: ${job?.id}. Error: ${err.message}`);
  });

  // 2. Health Check Worker
  const healthWorker = new Worker("health-queue", processHealthCheck, {
    connection: queueConnectionOptions,
  });

  healthWorker.on("completed", () => {
    console.log("✅ Health check completed successfully");
  });

  healthWorker.on("failed", (job, err) => {
    console.error(`❌ Health check job failed: ${err.message}`);
  });

  // Schedule repeatable job
  const healthQueue = new Queue("health-queue", { connection: queueConnectionOptions });
  
  // Clean old repeatable triggers and insert freshly
  const repeatableJobs = await healthQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await healthQueue.removeRepeatableByKey(job.key);
  }

  // Run every 6 hours
  await healthQueue.add("health-check-job", {}, {
    repeat: {
      pattern: "0 */6 * * *",
    },
  });

  // Run once immediately on startup
  await healthQueue.add("health-check-job-startup", {});

  console.log("Background worker is active and listening for events.");
};

startWorker().catch((err) => {
  console.error("Background worker failed to start:", err);
  process.exit(1);
});
