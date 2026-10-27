import fs from 'node:fs';

export function alertThresholds(overrides = '') {
  const defaults = JSON.parse(fs.readFileSync(new URL('./alert-thresholds.json', import.meta.url)));
  const supplied = overrides ? JSON.parse(overrides) : {};
  if (!supplied || Array.isArray(supplied) || typeof supplied !== 'object') throw new Error('Alert thresholds must be a JSON object');
  for (const key of Object.keys(supplied)) if (!(key in defaults)) throw new Error(`Unknown alert threshold: ${key}`);
  const values = { ...defaults, ...supplied };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid positive alert threshold: ${key}`);
    if (['windowMinutes', 'httpMinRequests', 'httpMinErrors', 'redirectMinRequests', 'clickQueueWaitingJobs', 'failedJobs'].includes(key) && !Number.isInteger(value)) throw new Error(`Alert threshold must be an integer: ${key}`);
  }
  if (values.windowMinutes < 5 || values.windowMinutes > 60) throw new Error('Alert windowMinutes must be between 5 and 60');
  if (values.httpErrorRatio >= 1 || values.httpMinErrors > values.httpMinRequests) throw new Error('Invalid HTTP error ratio or sample minimum');
  return values;
}

export function alertChecks(environment, t = alertThresholds()) {
  if (!['development', 'production', 'test'].includes(environment)) throw new Error('Invalid alert environment');
  const env = `environment="${environment}"`;
  const window = `${t.windowMinutes}m`;
  const requests = `sum(increase(pburls_http_requests_total{${env}}[${window}]))`;
  const errors = `(sum(increase(pburls_http_requests_total{${env},status_code=~"5.."}[${window}])) or vector(0))`;
  const redirect = `${env},route="/r/:shortCode"`;
  const queue = `${env},service="pburls-worker"`;
  const healthy = `max by(queue) (pburls_queue_poll_success{${queue}}) == 1`;
  const age = `max by(queue) (pburls_queue_oldest_waiting_created_timestamp_seconds{${queue},queue="click-queue"})`;
  const description = 'Inspect PBUrls dashboards and correlated traces. Thresholds are initial budgets, not a measured SLO.';
  return [
    ['app-down', 'Application scrape down', `min(up{${env},job="app"})`, '$A < 1', '2m', description],
    ['telemetry-missing', 'Application telemetry missing', `absent_over_time(up{${env},job="app"}[5m])`, '$A > 0', '1m', description],
    ['server-errors', 'Sustained HTTP server errors', `((${errors} / clamp_min(${requests}, 1)) and (${requests} >= ${t.httpMinRequests}) and (${errors} >= ${t.httpMinErrors})) or vector(0)`, `$A > ${t.httpErrorRatio}`, '5m', `Over ${t.httpErrorRatio * 100}% HTTP 5xx with at least ${t.httpMinRequests} requests and ${t.httpMinErrors} server errors in ${window}, sustained 5m. Low traffic alone does not trigger this ratio alert. Check HTTPS and availability alerts too.`],
    ['redirect-slow', 'Sustained slow redirect p95', `(histogram_quantile(0.95,sum by(le)(rate(pburls_http_request_duration_seconds_bucket{${redirect}}[${window}]))) and (sum(increase(pburls_http_request_duration_seconds_count{${redirect}}[${window}])) >= ${t.redirectMinRequests})) or vector(0)`, `$A > ${t.redirectP95Seconds}`, '5m', `Redirect p95 exceeds ${t.redirectP95Seconds}s with at least ${t.redirectMinRequests} observations in ${window}, sustained 5m. Histogram percentiles are estimates; compare controlled baselines before changing the budget.`],
    ['queue-backlog', 'Click queue backlog or excessive wait', `((max by(queue) (pburls_queue_jobs{${queue},queue="click-queue",state="waiting"}) > ${t.clickQueueWaitingJobs}) or ((time() - ${age} > ${t.clickQueueWaitSeconds}) and (${age} > 0))) and on(queue) (${healthy})`, '$A > 0', '2m', `More than ${t.clickQueueWaitingJobs} waiting click jobs OR the head waiting click was created over ${t.clickQueueWaitSeconds}s ago, sustained 2m. Age includes previous retries and is not a scan of all job timestamps. Check worker and Redis health; collection failures are not valid zero backlogs.`],
    ['queue-errors', 'Worker jobs remain in failed state', `max by(queue) (pburls_queue_jobs{${queue},state="failed"}) and on(queue) (${healthy})`, `$A >= ${t.failedJobs}`, '5m', `At least ${t.failedJobs} job(s) remain in BullMQ failed state for 5m. Retrying jobs in delayed/waiting/active states do not count. Failed jobs retained from earlier releases still need investigation; fix and deliberately retry/remove them. Attempt counters/logs remain available for debugging recovered retries.`],
    ['postgres-down', 'PostgreSQL exporter cannot connect', `pg_up{${env}}`, '$A < 1', '2m', description],
    ['redis-down', 'Redis exporter cannot connect', `redis_up{${env}}`, '$A < 1', '2m', description],
    ['disk-low', 'Persistent data disk below 15 percent free', `node_filesystem_avail_bytes{${env},mountpoint="/srv/pburls-data"} / node_filesystem_size_bytes{${env},mountpoint="/srv/pburls-data"}`, '$A < 0.15', '5m', description],
    ['https-down', 'Public HTTPS probe failing', `probe_success{${env}}`, '$A < 1', '2m', description],
    ['tls-expiry', 'TLS certificate expires within 14 days', `probe_ssl_earliest_cert_expiry{${env}} - time()`, '$A < 1209600', '10m', description],
  ];
}
