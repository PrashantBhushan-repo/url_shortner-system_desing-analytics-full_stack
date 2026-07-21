import { analyticsQueue } from "./queue.js";

export const enqueueClickEvent = (payload) => {
  analyticsQueue.add("click-event", payload, {
    jobId: `${payload.urlId}:${payload.timestamp}:${payload.sessionId || "anon"}`,
    removeOnComplete: true,
    removeOnFail: false,
  }).catch((error) => {
    console.error("Failed to enqueue analytics job", error);
  });
};
