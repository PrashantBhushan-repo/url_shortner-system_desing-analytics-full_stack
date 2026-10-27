import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkReadiness } from '../src/utils/readiness.js';

test('readiness requires both PostgreSQL and Redis', async () => {
  assert.equal(await checkReadiness({ database: async () => 1, redis: async () => 'PONG' }), true);
  assert.equal(await checkReadiness({ database: async () => { throw new Error('offline'); }, redis: async () => 'PONG' }), false);
  assert.equal(await checkReadiness({ database: async () => 1, redis: async () => { throw new Error('offline'); } }), false);
});
test('a hung dependency fails readiness within a bounded interval', async () => {
  assert.equal(await checkReadiness({ database: () => new Promise(() => {}), redis: async () => 'PONG', timeoutMs: 10 }), false);
});
