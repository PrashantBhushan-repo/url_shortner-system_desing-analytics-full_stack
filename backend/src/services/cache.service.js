import { getRedisClient, isRedisReady } from "../config/redisClient.js";
import { config } from "../config/config.js";

const CACHE_PREFIX = "short:";

export const getCachedUrl = async (shortCode) => {
  if (!isRedisReady()) {
    return null;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  try {
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch {
      return { id: null, longUrl: cached };
    }
  } catch (error) {
    console.error("Redis GET error:", error.message);
    return null;
  }
};

export const setCachedUrl = async (shortCode, urlData, ttl = config.cacheTtl) => {
  if (!isRedisReady()) {
    return;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  try {
    const dataString = typeof urlData === "object" ? JSON.stringify(urlData) : JSON.stringify({ id: null, longUrl: urlData });
    await redis.set(cacheKey, dataString, "EX", ttl);
  } catch (error) {
    console.error("Redis SET error:", error.message);
  }
};

export const invalidateCache = async (shortCode) => {
  if (!isRedisReady()) {
    return;
  }

  const redis = getRedisClient();
  const cacheKey = `${CACHE_PREFIX}${shortCode}`;

  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.error("Redis DEL error:", error.message);
  }
};
