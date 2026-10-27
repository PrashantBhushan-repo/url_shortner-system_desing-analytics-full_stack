import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureMetrics } from '../observability/capture-metrics.mjs';
import { k6Network } from '../observability/k6-network.mjs';

test('local Linux Docker benchmarks reach loopback ports without exposing smoke listeners', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const url = `http://${host}:18081/r/SmokeCI42`;
    assert.deepEqual(k6Network(url, { platform: 'linux' }), { target: url, args: ['--network', 'host'] });
  }
  assert.deepEqual(k6Network('http://host.docker.internal:18081/r/SmokeCI42', { platform: 'linux' }),
    { target: 'http://127.0.0.1:18081/r/SmokeCI42', args: ['--network', 'host'] });
  assert.deepEqual(k6Network('http://localhost:5173/r/Example', { platform: 'win32' }),
    { target: 'http://host.docker.internal:5173/r/Example', args: ['--add-host', 'host.docker.internal:host-gateway'] });
  assert.deepEqual(k6Network('http://localhost:5173/r/Example', { platform: 'linux', native: true }),
    { target: 'http://localhost:5173/r/Example', args: [] });
  assert.deepEqual(k6Network('https://pburls.online/r/Example', { platform: 'linux' }),
    { target: 'https://pburls.online/r/Example', args: [] });
});

