import { Queue } from "bullmq";
import { config } from "../config/config.js";
import { injectTraceContext } from "../telemetry/bullmqTelemetry.js";
import { traceAnalytics } from "../telemetry/businessSpans.js";

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

clickQueue.on("error", (err) => {
  // Gracefully handle offline redis queue error
});

export const addClickJob = async (data) => {
  return traceAnalytics(
    { operation: "enqueue_click", eventType: "click", urlId: data?.urlId },
    async () => {
      const tracedData = injectTraceContext("click-queue", "click-event", data);
      await clickQueue.add("click-event", tracedData, {
        removeOnComplete: { maxCount: 1000 },
        removeOnFail: { maxCount: 1000 },
      });
    }
  );
};

