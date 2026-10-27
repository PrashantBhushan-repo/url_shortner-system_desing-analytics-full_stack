import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import express from 'express';
import { metricsMiddleware } from '../src/middlewares/metrics.middleware.js';
import { metricsRegistry, monitorQueues, queueDepth, queuePollSuccess, oldestWaitingCreated } from '../src/telemetry/metrics.js';
import { PrivateTraceExporter } from '../src/telemetry/privacy.js';
import { instrumentPool, observePrismaQuery } from '../src/telemetry/database.js';

test('unknown URLs are bounded, mounted routes are distinct, probes are excluded', async () => {
  process.env.OBS_REQUEST_LOG_SAMPLE_RATIO = '0';
  const app = express(); app.use(metricsMiddleware);
  const router = express.Router(); router.get('/:id', (req, res) => res.sendStatus(200));
  app.use('/api/example', router); app.get('/health', (req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const url of ['/private-token-one', '/private-token-two', '/api/example/123', '/health']) await fetch(base + url);
    const metrics = await metricsRegistry.metrics();
    assert.match(metrics, /route="unmatched"[^\n]* 2/);
    assert.match(metrics, /route="\/api\/example\/:id"/);
    assert.doesNotMatch(metrics, /private-token|route="\/health"/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('queue collection reports failures instead of false zeroes', async () => {
  const stop = monitorQueues([
    { name: 'test-ok', getJobCounts: async () => ({ waiting: 7, active: 2 }) },
    { name: 'test-down', getJobCounts: async () => { throw new Error('offline'); } },
  ]);
  await new Promise(resolve => setTimeout(resolve, 10)); stop();
  assert.ok((await queueDepth.get()).values.some(value => value.labels.queue === 'test-ok' && value.labels.state === 'waiting' && value.value === 7));
  assert.ok((await queuePollSuccess.get()).values.some(value => value.labels.queue === 'test-down' && value.value === 0));
});

test('click queue head age uses one bounded read, resets when empty and marks read failures', async () => {
  async function collect(queue) {
    const stop = monitorQueues([queue]);
    await new Promise(resolve => setTimeout(resolve, 15));
    stop();
  }
  let reads = 0;
  await collect({ name: 'click-queue', getJobCounts: async () => ({ waiting: 1 }),
    getWaiting: async (start, end) => { reads++; assert.equal(start, 0); assert.equal(end, 0); return [{ timestamp: 1234000 }]; } });
  assert.equal(reads, 1);
  assert.equal((await oldestWaitingCreated.get()).values.find(v => v.labels.queue === 'click-queue').value, 1234);
  await collect({ name: 'click-queue', getJobCounts: async () => ({ waiting: 0 }), getWaiting: async () => { throw new Error('Do not read an empty queue'); } });
  assert.equal((await oldestWaitingCreated.get()).values.find(v => v.labels.queue === 'click-queue').value, 0);
  await collect({ name: 'click-queue', getJobCounts: async () => ({ waiting: 1 }), getWaiting: async () => { throw new Error('Redis unavailable'); } });
  assert.equal((await queuePollSuccess.get()).values.find(v => v.labels.queue === 'click-queue').value, 0);
});

test('export privacy removes SQL, URLs, IDs, exception text and links', () => {
  let exported;
  const exporter = new PrivateTraceExporter({ export(spans, done) { exported = spans; done({ code: 0 }); } });
  const span = { name: 'GET /secret', attributes: { 'http.method': 'GET', 'http.route': '/r/:shortCode', 'db.statement': 'secret', 'url.full': 'secret', 'user.id': 'secret' },
    status: { code: 2, message: 'secret' }, spanContext: () => ({ traceId: 'abc' }),
    events: [{ name: 'exception', attributes: { 'exception.message': 'secret', 'exception.type': 'Error' } }], links: [{ attributes: { secret: 'secret' } }] };
  exporter.export([span], () => {});
  assert.doesNotMatch(JSON.stringify(exported), /secret/);
  assert.equal(exported[0].name, 'GET /r/:shortCode');
  assert.equal(span.attributes['db.statement'], 'secret', 'do not mutate the SDK span');
});

test('database timing preserves pg promise/callback results and exports no SQL parameters', async () => {
  const pool = instrumentPool({ totalCount: 3, idleCount: 1, waitingCount: 2,
    query: (...args) => typeof args.at(-1) === 'function'
      ? args.at(-1)(null, { rows: [2] }) : Promise.resolve({ rows: [1] }),
  });
  assert.deepEqual((await pool.query('SELECT private_token FROM private_table')).rows, [1]);
  await new Promise((resolve, reject) => pool.query('UPDATE private_table SET secret=$1', ['private_password'], (error, value) => {
    if (error) reject(error); else { assert.deepEqual(value.rows, [2]); resolve(); }
  }));
  observePrismaQuery({ query: 'SELECT private_password', duration: 25 });
  const metrics = await metricsRegistry.metrics();
  const duration = await metricsRegistry.getSingleMetric('pburls_database_query_duration_seconds').get();
  assert.ok(duration.values.some(value => value.metricName.endsWith('_count') && value.labels.client === 'pg' && value.labels.operation === 'SELECT' && value.value === 1));
  const connections = await metricsRegistry.getSingleMetric('pburls_pg_pool_connections').get();
  assert.ok(connections.values.some(value => value.labels.state === 'waiting' && value.value === 2));
  assert.doesNotMatch(metrics, /private_password|private_token|private_table/);
});

test('real SDK sends correlated traces and logs, flushes on shutdown, sends no duplicate metrics', { timeout: 20000 }, async () => {
  const received = [];
  const collector = http.createServer((req, res) => {
    const chunks = []; req.on('data', data => chunks.push(data));
    req.on('end', () => { received.push({ url: req.url, body: Buffer.concat(chunks) }); res.writeHead(200); res.end(); });
  }).listen(0, '127.0.0.1');
  await once(collector, 'listening');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { shutdownTelemetry } = await import('./otel.js');
    const { trace } = await import('@opentelemetry/api');
    const { logger } = await import('./src/telemetry/logger.js');
    await trace.getTracer('integration-test').startActiveSpan('observability.check', async span => {
      span.setAttribute('db.statement', 'SECRET_MUST_NOT_LEAVE');
      logger.info('observability.check', { method: 'GET', route: '/test', token: 'SECRET_MUST_NOT_LEAVE' });
      span.end();
    });
    const { default: express } = await import('express');
    const { metricsMiddleware } = await import('./src/middlewares/metrics.middleware.js');
    const app = express(); app.use(metricsMiddleware);
    app.get('/probe/:id', (req, res) => res.send('ok'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    await fetch('http://127.0.0.1:' + server.address().port + '/probe/PRIVATE_ROUTE_TOKEN');
    await new Promise(resolve => server.close(resolve));
    await shutdownTelemetry();
  `], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', OTEL_SDK_DISABLED: 'false', OTEL_TRACES_SAMPLER: 'always_on', OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collector.address().port}`, OTEL_SERVICE_NAME: 'pburls-test',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1/test', REDIS_URL: 'redis://127.0.0.1:6379', JWT_SECRET: 'test-only', BASE_URL: 'http://localhost', CLIENT_URL: 'http://localhost' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  const deadline = setTimeout(() => child.kill(), 15000);
  try {
    const [code] = await once(child, 'exit'); assert.equal(code, 0, output);
    assert.ok(received.some(item => item.url === '/v1/traces'), output);
    assert.ok(received.some(item => item.url === '/v1/logs'), output);
    assert.ok(!received.some(item => item.url === '/v1/metrics'));
    for (const { body } of received) assert.ok(!body.includes('SECRET_MUST_NOT_LEAVE'));
    for (const { body } of received) assert.ok(!body.includes('PRIVATE_ROUTE_TOKEN'));
    assert.ok(received.some(item => item.url === '/v1/traces' && item.body.includes('/probe/:id')), 'HTTP route template missing from actual exported traces');
    const log = output.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).find(item => item?.message === 'observability.check');
    assert.match(log.traceId, /^[0-9a-f]{32}$/);
    assert.notEqual(log.traceId, '0'.repeat(32));
    // OTLP protobuf trace IDs are binary. Both exported signals carry this ID.
    for (const url of ['/v1/traces', '/v1/logs']) assert.ok(received.some(item => item.url === url && item.body.includes(Buffer.from(log.traceId, 'hex'))));
  } finally { clearTimeout(deadline); child.kill(); await new Promise(resolve => collector.close(resolve)); }
});
