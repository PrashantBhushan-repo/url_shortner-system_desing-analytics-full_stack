import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { captureMetrics } from './capture-metrics.mjs';
import { k6Network } from './k6-network.mjs';
const [mode, ...args] = process.argv.slice(2);
const root = fileURLToPath(new URL('../../', import.meta.url));
if (mode === 'compare') {
  const [before, after] = args.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log('| Measurement | Baseline | Candidate | Change |\n|---|---:|---:|---:|');
  for (const [key, value] of Object.entries(before.measurements)) {
    const candidate = after.measurements[key];
    const delta = typeof candidate === 'number' && typeof value === 'number' && value !== 0 ? `${((candidate / value - 1) * 100).toFixed(2)}%` : 'n/a';
    console.log(`| ${key} | ${value} | ${candidate ?? 'missing'} | ${delta} |`);
  }
  if (before.rate !== after.rate || before.duration !== after.duration || before.environment !== after.environment || before.metrics_environment !== after.metrics_environment || before.target_origin !== after.target_origin || before.k6_network !== after.k6_network || before.k6_runtime !== after.k6_runtime) console.warn('Different load, targets, environments or generator networking/runtime: this is not a controlled comparison.');
} else if (mode === 'run') {
  const [label, rawUrl, rawRate = '1', rawDuration = '60'] = args;
  if (!/^[a-z0-9-]{1,48}$/.test(label || '')) throw new Error('Use a short lowercase run label');
  const target = new URL(rawUrl);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || !/^\/r\/[A-Za-z0-9_-]+$/.test(target.pathname)) throw new Error('Use a public test redirect URL without credentials or query parameters');
  const local = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(target.hostname);
  if (!local && target.protocol !== 'https:') throw new Error('Use HTTPS for remote application benchmarks');
  const rate = Number(rawRate), duration = Number(rawDuration);
  if (!local && process.env.ALLOW_REMOTE_LOAD_TEST !== 'true') throw new Error('For a staging/production test, explicitly set ALLOW_REMOTE_LOAD_TEST=true');
  if (!Number.isInteger(rate) || rate < 1 || rate > (local ? 1000 : 20) || !Number.isInteger(duration) || duration < 30 || duration > 600) throw new Error('Rate must be 1–1000 locally / 1–20 remotely; duration 30–600 seconds');
  const network = k6Network(target, { platform: os.platform(), native: Boolean(process.env.K6_BINARY) });
  const directory = path.join(root, '.artifacts', 'observability', `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`);
  fs.mkdirSync(directory, { recursive: true });
  const started = Date.now();
  const dockerArgs = ['run', '--rm', '--user', '0', ...network.args,
    '-v', `${path.join(root, 'infrastructure/observability/load')}:/scripts:ro`, '-v', `${directory}:/results`,
    '-e', `TARGET_URL=${network.target}`, '-e', `RATE=${rate}`, '-e', `DURATION=${duration}`,
    '-e', `P95_BUDGET_MS=${process.env.P95_BUDGET_MS || 250}`,
    'grafana/k6:2.3.0', 'run', '/scripts/redirect.js'];
  const result = process.env.K6_BINARY
    ? spawnSync(process.env.K6_BINARY, ['run', path.join(root, 'infrastructure/observability/load/redirect.js')], {
        stdio: 'inherit', env: { ...process.env, TARGET_URL: target.toString(), RATE: String(rate), DURATION: String(duration), SUMMARY_PATH: path.join(directory, 'k6.json') },
      })
    : spawnSync('docker', dockerArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  const summaryFile = path.join(directory, 'k6.json');
  if (!fs.existsSync(summaryFile)) throw new Error('k6 did not produce a summary; the test did not complete');
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const measurements = {
    request_count: summary.metrics.redirect_requests?.values.count ?? 0,
    achieved_rps: (summary.metrics.redirect_requests?.values.count ?? 0) / duration,
    p50_ms: summary.metrics.redirect_latency?.values.med ?? null,
    p95_ms: summary.metrics.redirect_latency?.values['p(95)'] ?? null,
    p99_ms: summary.metrics.redirect_latency?.values['p(99)'] ?? null,
    failure_fraction: summary.metrics.redirect_failures?.values.rate ?? null,
    dropped_iterations: summary.metrics['dropped_iterations{scenario:measure}']?.values.count ?? summary.metrics.dropped_iterations?.values.count ?? 0,
  };
  const testEnd = summary.pburls.finished_at_ms;
  const measuredStart = summary.metrics.redirect_request_started_unix_ms?.values.min;
  const measuredEnd = summary.metrics.redirect_request_finished_unix_ms?.values.max;
  const validWindow = Number.isFinite(measuredStart) && Number.isFinite(measuredEnd) && measuredEnd >= measuredStart;
  const metricsEndpoint = process.env.PROMETHEUS_QUERY_URL || (local ? 'http://127.0.0.1:3001/api/datasources/proxy/uid/prometheus/api/v1/query_range' : '');
  let serverMetrics;
  if (metricsEndpoint && validWindow) {
    const delay = Number(process.env.OBS_CAPTURE_DELAY_MS ?? 20000);
    if (!Number.isInteger(delay) || delay < 0 || delay > 60000) throw new Error('OBS_CAPTURE_DELAY_MS must be 0–60000');
    if (delay) {
      console.log(`Waiting ${delay / 1000}s for the metrics pipeline to flush; the measured load window has ended.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    serverMetrics = await captureMetrics({ start: measuredStart, end: measuredEnd,
      environment: process.env.OBS_ENVIRONMENT || (local ? 'development' : 'production'),
      endpoint: metricsEndpoint, username: process.env.PROMETHEUS_USERNAME, token: process.env.PROMETHEUS_READ_TOKEN });
    fs.writeFileSync(path.join(directory, 'server-metrics.json'), JSON.stringify(serverMetrics, null, 2) + '\n');
    for (const [name, stats] of Object.entries(serverMetrics)) {
      if (stats.count) { measurements[`${name}_sampled_max`] = stats.max; measurements[`${name}_sampled_mean`] = stats.mean; }
    }
  }
  const record = { label, command_started_at: new Date(started).toISOString(), finished_at: new Date(testEnd).toISOString(),
    measured_window_start: validWindow ? new Date(measuredStart).toISOString() : null,
    measured_window_end: validWindow ? new Date(measuredEnd).toISOString() : null, environment: local ? 'local' : 'remote',
    metrics_environment: process.env.OBS_ENVIRONMENT || (local ? 'development' : 'production'),
    target_origin: target.origin, rate, duration, warmup_seconds: 10,
    thresholds: { p95_budget_ms: Number(process.env.P95_BUDGET_MS || 250), failure_fraction: 0.01, dropped_iterations: 0 },
    k6_runtime: process.env.K6_BINARY ? 'native (record version in notes)' : 'grafana/k6:2.3.0',
    k6_network: process.env.K6_BINARY ? 'native' : network.args.includes('host') ? 'host' : 'bridge',
    execution_target_origin: new URL(network.target).origin,
    git_commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim(),
    working_tree_dirty: Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout?.trim()),
    load_generator: { platform: os.platform(), cpus: os.cpus().length, memory_bytes: os.totalmem() },
    notes: process.env.BENCHMARK_NOTES || '', passed: result.status === 0 && validWindow && measurements.request_count > 0,
    server_metrics: metricsEndpoint ? (serverMetrics && Object.values(serverMetrics).some(value => value.count) ? 'captured; check missing series individually' : 'unavailable') : 'not configured',
    measurements };
  fs.writeFileSync(path.join(directory, 'record.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`Result: ${path.join(directory, 'record.json')}`);
  process.exitCode = result.status || (record.passed ? 0 : 1);
} else {
  console.log('node infrastructure/observability/benchmark.mjs run baseline http://localhost:5173/r/YOUR_TEST_CODE 1 60\nnode infrastructure/observability/benchmark.mjs compare BASELINE/record.json CANDIDATE/record.json');
}
