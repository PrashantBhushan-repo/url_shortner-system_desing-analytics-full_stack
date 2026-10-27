// Preserve raw samples as well as summaries; missing series stay missing.
export async function captureMetrics({ start, end, environment, endpoint, username, token }) {
  const url = new URL(endpoint);
  if (url.username || url.password) throw new Error('Supply metric credentials separately from the query URL');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol !== 'https:') throw new Error('Use HTTPS for remote metric queries');
  const env = `environment="${environment}"`;
  const specs = [
    ['http_server_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_http_request_duration_seconds_bucket{${env}}[1m])))`],
    ['http_server_rps', `sum(rate(pburls_http_requests_total{${env}}[1m]))`],
    ['http_server_5xx_fraction', `(sum(rate(pburls_http_requests_total{${env},status_code=~"5.."}[1m])) or vector(0)) / sum(rate(pburls_http_requests_total{${env}}[1m]))`],
    ['cache_hit_fraction', `(sum(rate(pburls_redis_cache_hits_total{${env}}[1m])) or vector(0)) / ((sum(rate(pburls_redis_cache_hits_total{${env}}[1m])) or vector(0)) + (sum(rate(pburls_redis_cache_misses_total{${env}}[1m])) or vector(0)))`],
    ['click_processing_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_queue_job_duration_seconds_bucket{${env},queue="click-queue"}[1m])))`],
    ['click_wait_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_queue_wait_seconds_bucket{${env},queue="click-queue"}[1m])))`],
    ['click_end_to_end_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_queue_end_to_end_seconds_bucket{${env},queue="click-queue"}[1m])))`],
    ['database_pg_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_database_query_duration_seconds_bucket{${env},client="pg"}[1m])))`],
    ['database_prisma_p95_seconds', `histogram_quantile(0.95,sum by(le)(rate(pburls_database_query_duration_seconds_bucket{${env},client="prisma"}[1m])))`],
    ['pg_pool_waiting_requests', `sum(pburls_pg_pool_connections{${env},state="waiting"})`],
    ['process_memory_bytes', `sum(pburls_process_resident_memory_bytes{${env}})`],
    ['process_cpu_cores', `sum(rate(pburls_process_cpu_seconds_total{${env}}[1m]))`],
    ['node_heap_bytes', `sum(pburls_nodejs_heap_size_used_bytes{${env}})`],
    ['event_loop_p99_seconds', `max(pburls_nodejs_eventloop_lag_p99_seconds{${env}})`],
    ['click_waiting_jobs', `sum(pburls_queue_jobs{${env},queue="click-queue",state="waiting"})`],
    ['click_active_jobs', `sum(pburls_queue_jobs{${env},queue="click-queue",state="active"})`],
    ['redis_memory_bytes', `max(redis_memory_used_bytes{${env}})`],
    ['redis_evictions_per_second', `sum(rate(redis_evicted_keys_total{${env}}[1m]))`],
    ['postgres_connections', `sum(pg_stat_database_numbackends{${env}})`],
    ['host_cpu_fraction', `1 - avg(rate(node_cpu_seconds_total{${env},mode="idle"}[1m]))`],
    ['host_memory_fraction', `1 - sum(node_memory_MemAvailable_bytes{${env}}) / sum(node_memory_MemTotal_bytes{${env}})`],
    ['ebs_free_bytes', `min(node_filesystem_avail_bytes{${env},mountpoint="/srv/pburls-data"})`],
    ['app_scrape_up', `min(up{${env},job="app"})`],
  ];
  const headers = token ? { Authorization: username ? `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}` : `Bearer ${token}` } : {};
  const result = {};
  // Bound simultaneous requests to the metrics service.
  for (let offset = 0; offset < specs.length; offset += 4) await Promise.all(specs.slice(offset, offset + 4).map(async ([name, query]) => {
    const request = new URL(url);
    request.search = new URLSearchParams({ query, start: String(start / 1000), end: String(end / 1000), step: '15' });
    try {
      const response = await fetch(request, { headers, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.status !== 'success') throw new Error('Metrics query failed');
      const samples = data.data.result.flatMap(series => series.values || []).map(([timestamp, value]) => [timestamp, Number(value)]).filter(([, value]) => Number.isFinite(value));
      const values = samples.map(([, value]) => value);
      result[name] = { query, samples, count: values.length,
        min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
        mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
    } catch (error) { result[name] = { error: error.message, count: 0 }; }
  }));
  return result;
}
