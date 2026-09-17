import {
  httpErrorsTotal,
  httpRequestDuration,
  httpRequestsTotal,
} from "../telemetry/metrics.js";

const getRoute = (req) => req.route?.path || req.path || "unknown";

export const metricsMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const route = getRoute(req);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
    if (res.statusCode >= 400) httpErrorsTotal.inc(labels);
  });

  next();
};
