import './src/config/config.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PrivateTraceExporter } from './src/telemetry/privacy.js';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const getOtlpBase = () => {
  const host = process.env.OTEL_COLLECTOR_HOST || 'localhost';
  const port = process.env.OTEL_COLLECTOR_PORT || '4318';
  return (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || `http://${host}:${port}`)
    .replace(/\/+$/, '').replace(/\/v1\/(traces|logs|metrics)$/, '');
};
export const getOtlpTracesEndpoint = () => process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || `${getOtlpBase()}/v1/traces`;
export const getOtlpLogsEndpoint = () => process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || `${getOtlpBase()}/v1/logs`;

// Export telemetry only when explicitly enabled alongside a collector.
const telemetryEnabled = process.env.OTEL_SDK_DISABLED === 'false';
const tracesEndpoint = getOtlpTracesEndpoint();

const sdk = new NodeSDK({
  resourceDetectors: [],
  resource: resourceFromAttributes({
    'deployment.environment.name': process.env.NODE_ENV || 'development',
    'service.version': process.env.APP_VERSION || 'local',
  }),
  serviceName: process.env.OTEL_SERVICE_NAME || (
    process.env.IS_CHILD_WORKER === 'true' ? 'pburls-worker' : 'pburls-backend'
  ),
  traceExporter: telemetryEnabled
    ? new PrivateTraceExporter(new OTLPTraceExporter({
        url: tracesEndpoint,
        timeoutMillis: 5000,
      }))
    : undefined,
  // Prometheus is the single metrics source; do not export duplicate SDK metrics.
  metricReaders: [],
  logRecordProcessors: telemetryEnabled ? [new BatchLogRecordProcessor({
    exporter: new OTLPLogExporter({
      url: getOtlpLogsEndpoint(),
      timeoutMillis: 5000,
    }),
    maxQueueSize: 2048, maxExportBatchSize: 256, scheduledDelayMillis: 1000,
    exportTimeoutMillis: 5000,
  })] : [],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: req => /^\/(health|ready|metrics)(\?|$)/.test(req.url || ''),
      },
      '@opentelemetry/instrumentation-ioredis': { enabled: true, requireParentSpan: false },
    }),
    new PrismaInstrumentation(),
  ],
});

if (telemetryEnabled) {
  sdk.start();
}

export const shutdownTelemetry = () => telemetryEnabled ? sdk.shutdown() : Promise.resolve();

