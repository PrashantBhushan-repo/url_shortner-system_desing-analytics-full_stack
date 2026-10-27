import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { config } from "../config/config.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { recordCacheHit, recordCacheMiss } from "../telemetry/metrics.js";

const CACHE_PREFIX = "short:";
const tracer = trace.getTracer("pburls-cache");

export const getCachedUrl = async (shortCode) => {
  if (!isRedisReady()) {
    return null;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  return tracer.startActiveSpan(
    "cache.get",
    {
      attributes: {
        "db.system": "redis",
        "cache.key": cacheKey,
        "cache.operation": "GET",
      },
    },
    async (span) => {
      try {
        const cached = await redis.get(cacheKey);
        const hit = Boolean(cached);
        span.setAttribute("cache.hit", hit);
        span.setStatus({ code: SpanStatusCode.OK });

        if (hit) {
          recordCacheHit("url_cache");
        } else {
          recordCacheMiss("url_cache");
        }

        if (!cached) return null;
        try {
          return JSON.parse(cached);
        } catch {
          return { id: null, longUrl: cached };
        }
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        console.error("Redis GET error:", error.message);
        return null;
      } finally {
        span.end();
      }
    }
  );
};

export const setCachedUrl = async (shortCode, urlData, ttl = config.cacheTtl) => {
  if (!isRedisReady()) {
    return;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  return tracer.startActiveSpan(
    "cache.set",
    {
      attributes: {
        "db.system": "redis",
        "cache.key": cacheKey,
        "cache.operation": "SET",
        "cache.ttl": ttl,
      },
    },
    async (span) => {
      try {
        const dataString = typeof urlData === "object" ? JSON.stringify(urlData) : JSON.stringify({ id: null, longUrl: urlData });
        await redis.set(cacheKey, dataString, "EX", ttl);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        console.error("Redis SET error:", error.message);
      } finally {
        span.end();
      }
    }
  );
};

export const invalidateCache = async (shortCode) => {
  if (!isRedisReady()) {
    return;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  return tracer.startActiveSpan(
    "cache.del",
    {
      attributes: {
        "db.system": "redis",
        "cache.key": cacheKey,
        "cache.operation": "DEL",
      },
    },
    async (span) => {
      try {
        await redis.del(cacheKey);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        console.error("Redis DEL error:", error.message);
      } finally {
        span.end();
      }
    }
  );
};
