import http from "http";
import client from "prom-client";

const serviceName = process.env.OTEL_SERVICE_NAME || (
  process.env.IS_CHILD_WORKER === "true" ? "pburls-worker" : "pburls-backend"
);

export const metricsRegistry = new client.Registry();
metricsRegistry.setDefaultLabels({ service: serviceName });
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

export const redisErrorsTotal = new client.Counter({
  name: "pburls_redis_errors_total",
  help: "Total Redis client errors",
  labelNames: ["service"],
  registers: [metricsRegistry],
});

export const startMetricsServer = (port) => {
  const server = http.createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Metrics server listening on port ${port}`);
  });

  return server;
};

export const recordBusinessOperation = (domain, operation, outcome) => {
  businessOperationsTotal.inc({ domain, operation, outcome });
};
