import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("pburls-backend");

export const requestTracing = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const span = trace.getActiveSpan();

  res.on("finish", () => {
    if (!span) return;

    const route = req.route?.path || req.path;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    span.setAttributes({
      "http.route": route,
      "http.response.status_code": res.statusCode,
      "http.server.duration_ms": Number(durationMs.toFixed(2)),
    });

    if (res.statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
    }
  });

  next();
};