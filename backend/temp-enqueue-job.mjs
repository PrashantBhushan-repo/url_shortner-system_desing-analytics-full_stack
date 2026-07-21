import { Queue } from 'bullmq';
import { config } from './src/config/config.js';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: Number(new URL(config.redisUrl).port || 6379),
  password: new URL(config.redisUrl).password || undefined,
  username: new URL(config.redisUrl).username || undefined,
};

const queue = new Queue('analytics', { connection });
await queue.add('click-event', {
  urlId: 27,
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  referrer: 'https://example.com',
  timestamp: new Date().toISOString(),
  sessionId: 'smoke',
});
console.log('queued');
await queue.close();