test('metric capture preserves samples and missing/error data without inventing zeroes', async () => {
  await assert.rejects(captureMetrics({ endpoint: 'https://reader:PRIVATE_READ_TOKEN@example.test/query_range', environment: 'test', start: 0, end: 1 }), error => !error.message.includes('PRIVATE_READ_TOKEN'));
  const server = http.createServer((req, res) => {
    const query = new URL(req.url, 'http://fixture').searchParams.get('query');
    res.setHeader('Content-Type', 'application/json');
    if (query.includes('redis_')) { res.writeHead(503); res.end('{}'); return; }
    res.end(JSON.stringify({ status: 'success', data: { result: query.includes('node_') ? [] : [{ values: [[10, '5'], [25, '15']] }] } }));
  }).listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const result = await captureMetrics({ start: 10000, end: 25000, environment: 'test', endpoint: `http://127.0.0.1:${server.address().port}/query_range` });
    assert.equal(result.process_memory_bytes.mean, 10);
    assert.equal(result.redis_memory_bytes.error, 'HTTP 503');
    assert.equal(result.host_cpu_fraction.max, null);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('real k6 redirect runner saves a usable report and comparison', { skip: process.env.RUN_K6_SMOKE !== 'true', timeout: 120000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const server = http.createServer((req, res) => {
    if (req.url === '/r/fixture') { res.writeHead(302, { Location: 'https://example.com/fixture' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'success', data: { result: [{ values: [[Date.now() / 1000, '10']] }] } }));
    // Match the smoke stack's loopback-only listener; a Linux bridge gateway
    // must not accidentally make this test pass when host networking is missing.
  }).listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  const run = spawn(process.execPath, ['infrastructure/observability/benchmark.mjs', 'run', 'fixture-harness', `http://127.0.0.1:${port}/r/fixture`, '1', '30'], {
    cwd: root, env: { ...process.env, OBS_CAPTURE_DELAY_MS: '0', PROMETHEUS_QUERY_URL: `http://127.0.0.1:${port}/query_range`, BENCHMARK_NOTES: 'Synthetic fixture harness; these are not application performance results.' },
  });
  let output = ''; run.stdout.on('data', chunk => output += chunk); run.stderr.on('data', chunk => output += chunk);
  try {
    const [code] = await once(run, 'exit'); assert.equal(code, 0, output);
    const report = output.match(/Result: (.+record\.json)/)?.[1].trim();
    assert.ok(report, output);
    const record = JSON.parse(fs.readFileSync(report, 'utf8'));
    assert.equal(record.k6_network, process.env.K6_BINARY ? 'native' : process.platform === 'linux' ? 'host' : 'bridge');
    assert.equal(record.measurements.failure_fraction, 0);
    assert.ok(record.measurements.request_count >= 29);
    assert.ok(record.measurements.request_count <= 31, 'Warmup requests were incorrectly included in the measured count');
    assert.ok(Number.isFinite(record.measurements.p95_ms));
    const summary = JSON.parse(fs.readFileSync(path.join(path.dirname(report), 'k6.json'), 'utf8'));
    assert.equal(Date.parse(record.measured_window_start), summary.metrics.redirect_request_started_unix_ms.values.min);
    assert.equal(Date.parse(record.measured_window_end), summary.metrics.redirect_request_finished_unix_ms.values.max);
    const windowMs = Date.parse(record.measured_window_end) - Date.parse(record.measured_window_start);
    assert.ok(windowMs >= 28000 && windowMs <= 32000, 'Server capture must match the measured requests, excluding initialization and warmup');
    assert.equal(record.measurements.process_memory_bytes_sampled_mean, 10);
    const comparison = spawn(process.execPath, ['infrastructure/observability/benchmark.mjs', 'compare', report, report], { cwd: root });
    let table = ''; comparison.stdout.on('data', chunk => table += chunk);
    const [status] = await once(comparison, 'exit'); assert.equal(status, 0); assert.match(table, /0.00%/);
    console.log('k6 harness verified; synthetic results saved under .artifacts/observability.');
    assert.ok(path.isAbsolute(report));
  } finally { run.kill(); await new Promise(resolve => server.close(resolve)); }
});

test('Grafana provisioning updates its resources idempotently and fails on rejected writes', async () => {
  const rules = new Map(), dashboards = new Map();
  let folder, rejectWrites = false;
  const server = http.createServer((req, res) => {
    let raw = ''; req.on('data', data => raw += data);
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      const send = (code, value = {}) => { res.writeHead(code); res.end(JSON.stringify(value)); };
      if (req.method === 'GET' && req.url === '/api/folders/pburls') return send(folder ? 200 : 404, folder);
      if (req.method === 'POST' && req.url === '/api/folders') { folder = JSON.parse(raw); return send(200, folder); }
      if (req.method === 'POST' && req.url === '/api/dashboards/db') {
        if (rejectWrites) return send(404);
        const body = JSON.parse(raw); dashboards.set(body.dashboard.uid, body); return send(200);
      }
      if (req.url.startsWith('/api/v1/provisioning/alert-rules')) {
        const uid = req.url.split('/').at(-1);
        if (req.method === 'GET') return send(rules.has(uid) ? 200 : 404, rules.get(uid));
        const body = JSON.parse(raw); rules.set(body.uid, body); return send(200, body);
      }
      send(404);
    });
  }).listen(0, '127.0.0.1'); await once(server, 'listening');
  async function provision(overrides = '') {
    const child = spawn(process.execPath, ['infrastructure/observability/provision.mjs'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: { ...process.env, GRAFANA_URL: `http://127.0.0.1:${server.address().port}`, GRAFANA_TOKEN: '', GRAFANA_PROMETHEUS_UID: 'test-prometheus', GRAFANA_LOKI_UID: 'test-loki', OBS_ENVIRONMENT: 'test', PBURLS_ALERT_THRESHOLDS_JSON: overrides },
    });
    let output = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
    const [code] = await once(child, 'exit'); return { code, output };
  }
  try {
    for (let i = 0; i < 2; i++) { const result = await provision(); assert.equal(result.code, 0, result.output); }
    assert.equal(dashboards.size, 3); assert.equal(rules.size, 11);
    assert.equal([...dashboards.values()][0].dashboard.templating.list.find(variable => variable.name === 'logs').current.value, 'test-loki');
    assert.ok([...rules.values()].every(rule => rule.data[0].datasourceUid === 'test-prometheus'));
    const updated = await provision('{"redirectP95Seconds":0.5}');
    assert.equal(updated.code, 0, updated.output);
    assert.equal(rules.size, 11, 'Tuning updates existing rules without duplicate alerts');
    assert.equal(rules.get('pburls-redirect-slow-test').data[1].model.expression, '$A > 0.5');
    const before = JSON.stringify([...rules.values()]);
    const invalid = await provision('{"redirectP95Seconds":-1}');
    assert.notEqual(invalid.code, 0);
    assert.equal(JSON.stringify([...rules.values()]), before, 'Invalid tuning must not change remote rules');
    rejectWrites = true;
    const failure = await provision(); assert.notEqual(failure.code, 0); assert.match(failure.output, /Grafana API failed \(404\)/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
