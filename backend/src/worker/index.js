import { Worker } from "bullmq";
import { config } from "../config/config.js";
import prisma from "../config/prismaClient.js";
import { getRedisClient } from "../config/redisClient.js";
import { UAParser } from "ua-parser-js";
import { randomUUID } from "crypto";
import { resolveGeoLocation } from "../src/utils/location.js";

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: Number(new URL(config.redisUrl).port || 6379),
  password: new URL(config.redisUrl).password || undefined,
  username: new URL(config.redisUrl).username || undefined,
};

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /curl/i,
  /wget/i,
  /headlesschrome/i,
  /fetch/i,
  /python-requests/i,
];

const normalize = (value) => (typeof value === "string" ? value.trim() : "");

const detectBot = async ({ userAgent, ip, urlId }) => {
  const parser = new UAParser(userAgent || "");
  const ua = parser.getResult();
  const isUaBot = Boolean(ua.device?.type === "bot") || BOT_PATTERNS.some((pattern) => pattern.test(userAgent || ""));

  const client = getRedisClient();
  if (!client) {
    return isUaBot;
  }

  const rateKey = `rate:${ip}:${urlId}`;
  const currentCount = Number(await client.incr(rateKey));
  await client.expire(rateKey, 60);

  return isUaBot || currentCount > 8;
};

const upsertRollup = async ({ tx, urlId, timestamp, country, referrer, device, isBot }) => {
  const now = new Date(timestamp);
  const hourBucket = new Date(Math.floor(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
  const dayBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const hourKey = `rt_clicks:${urlId}:${Math.floor(hourBucket.getTime() / (60 * 1000))}`;
  const client = getRedisClient();
  if (client) {
    await client.incr(hourKey);
    await client.expire(hourKey, 10 * 60);
  }

  const visitorId = randomUUID();
  const hllKey = `hll:${urlId}:${dayBucket.toISOString().slice(0, 10)}`;
  if (client) {
    await client.pfadd(hllKey, visitorId);
  }

  const hourly = await tx.urlStatsHourly.upsert({
    where: { url_id_bucket_start: { url_id: Number(urlId), bucket_start: hourBucket } },
    update: {
      total_clicks: { increment: 1 },
      unique_clicks: { increment: 1 },
      bot_clicks: isBot ? { increment: 1 } : undefined,
      top_country: country || undefined,
      top_referrer: referrer || undefined,
      top_device: device || undefined,
    },
    create: {
      url_id: Number(urlId),
      bucket_start: hourBucket,
      total_clicks: 1,
      unique_clicks: 1,
      bot_clicks: isBot ? 1 : 0,
      top_country: country || undefined,
      top_referrer: referrer || undefined,
      top_device: device || undefined,
    },
  });

  const daily = await tx.urlStatsDaily.upsert({
    where: { url_id_bucket_date: { url_id: Number(urlId), bucket_date: dayBucket } },
    update: {
      total_clicks: { increment: 1 },
      unique_clicks: { increment: 1 },
      bot_clicks: isBot ? { increment: 1 } : undefined,
      top_country: country || undefined,
      top_referrer: referrer || undefined,
      top_device: device || undefined,
    },
    create: {
      url_id: Number(urlId),
      bucket_date: dayBucket,
      total_clicks: 1,
      unique_clicks: 1,
      bot_clicks: isBot ? 1 : 0,
      top_country: country || undefined,
      top_referrer: referrer || undefined,
      top_device: device || undefined,
    },
  });

  void hourly;
  void daily;
};

const processHealthChecks = async () => {
  const urls = await prisma.url.findMany({ select: { id: true, long_url: true, health_check_failures: true, is_alive: true } });
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url.long_url, { method: "HEAD", signal: controller.signal, redirect: "manual" });
      clearTimeout(timeout);
      const succeeded = response.ok || response.status < 500;
      await prisma.url.update({
        where: { id: url.id },
        data: {
          is_alive: succeeded,
          health_check_failures: succeeded ? 0 : (url.health_check_failures ?? 0) + 1,
          last_checked_at: new Date(),
        },
      });
    } catch {
      await prisma.url.update({
        where: { id: url.id },
        data: {
          is_alive: false,
          health_check_failures: (url.health_check_failures ?? 0) + 1,
          last_checked_at: new Date(),
        },
      });
    }
  }
};

const worker = new Worker("analytics", async (job) => {
  if (job.name === "health-check") {
    await processHealthChecks();
    return;
  }

  const { urlId, ip, userAgent, referrer, timestamp, sessionId } = job.data;

  const isBot = await detectBot({ userAgent, ip, urlId });
  const geo = await resolveGeoLocation(ip);
  const ua = new UAParser(userAgent || "").getResult();

  const clickPayload = {
    url_id: Number(urlId),
    visitor_id: randomUUID(),
    ip_address: ip || null,
    clicked_at: new Date(timestamp || Date.now()),
    browser: normalize(ua.browser?.name),
    browser_version: normalize(ua.browser?.version),
    operating_system: normalize(ua.os?.name),
    os_version: normalize(ua.os?.version),
    device_type: normalize(ua.device?.type),
    device_name: normalize(ua.device?.model),
    platform: normalize(ua.os?.name),
    user_agent: normalize(userAgent),
    country: geo?.country ? normalize(geo.country) : null,
    state: geo?.region ? normalize(geo.region) : null,
    city: geo?.city ? normalize(geo.city) : null,
    latitude: geo?.ll?.[0] ?? null,
    longitude: geo?.ll?.[1] ?? null,
    timezone: null,
    referrer: normalize(referrer),
    referer_host: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    is_qr_scan: false,
    is_unique: true,
    is_bot: Boolean(isBot),
    session_id: normalize(sessionId),
    language: null,
    screen_resolution: null,
    network_type: null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.click.create({
      data: {
        ...clickPayload,
        url: { connect: { id: BigInt(urlId) } },
      },
    });
    await upsertRollup({
      tx,
      urlId,
      timestamp: clickPayload.clicked_at,
      country: clickPayload.country,
      referrer: clickPayload.referrer,
      device: clickPayload.device_type || clickPayload.browser || "unknown",
      isBot: Boolean(isBot),
    });
  });

  const client = getRedisClient();
  if (client) {
    await client.publish(`ws:url:${urlId}`, JSON.stringify({
      urlId,
      country: clickPayload.country,
      device: clickPayload.device_type || clickPayload.browser || "unknown",
      timestamp: clickPayload.clicked_at.toISOString(),
    }));
  }
}, {
  connection,
  autorun: true,
});

worker.on("completed", (job) => {
  console.log(`Analytics job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`Analytics job failed: ${job?.id}`, err);
});

const queue = new (await import("bullmq")).Queue("analytics", { connection });
queue.add("health-check", {}, { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: "health-check-schedule" }).catch((error) => {
  console.error("Failed to schedule health checks", error);
});

console.log("Analytics worker started");
