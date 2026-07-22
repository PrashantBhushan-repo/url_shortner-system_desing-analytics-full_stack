import { Worker, Queue } from "bullmq";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { initRedis, getRedisClient } from "../src/config/redisClient.js";
import { queueConnectionOptions } from "../src/queues/clickQueue.js";

const prisma = new PrismaClient();

// Helper to build a stable visitor fingerprint based on session, IP, and User Agent
const getVisitorKey = (visitorId, sessionId, ip, ua) => {
  if (visitorId) {
    return `cookie:${visitorId}`;
  }
  if (sessionId) {
    return `session:${sessionId}`;
  }
  return `ipua:${ip || "unknown"}:${ua || "unknown"}`;
};

const getVisitorId = (visitorKey) => {
  return crypto.createHash("sha256").update(visitorKey).digest("hex");
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
  
  // 1. Parse User Agent & Device Type
  const uaParser = new UAParser(userAgent);
  const parsedUa = uaParser.getResult();
  const device = parsedUa.device || {};
  const browser = parsedUa.browser || {};
  const os = parsedUa.os || {};

  let deviceType = device.type || "desktop";
  let browserName = browser.name || "Unknown";
  let osName = os.name || "Unknown";

  if (userAgent) {
    const uaLower = userAgent.toLowerCase();
    
    // Check for API clients / CLIs / Dev tools
    if (uaLower.includes("postman") || uaLower.includes("postmanruntime")) {
      deviceType = "Postman";
      browserName = "Postman Client";
      osName = osName !== "Unknown" ? osName : "API Environment";
    } else if (uaLower.includes("curl")) {
      deviceType = "CLI Client";
      browserName = "curl";
    } else if (uaLower.includes("wget")) {
      deviceType = "CLI Client";
      browserName = "wget";
    } else if (uaLower.includes("http")) {
      if (uaLower.includes("python-requests")) {
        deviceType = "CLI Client";
        browserName = "Python Requests";
      } else if (uaLower.includes("axios") || uaLower.includes("node-fetch")) {
        deviceType = "API Client";
        browserName = "Node.js App";
      }
    }
    
    // Map standard mobile/tablet devices
    if (deviceType === "mobile") {
      deviceType = "smartphone";
    } else if (deviceType === "tablet") {
      deviceType = "tablet";
    } else if (deviceType === "desktop") {
      if (uaLower.includes("ipad")) {
        deviceType = "tablet";
      } else if (uaLower.includes("iphone") || (uaLower.includes("android") && !uaLower.includes("tablet"))) {
        deviceType = "smartphone";
      }
    }
  }

  // 2. Parse GeoIP Location
  let geo = geoip.lookup(ip) || {};

  // If local or private IP, try fetching public IP location as a fallback for local testing
  if (!geo.country || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.includes("127.0.0.1")) {
    try {
      const response = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        if (data && data.country_code && !data.error) {
          geo = {
            country: data.country_code || "Unknown",
            region: data.region_code || "Unknown",
            city: data.city || "Unknown",
            ll: [data.latitude, data.longitude],
            timezone: data.timezone || "Unknown"
          };
          console.log(`[GeoIP] Resolved local IP fallback to public location: ${geo.city}, ${geo.country}`);
        } else {
          throw new Error(data?.reason || "Invalid location payload");
        }
      } else {
        throw new Error(`HTTP status ${response.status}`);
      }
    } catch (err) {
      console.warn("[GeoIP] Fallback GeoIP fetch failed, defaulting to Nagpur:", err.message);
      // Fallback default for local testing (Nagpur, Maharashtra, India)
      geo = {
        country: "IN",
        region: "MH",
        city: "Nagpur",
        ll: [21.1458, 79.0882],
        timezone: "Asia/Kolkata"
      };
    }
  }

  // 3. Bot Detection Heuristics (Exclude API clients if intended for dev testing, but count rate limit if needed)
  const isUaBot = isUserAgentBot(userAgent, parsedUa);
  const isRateBot = await checkRateLimitBot(redis, ip, urlId);
  const isBot = isUaBot || isRateBot;

  // 4. Calculate Unique Visitor status (Daily HyperLogLog in Redis)
  const visitorKey = getVisitorKey(job.data.visitorId, sessionId, ip, userAgent);
  const visitorId = getVisitorId(visitorKey);
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

  // Parse Referrer Host and Map to friendly names
  let referrerHost = "Direct";
  if (referrer && referrer !== "Direct") {
    try {
      const parsedUrl = new URL(referrer);
      const hostLower = parsedUrl.hostname.toLowerCase();
      if (hostLower.includes("instagram.com")) {
        referrerHost = "Instagram";
      } else if (hostLower.includes("linkedin.com") || hostLower.includes("lnkd.in")) {
        referrerHost = "LinkedIn";
      } else if (hostLower.includes("twitter.com") || hostLower.includes("t.co") || hostLower.includes("x.com")) {
        referrerHost = "Twitter/X";
      } else if (hostLower.includes("facebook.com") || hostLower.includes("fb.com") || hostLower.includes("messenger.com")) {
        referrerHost = "Facebook";
      } else if (hostLower.includes("reddit.com")) {
        referrerHost = "Reddit";
      } else if (hostLower.includes("youtube.com") || hostLower.includes("youtu.be")) {
        referrerHost = "YouTube";
      } else if (hostLower.includes("google.com")) {
        referrerHost = "Google Search";
      } else if (hostLower.includes("naukri.com")) {
        referrerHost = "Naukri";
      } else if (hostLower.includes("yahoo.com")) {
        referrerHost = "Yahoo";
      } else if (hostLower.includes("bing.com")) {
        referrerHost = "Bing";
      } else if (hostLower.includes("github.com")) {
        referrerHost = "GitHub";
      } else if (hostLower.includes("pinterest.com")) {
        referrerHost = "Pinterest";
      } else if (hostLower.includes("quora.com")) {
        referrerHost = "Quora";
      } else if (hostLower.includes("whatsapp.com") || hostLower.includes("wa.me")) {
        referrerHost = "WhatsApp";
      } else if (hostLower.includes("telegram.org") || hostLower.includes("t.me")) {
        referrerHost = "Telegram";
      } else if (hostLower.includes("slack.com")) {
        referrerHost = "Slack";
      } else {
        let hostname = parsedUrl.hostname;
        if (hostname.startsWith("www.")) {
          hostname = hostname.substring(4);
        }
        referrerHost = hostname;
      }
    } catch {
      referrerHost = "Unknown";
    }
  } else {
    // If no referrer, check if it's an API/CLI client UA and classify under that client name
    const uaLower = userAgent ? userAgent.toLowerCase() : "";
    if (uaLower.includes("postman") || uaLower.includes("postmanruntime")) {
      referrerHost = "Postman";
    } else if (uaLower.includes("curl")) {
      referrerHost = "curl";
    } else if (uaLower.includes("wget")) {
      referrerHost = "wget";
    } else if (uaLower.includes("python-requests")) {
      referrerHost = "Python Requests";
    } else if (uaLower.includes("axios") || uaLower.includes("node-fetch")) {
      referrerHost = "Node.js API";
    } else {
      referrerHost = "Direct";
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
      browser: browserName,
      browser_version: browser.version || "Unknown",
      operating_system: osName,
      os_version: os.version || "Unknown",
      device_type: deviceType,
      device_name: device.model || "Unknown",
      platform: osName,
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
  if (deviceType) hourlyUpdate.top_device = deviceType;

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
      top_device: deviceType,
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
  if (deviceType) dailyUpdate.top_device = deviceType;

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
      top_device: deviceType,
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
    device: deviceType,
    timestamp: clickTime.toISOString(),
  };
  try {
    await redis.publish(wsChannel, JSON.stringify(tickPayload));
  } catch (err) {
    console.error("Redis publish error:", err.message);
  }

  // 9. Invalidate cached dashboard overview stats for this URL to ensure real-time updates
  try {
    const keys = await redis.keys(`dash_cache:${urlId}:overview:*`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[Cache] Invalidated ${keys.length} overview cache keys for URL ${urlId}`);
    }
  } catch (err) {
    console.error("Cache invalidation error:", err.message);
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

// Health Check Repeater Task (processes URLs concurrently in chunks of 5 to avoid blocking/stalling)
const processHealthCheck = async () => {
  console.log("Checking URLs health...");
  const urls = await prisma.url.findMany({
    where: { is_active: true },
  });

  const chunkSize = 5;
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (url) => {
        try {
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
        } catch (err) {
          console.error(`Error checking health for URL ID ${url.id}:`, err.message);
        }
      })
    );
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

  // 2. Health Check Worker (configured with 2 mins lock duration to prevent stalls)
  const healthWorker = new Worker("health-queue", processHealthCheck, {
    connection: queueConnectionOptions,
    lockDuration: 120000,
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
