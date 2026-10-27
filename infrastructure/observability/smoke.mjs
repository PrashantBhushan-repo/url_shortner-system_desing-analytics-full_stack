// Run against the disposable image smoke stack. No production credentials.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:13001';
async function eventually(description, action) {
  for (let i = 0; i < 60; i++) {
    try { if (await action()) { console.log(`Verified: ${description}`); return; } } catch { /* services are starting / flushing */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Observability smoke failed: ${description}`);
}
async function get(url) {
  const res = await fetch(base + url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
await eventually('Grafana ready', async () => (await get('/api/health')).database === 'ok');
for (const query of [
  'pburls_http_requests_total{route="/r/:shortCode"}',
  'pburls_queue_jobs_total{queue="click-queue",outcome="success"}',
  'pg_up == 1', 'redis_up == 1',
]) await eventually(query, async () => {
  const result = await get(`/api/datasources/proxy/uid/prometheus/api/v1/query?query=${encodeURIComponent(query)}`);
  return result.status === 'success' && result.data.result.length > 0;
});
await eventually('request logs stored in Loki', async () => {
  const query = '{service_name="pburls-backend"} |= "http.request"';
  const result = await get(`/api/datasources/proxy/uid/loki/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=10`);
  return result.data.result.some(stream => stream.values.length);
});
await eventually('redirect trace stored in Tempo', async () => {
  const result = await get(`/api/datasources/proxy/uid/tempo/api/search?q=${encodeURIComponent('{ name = "business.redirect" }')}`);
  return result.traces?.length > 0;
});
// The provisioning operation itself must work against a real Grafana API.
const { spawnSync } = await import('node:child_process');
const provision = spawnSync(process.execPath, ['infrastructure/observability/provision.mjs'], {
  env: { ...process.env, GRAFANA_URL: base, GRAFANA_TOKEN: '', GRAFANA_PROMETHEUS_UID: 'prometheus', OBS_ENVIRONMENT: 'production' },
  stdio: 'inherit', timeout: 60000,
});
assert.equal(provision.status, 0, 'Dashboard and alert provisioning failed');
const rules = await get('/api/v1/provisioning/alert-rules');
assert.equal(rules.filter(rule => rule.labels?.application === 'pburls').length, 11);
console.log('Metrics, logs, traces, database exporters, dashboards and alert rules verified.');
