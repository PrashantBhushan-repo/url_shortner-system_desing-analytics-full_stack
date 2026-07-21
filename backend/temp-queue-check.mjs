import { Worker } from 'bullmq';
import { config } from './src/config/config.js';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: Number(new URL(config.redisUrl).port || 6379),
  password: new URL(config.redisUrl).password || undefined,
  username: new URL(config.redisUrl).username || undefined,
};

const worker = new Worker('analytics', async (job) => {
  console.log('received', job.name, job.data);
}, { connection, autorun: true });

setTimeout(() => {
  worker.close();
  process.exit(0);
}, 2000);
