import {
  httpErrorsTotal,
  httpRequestDuration,
  httpRequestsTotal,
  httpInFlight, httpAborted,
} from "../telemetry/metrics.js";

import { httpRoute, httpMethod, isProbe } from '../telemetry/httpRoute.js';
import { logger } from '../telemetry/logger.js';
import { trace, context } from '@opentelemetry/api';

export const metricsMiddleware = (req, res, next) => {
  if (isProbe(req)) return next();
  const startedAt = process.hrtime.bigint();
  httpInFlight.inc();
  res.once('close', () => {
    httpInFlight.dec();
    if (!res.writableFinished) httpAborted.inc();
  });
  const requestContext = context.active();
  const span = trace.getSpan(requestContext);

  res.on("finish", () => {
    const route = httpRoute(req);
    const labels = {
      method: httpMethod(req),
      route,
      status_code: String(res.statusCode),
    };
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
    if (res.statusCode >= 400) httpErrorsTotal.inc(labels);
    // Retain all server failures; sample successful request logs independently
    // from traces. Trace IDs are searchable fields, never metric labels.
    const rate = Number(process.env.OBS_REQUEST_LOG_SAMPLE_RATIO ?? (process.env.NODE_ENV === 'production' ? 0.1 : 1));
    if (res.statusCode >= 500 || Math.random() < rate) context.with(requestContext, () => {
      logger[res.statusCode >= 500 ? 'error' : 'info']('http.request', {
        ...labels, duration_ms: durationSeconds * 1000,
        trace_sampled: Boolean(span?.spanContext().traceFlags & 1),
      });
    });
  });

  next();
};
