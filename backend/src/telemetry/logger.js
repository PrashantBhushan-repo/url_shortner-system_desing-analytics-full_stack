import { trace, context } from "@opentelemetry/api";
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
const allowed = new Set(['method', 'route', 'status_code', 'duration_ms', 'queue', 'outcome', 'wait_seconds', 'trace_sampled', 'error_type']);

const serviceName = process.env.OTEL_SERVICE_NAME || (
  process.env.IS_CHILD_WORKER === "true" ? "pburls-worker" : "pburls-backend"
);

export const log = (level, message, meta = {}) => {
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();

  const logPayload = {
    timestamp: new Date().toISOString(),
    level,
    service: serviceName,
    traceId: spanContext?.traceId || null,
    spanId: spanContext?.spanId || null,
    message,
    ...Object.fromEntries(Object.entries(meta).filter(([key]) => allowed.has(key))),
  };

  console.log(JSON.stringify(logPayload));
  logs.getLogger('pburls').emit({
    severityNumber: ({ error: SeverityNumber.ERROR, warn: SeverityNumber.WARN, debug: SeverityNumber.DEBUG })[level] || SeverityNumber.INFO,
    severityText: level.toUpperCase(), body: message,
    attributes: Object.fromEntries(Object.entries(logPayload).filter(([, value]) => value !== null)),
  });
};

export const logger = {
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};
