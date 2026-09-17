import crypto from "crypto";
import { getRedisClient, isRedisReady } from "../../config/redisClient.js";

const memoryStore = new Map();

/**
 * Computes a deterministic hash for an action and its arguments
 * @param {string} userId
 * @param {string} action
 * @param {Object} payload
 * @returns {string}
 */
const computeFingerprint = (userId, action, payload = {}) => {
  const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = crypto.createHash("sha256").update(`${userId}:${action}:${sortedPayload}`).digest("hex");
  return `mcp:idempotency:${hash}`;
};

/**
 * Checks if an identical operation has been recently completed
 * @param {string} userId
 * @param {string} action
 * @param {Object} payload
 * @returns {Promise<Object|null>}
 */
export const checkIdempotency = async (userId, action, payload) => {
  const key = computeFingerprint(userId, action, payload);

  try {
    if (isRedisReady()) {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } else {
      const cached = memoryStore.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }
  } catch (err) {
    console.error("[MCP Idempotency] Check error:", err.message);
  }

  return null;
};

/**
 * Caches the result of a completed write operation for idempotency
 * @param {string} userId
 * @param {string} action
 * @param {Object} payload
 * @param {Object} result
 * @param {number} [ttlSeconds=60]
 */
export const saveIdempotency = async (userId, action, payload, result, ttlSeconds = 60) => {
  const key = computeFingerprint(userId, action, payload);

  try {
    if (isRedisReady()) {
      const redis = getRedisClient();
      await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
    } else {
      memoryStore.set(key, {
        data: result,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      // Purge old memory entries periodically
      if (memoryStore.size > 1000) {
        const now = Date.now();
        for (const [k, v] of memoryStore.entries()) {
          if (v.expiresAt <= now) memoryStore.delete(k);
        }
      }
    }
  } catch (err) {
    console.error("[MCP Idempotency] Save error:", err.message);
  }
};
