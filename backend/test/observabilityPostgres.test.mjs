import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { config } from '../src/config/config.js';

test('real PostgreSQL pg + Prisma timings and traces export without SQL text', { timeout: 20000 }, async t => {
  const host = config.db.connectionString ? new URL(config.db.connectionString).hostname : config.db.host;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) { t.skip('Database telemetry probe only runs against local PostgreSQL'); return; }
  const payloads = [];
  const receiver = http.createServer((req, res) => {
    const chunks = []; req.on('data', data => chunks.push(data));
    req.on('end', () => { payloads.push(Buffer.concat(chunks)); res.writeHead(200); res.end(); });
  }).listen(0, '127.0.0.1'); await once(receiver, 'listening');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { shutdownTelemetry } = await import('./otel.js');
    const { trace } = await import('@opentelemetry/api');
    const { default: pool } = await import('./src/config/db.js');
    const { default: prisma } = await import('./src/config/prismaClient.js');
    const { metricsRegistry } = await import('./src/telemetry/metrics.js');
    await trace.getTracer('database-telemetry-test').startActiveSpan('database.check', async span => {
      await pool.query("SELECT 'OBS_PRIVACY_PROBE'::text AS value");
      await prisma.$queryRawUnsafe("SELECT 'OBS_PRIVACY_PROBE'::text AS value");
      span.end();
    });
    const metric = await metricsRegistry.getSingleMetric('pburls_database_query_duration_seconds').get();
    console.log(JSON.stringify({ clients: metric.values.filter(value => value.metricName.endsWith('_count')).map(value => value.labels.client) }));
    await pool.end(); await prisma.$disconnect(); await shutdownTelemetry();
  `], { cwd: new URL('../', import.meta.url), env: { ...process.env, OTEL_SDK_DISABLED: 'false', OTEL_TRACES_SAMPLER: 'always_on',
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${receiver.address().port}`, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '', OTEL_EXPORTER_OTLP_HEADERS: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
  const timer = setTimeout(() => child.kill(), 15000);
  try {
    const [code] = await once(child, 'exit'); assert.equal(code, 0, output);
    const result = output.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).find(value => value?.clients);
    assert.ok(result?.clients.includes('pg'), 'pg histogram missing');
    assert.ok(result?.clients.includes('prisma'), 'Prisma histogram missing');
    const bytes = Buffer.concat(payloads);
    assert.ok(bytes.includes('instrumentation-pg'), 'pg traces missing');
    assert.ok(bytes.includes('prisma'), 'Prisma traces missing');
    assert.ok(!bytes.includes('OBS_PRIVACY_PROBE'), 'SQL literal leaked into exported telemetry');
  } finally { clearTimeout(timer); child.kill(); await new Promise(resolve => receiver.close(resolve)); }
});
