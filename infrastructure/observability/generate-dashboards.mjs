import fs from 'node:fs';
const dir = new URL('./grafana/dashboards/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const env = 'environment="$environment"';
const app = `${env},service=~"$service"`;
const rate = metric => `sum(rate(${metric}{${app}}[$__rate_interval]))`;
const percentile = (metric, q, selector = app) => `histogram_quantile(${q},sum by(le)(rate(${metric}_bucket{${selector}}[$__rate_interval])))`;
const variables = [
  { name: 'metrics', type: 'datasource', query: 'prometheus', current: { text: 'Prometheus', value: 'prometheus' } },
  { name: 'logs', type: 'datasource', query: 'loki', current: { text: 'Loki', value: 'loki' } },
  { name: 'environment', type: 'custom', query: 'development,production,test', current: { text: 'development', value: 'development' } },
  { name: 'service', type: 'custom', query: 'pburls-backend,pburls-worker', multi: true, includeAll: true, allValue: 'pburls-.*', current: { text: 'All', value: '$__all' } },
];
function dashboard(uid, title, specs, description) {
  const panels = specs.map(([title, expr, unit = 'short', type = 'timeseries', legendFormat = ''], i) => ({
    id: i + 1, title, type,
    datasource: { type: type === 'logs' ? 'loki' : 'prometheus', uid: type === 'logs' ? '${logs}' : '${metrics}' },
    gridPos: { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 },
    targets: [{ refId: 'A', expr, legendFormat, range: true }],
    fieldConfig: { defaults: { unit, min: 0, ...(unit === 'percentunit' ? { max: 1 } : {}) }, overrides: [] },
    options: type === 'logs' ? { showTime: true, wrapLogMessage: true } : { legend: { displayMode: 'table', calcs: ['mean', 'max', 'lastNotNull'] }, tooltip: { mode: 'multi' } },
  }));
  fs.writeFileSync(new URL(`${uid}.json`, dir), JSON.stringify({ uid, title, description, tags: ['pburls'],
    schemaVersion: 39, version: 1, editable: true, refresh: '15s', timezone: 'browser',
    time: { from: 'now-30m', to: 'now' }, templating: { list: variables }, panels,
  }, null, 2) + '\n');
}
dashboard('pburls-application', 'PBUrls · Application', [
  ['Requests / second', rate('pburls_http_requests_total'), 'reqps'],
  ['HTTP 5xx fraction', `(${rate('pburls_http_requests_total').replace(`{${app}}`, `{${app},status_code=~"5.."}`)} or vector(0)) / ${rate('pburls_http_requests_total')}`, 'percentunit'],
  ['Request p50', percentile('pburls_http_request_duration_seconds', 0.5), 's'],
  ['Request p95', percentile('pburls_http_request_duration_seconds', 0.95), 's'],
  ['Request p99', percentile('pburls_http_request_duration_seconds', 0.99), 's'],
  ['Redirect p95', percentile('pburls_http_request_duration_seconds', 0.95, `${app},route="/r/:shortCode"`), 's'],
  ['Requests by route and status', `sum by(route,status_code)(rate(pburls_http_requests_total{${app}}[$__rate_interval]))`, 'reqps', 'timeseries', '{{route}} · {{status_code}}'],
  ['Cache hit fraction', `(${rate('pburls_redis_cache_hits_total')} or vector(0)) / ((${rate('pburls_redis_cache_hits_total')} or vector(0)) + (${rate('pburls_redis_cache_misses_total')} or vector(0)))`, 'percentunit'],
  ['Process CPU (1 = one CPU core)', `rate(pburls_process_cpu_seconds_total{${app}}[$__rate_interval])`, 'short'],
  ['Process resident memory', `pburls_process_resident_memory_bytes{${app}}`, 'bytes'],
  ['Node heap used', `pburls_nodejs_heap_size_used_bytes{${app}}`, 'bytes'],
  ['Process uptime', `time() - pburls_process_start_time_seconds{${app}}`, 's'],
  ['Observed process restarts (one hour)', `changes(pburls_process_start_time_seconds{${app}}[1h])`],
  ['Event loop lag p99 (last collection)', `pburls_nodejs_eventloop_lag_p99_seconds{${app}}`, 's'],
  ['In-flight HTTP requests', `pburls_http_in_flight{${app}}`],
  ['Aborted responses / second', `sum(rate(pburls_http_aborted_total{${app}}[$__rate_interval]))`, 'reqps'],
  ['Database query p95 by client and operation', `histogram_quantile(0.95,sum by(le,client,operation)(rate(pburls_database_query_duration_seconds_bucket{${app}}[$__rate_interval])))`, 's', 'timeseries', '{{client}} · {{operation}}'],
  ['Node pg pool connections / waiting requests', `pburls_pg_pool_connections{${app}}`, 'short', 'timeseries', '{{service}} · {{state}}'],
  ['Business operations by outcome', `sum by(domain,operation,outcome)(rate(pburls_business_operations_total{${app}}[$__rate_interval]))`, 'ops'],
  ['Scrape availability (0 = down)', `up{${env},job="app"}`, 'short'],
  ['Structured request and job logs (sampled successes)', '{service_name=~"pburls-.*"} | deployment_environment_name="$environment"', 'short', 'logs'],
], 'Application-side timings; use the k6 client measurements for DNS/TLS/Nginx/network latency. 4xx and 429 are shown separately from server failures. No traffic means ratios can be empty.');
dashboard('pburls-workers', 'PBUrls · Workers', [
  ['Queue jobs by state', `pburls_queue_jobs{${env}}`, 'short', 'timeseries', '{{queue}} · {{state}}'],
  ['Queue collection success', `pburls_queue_poll_success{${env}}`],
  ['Job attempts / second by outcome', `sum by(queue,outcome)(rate(pburls_queue_jobs_total{${env}}[$__rate_interval]))`, 'ops', 'timeseries', '{{queue}} · {{outcome}}'],
  ['Processing p95', percentile('pburls_queue_job_duration_seconds', 0.95, env), 's'],
  ['Click queue wait p95', percentile('pburls_queue_wait_seconds', 0.95, `${env},queue="click-queue"`), 's'],
  ['Click queue creation-to-success p95', percentile('pburls_queue_end_to_end_seconds', 0.95, `${env},queue="click-queue"`), 's'],
], 'Jobs count processing attempts, not unique business events. Failed/completed gauges include retained history. Scheduled and retried jobs include their delays; use click-queue for ingestion latency.');
dashboard('pburls-infrastructure', 'PBUrls · Database, Redis and Host', [
  ['Public HTTPS probe success (production)', `probe_success{${env}}`],
  ['Public HTTPS round trip (production)', `probe_duration_seconds{${env}}`, 's'],
  ['Certificate validity remaining (production)', `probe_ssl_earliest_cert_expiry{${env}} - time()`, 's'],
  ['Public HTTPS response status (production)', `probe_http_status_code{${env}}`],
  ['PostgreSQL exporter up', `pg_up{${env}}`],
  ['PostgreSQL active / idle connections', `pg_stat_database_numbackends{${env}}`],
  ['PostgreSQL transactions / second', `sum by(datname)(rate(pg_stat_database_xact_commit{${env}}[$__rate_interval]))`, 'ops'],
  ['PostgreSQL rollback / second', `sum by(datname)(rate(pg_stat_database_xact_rollback{${env}}[$__rate_interval]))`, 'ops'],
  ['PostgreSQL deadlocks / second', `sum by(datname)(rate(pg_stat_database_deadlocks{${env}}[$__rate_interval]))`, 'ops'],
  ['PostgreSQL disk reads / second', `sum by(datname)(rate(pg_stat_database_blks_read{${env}}[$__rate_interval]))`, 'ops'],
  ['Redis up', `redis_up{${env}}`],
  ['Redis memory', `redis_memory_used_bytes{${env}}`, 'bytes'],
  ['Redis connected clients', `redis_connected_clients{${env}}`],
  ['Redis commands / second', `rate(redis_commands_processed_total{${env}}[$__rate_interval])`, 'ops'],
  ['Redis evictions / second', `rate(redis_evicted_keys_total{${env}}[$__rate_interval])`, 'ops'],
  ['Redis blocked clients', `redis_blocked_clients{${env}}`],
  ['Host CPU busy (production)', `1 - avg by(instance)(rate(node_cpu_seconds_total{${env},mode="idle"}[$__rate_interval]))`, 'percentunit'],
  ['Host memory used (production)', `1 - node_memory_MemAvailable_bytes{${env}} / node_memory_MemTotal_bytes{${env}}`, 'percentunit'],
  ['Persistent EBS free space (production)', `node_filesystem_avail_bytes{${env},mountpoint="/srv/pburls-data"}`, 'bytes'],
  ['Host disk I/O busy (production)', `rate(node_disk_io_time_seconds_total{${env}}[$__rate_interval])`, 'percentunit'],
  ['Host disk read bytes / second', `rate(node_disk_read_bytes_total{${env}}[$__rate_interval])`, 'Bps'],
  ['Host disk write bytes / second', `rate(node_disk_written_bytes_total{${env}}[$__rate_interval])`, 'Bps'],
  ['Host network receive bytes / second', `rate(node_network_receive_bytes_total{${env},device!="lo"}[$__rate_interval])`, 'Bps'],
  ['Host network transmit bytes / second', `rate(node_network_transmit_bytes_total{${env},device!="lo"}[$__rate_interval])`, 'Bps'],
  ['Collector refused spans / second', `sum(rate(otelcol_processor_refused_spans_total{${env}}[$__rate_interval]))`, 'ops'],
  ['Collector export failures / second', `sum(rate(otelcol_exporter_send_failed_spans_total{${env}}[$__rate_interval]))`, 'ops'],
], 'Host panels are intentionally empty locally on Docker Desktop. Blocked Redis clients can include healthy BullMQ blocking consumers. Disk block reads do not include OS page-cache hits. Missing data is not zero.');
