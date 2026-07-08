import Redis from "ioredis";
import { config } from "./config.js";

let redisClient = null;

export const getRedisClient = () => {
  if (!redisClient) {
    try {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      redisClient.on("error", (err) => {
        console.error("Redis connection error:", err.message);
      });

      redisClient.on("connect", () => {
        console.log("Redis connected successfully");
      });
    } catch (err) {
      console.error("Failed to create Redis client:", err.message);
      redisClient = null;
    }
  }

  return redisClient;
};

export const initRedis = async () => {
  const client = getRedisClient();
  if (!client) {
    console.warn("Redis unavailable — cache and rate limits will use in-memory fallback where applicable");
    return false;
  }

  if (client.status === "ready") {
    return true;
  }

  try {
    await client.connect();
    return true;
  } catch (err) {
    console.warn("Redis connection failed:", err.message);
    return false;
  }
};

export const closeRedisConnection = async () => {
  if (redisClient) {
    await redisClient.quit();  //Client disconnected normally  This is called a graceful shutdown.


    redisClient = null;
  }
};

export const isRedisReady = () => Boolean(redisClient && redisClient.status === "ready");
// boolean becz to convert if null to false and if ready to true