import http from "http";
import client from "prom-client";

const serviceName = process.env.OTEL_SERVICE_NAME || (
  process.env.IS_CHILD_WORKER === "true" ? "pburls-worker" : "pburls-backend"
);

export const metricsRegistry = new client.Registry();
metricsRegistry.setDefaultLabels({ service: serviceName, environment: process.env.NODE_ENV || 'development' });
client.collectDefaultMetrics({ register: metricsRegistry, prefix: "pburls_" });

export const httpRequestsTotal = new client.Counter({
  name: "pburls_http_requests_total",
  help: "Total HTTP requests handled by the application",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new client.Histogram({
  name: "pburls_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpErrorsTotal = new client.Counter({
  name: "pburls_http_errors_total",
  help: "Total HTTP responses with status code 400 or higher",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});
export const httpInFlight = new client.Gauge({ name: 'pburls_http_in_flight', help: 'Requests currently being handled', registers: [metricsRegistry] });
export const httpAborted = new client.Counter({ name: 'pburls_http_aborted_total', help: 'Requests closed before a complete response', registers: [metricsRegistry] });
export const databaseDuration = new client.Histogram({
  name: 'pburls_database_query_duration_seconds', help: 'pg client elapsed time includes pool wait; Prisma engine query event duration excludes JavaScript overhead',
  labelNames: ['client', 'operation'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], registers: [metricsRegistry],
});
export const pgPoolConnections = new client.Gauge({ name: 'pburls_pg_pool_connections', help: 'Node pg pool connections or pending requests; excludes Prisma engine pools', labelNames: ['state'], registers: [metricsRegistry] });

export const businessOperationsTotal = new client.Counter({
  name: "pburls_business_operations_total",
  help: "Total business operations completed",
  labelNames: ["domain", "operation", "outcome"],
  registers: [metricsRegistry],
});

export const queueJobsTotal = new client.Counter({
  name: "pburls_queue_jobs_total",
  help: "Total BullMQ jobs processed",
  labelNames: ["queue", "outcome"],
  registers: [metricsRegistry],
});

export const queueJobDuration = new client.Histogram({
  name: "pburls_queue_job_duration_seconds",
  help: "BullMQ job processing duration in seconds",
  labelNames: ["queue"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [metricsRegistry],
});

export const queueWaitDuration = new client.Histogram({
  name: 'pburls_queue_wait_seconds', help: 'Job creation to processing start, includes retries and scheduled delays',
  labelNames: ['queue'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 300], registers: [metricsRegistry],
});
export const queueEndToEnd = new client.Histogram({
  name: 'pburls_queue_end_to_end_seconds', help: 'Job creation to successful completion, includes retries',
  labelNames: ['queue'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 300], registers: [metricsRegistry],
});
export const queueDepth = new client.Gauge({
  name: 'pburls_queue_jobs', help: 'Current jobs by queue state (failed/completed may be retained history)',
  labelNames: ['queue', 'state'], registers: [metricsRegistry],
});
export const queuePollSuccess = new client.Gauge({
  name: 'pburls_queue_poll_success', help: 'Whether queue statistics could be collected',
  labelNames: ['queue'], registers: [metricsRegistry],
});
export const oldestWaitingCreated = new client.Gauge({
  name: 'pburls_queue_oldest_waiting_created_timestamp_seconds',
  help: 'Creation timestamp of head waiting FIFO click job; zero when empty; includes earlier retries, not a full timestamp scan',
  labelNames: ['queue'], registers: [metricsRegistry],
});
new client.Gauge({ name: 'pburls_build_info', help: 'Application version', labelNames: ['version'],
  registers: [metricsRegistry], collect() { this.set({ version: process.env.APP_VERSION || 'local' }, 1); } });

export const monitorQueues = queues => {
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try { await Promise.all(queues.map(async queue => {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        // One bounded read only for the FIFO click queue; no payload labels or full queue scans.
        if (queue.name === 'click-queue') {
          const [head] = Number(counts.waiting || 0) > 0 ? await queue.getWaiting(0, 0) : [];
          const timestamp = Number(head?.timestamp || 0);
          if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('Invalid waiting job timestamp');
          oldestWaitingCreated.set({ queue: queue.name }, timestamp / 1000);
        }
        for (const [state, count] of Object.entries(counts)) queueDepth.set({ queue: queue.name, state }, count);
        queuePollSuccess.set({ queue: queue.name }, 1);
      } catch { queuePollSuccess.set({ queue: queue.name }, 0); }
    })); } finally { polling = false; }
  };
  void poll();
  const timer = setInterval(poll, 15000); timer.unref();
  return () => clearInterval(timer);
};

export const redisErrorsTotal = new client.Counter({
  name: "pburls_redis_errors_total",
  help: "Total Redis client errors",
  labelNames: ["client"],
  registers: [metricsRegistry],
});

export const redisCacheHitsTotal = new client.Counter({
  name: "pburls_redis_cache_hits_total",
  help: "Total Redis cache hits",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

export const redisCacheMissesTotal = new client.Counter({
  name: "pburls_redis_cache_misses_total",
  help: "Total Redis cache misses",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

export const startMetricsServer = (port) => {
  const server = http.createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    try {
      res.setHeader("Content-Type", metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
    } catch { res.writeHead(500); res.end('Metrics collection failed'); }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Metrics server listening on port ${port}`);
  });

  return server;
};

export const recordBusinessOperation = (domain, operation, outcome) => {
  businessOperationsTotal.inc({ domain, operation, outcome });
};

export const recordCacheHit = (cacheName = "url_cache") => {
  redisCacheHitsTotal.inc({ cache_name: cacheName });
};

export const recordCacheMiss = (cacheName = "url_cache") => {
  redisCacheMissesTotal.inc({ cache_name: cacheName });
};
