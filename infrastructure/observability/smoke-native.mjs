// Starts temporary native application processes against the running four-container stack.
// Only probes local GET endpoints; it does not create links/users or run migrations/seeds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';
import { nativeDevelopmentEnvironment } from '../../backend/src/config/nativeDevelopment.js';

const root = new URL('../../', import.meta.url);
const backendRoot = fileURLToPath(new URL('backend/', root));
const frontendRoot = fileURLToPath(new URL('frontend/', root));
const dockerEnv = dotenv.parse(fs.readFileSync(new URL('.env', root)));
const backendEnv = nativeDevelopmentEnvironment({ role: 'backend', dockerEnv });
const workerEnv = nativeDevelopmentEnvironment({ role: 'worker', dockerEnv });
for (const key of ['DATABASE_URL', 'REDIS_URL']) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(backendEnv[key]).hostname), 'Native smoke only supports local data services');
}
const backendPort = Number(backendEnv.PORT || 5000);
assert.equal(backendPort, 5000, 'Native smoke expects the default Vite proxy target on port 5000');
async function listening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}
for (const port of [backendPort, 5173, Number(backendEnv.METRICS_PORT), Number(workerEnv.METRICS_PORT)]) {
  assert.equal(await listening(port), false, `Port ${port} is in use; stop native app processes before the smoke check`);
}
const children = [];
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'ignore' });
  child.on('error', () => {});
  children.push({ name, child });
}
async function eventually(label, check) {
  for (let i = 0; i < 90; i++) {
    assert.ok(children.every(({ child }) => child.exitCode === null && !child.signalCode), `A native process exited while checking ${label}; use the native npm commands to inspect startup output`);
    try { if (await check()) { console.log(`Verified: ${label}`); return; } } catch { /* allow startup/export delay */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Native smoke timed out: ${label}`);
}
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  assert.ok(response.ok);
  return response.json();
}
const grafana = 'http://127.0.0.1:3001';
async function metric(query) {
  return (await json(`${grafana}/api/datasources/proxy/uid/prometheus/api/v1/query?query=${encodeURIComponent(query)}`)).data.result;
}
try {
  start('backend', ['server.js'], backendRoot, backendEnv);
  start('worker', ['worker/index.js'], backendRoot, workerEnv);
  start('frontend', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], frontendRoot, { ...process.env, NODE_ENV: 'development' });
  await eventually('native backend and dependency readiness', async () => (await fetch(`http://127.0.0.1:${backendPort}/ready`, { signal: AbortSignal.timeout(5000) })).ok);
  await eventually('native frontend proxy reaches the backend', async () => (await fetch('http://127.0.0.1:5173/api/plans', { signal: AbortSignal.timeout(5000) })).ok);
  await eventually('local Grafana ready', async () => (await json(`${grafana}/api/health`)).database === 'ok');
  await eventually('Alloy scrapes both native processes through host.docker.internal', async () => (await metric('up{environment="development",job="app"}')).filter(item => item.value[1] === '1').length === 2);
  for (const query of ['pg_up == 1', 'redis_up == 1', 'pburls_http_requests_total{environment="development",service="pburls-backend"}', 'pburls_queue_poll_success{environment="development",service="pburls-worker"} == 1']) {
    await eventually(query, async () => (await metric(query)).length > 0);
  }
  await eventually('native request logs in Loki', async () => {
    const query = encodeURIComponent('{service_name="pburls-backend"} |= "http.request"');
    const result = await json(`${grafana}/api/datasources/proxy/uid/loki/loki/api/v1/query_range?query=${query}&limit=10`);
    return result.data.result.some(stream => stream.values.length);
  });
  await eventually('native backend traces in Tempo', async () => {
    const query = encodeURIComponent('{ resource.service.name = "pburls-backend" }');
    return (await json(`${grafana}/api/datasources/proxy/uid/tempo/api/search?q=${query}`)).traces?.length > 0;
  });
  console.log('Native application → Docker Alloy → LGTM verified. Temporary native processes will stop; infrastructure containers stay running.');
} finally {
  await Promise.all(children.map(async ({ child }) => {
    if (child.exitCode !== null || child.signalCode) return;
    const done = once(child, 'exit');
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 6000);
    try { await done; } finally { clearTimeout(timer); }
  }));
}
