import { Queue } from "bullmq";
import { config } from "../config/config.js";

let redisHost = "127.0.0.1";
let redisPort = 6379;

try {
  const parsed = new URL(config.redisUrl);
  redisHost = parsed.hostname;
  redisPort = parseInt(parsed.port, 10) || 6379;
} catch (e) {
  console.error("Failed to parse REDIS_URL, using localhost:6379 fallback:", e.message);
}

export const queueConnectionOptions = {
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
};

export const clickQueue = new Queue("click-queue", {
  connection: queueConnectionOptions,
});

export const addClickJob = async (data) => {
  await clickQueue.add("click-event", data, {
    removeOnComplete: { maxCount: 1000 },
    removeOnFail: { maxCount: 1000 },
  });
};
