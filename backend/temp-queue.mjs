import { Queue } from "bullmq";
import { config } from "./src/config/config.js";
const connection = {
  host: new URL(config.redisUrl).hostname,
  port: Number(new URL(config.redisUrl).port || 6379),
  password: new URL(config.redisUrl).password || undefined,
  username: new URL(config.redisUrl).username || undefined,
};
const queue = new Queue("analytics", { connection });
console.log(JSON.stringify(await queue.getJobCounts(), null, 2));
await queue.close();
