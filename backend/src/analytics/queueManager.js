import { analyticsQueue } from "./queue.js";
import { injectTraceContext } from "../telemetry/bullmqTelemetry.js";

export const enqueueClickEvent = (payload) => {
  const tracedPayload = injectTraceContext("analytics", "click-event", payload);
  analyticsQueue.add("click-event", tracedPayload, {
    jobId: `${payload.urlId}:${payload.timestamp}:${payload.sessionId || "anon"}`,
    removeOnComplete: true,
    removeOnFail: false,
  }).catch((error) => {
    console.error("Failed to enqueue analytics job", error);
  });
};
