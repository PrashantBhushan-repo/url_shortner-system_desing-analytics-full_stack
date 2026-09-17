import './src/config/config.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { PrismaInstrumentation } from '@prisma/instrumentation';

export const getOtlpTracesEndpoint = () => {
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  }
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '');
    return base.endsWith('/v1/traces') ? base : `${base}/v1/traces`;
  }
  const host = process.env.OTEL_COLLECTOR_HOST || 'localhost';
  const port = process.env.OTEL_COLLECTOR_PORT || '4318';
  return `http://${host}:${port}/v1/traces`;
};

const telemetryEnabled = process.env.OTEL_SDK_DISABLED !== 'true';
const endpoint = getOtlpTracesEndpoint();

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || (
    process.env.IS_CHILD_WORKER === 'true' ? 'pburls-worker' : 'pburls-backend'
  ),
  traceExporter: telemetryEnabled
    ? new OTLPTraceExporter({
        url: endpoint,
      })
    : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-ioredis': { enabled: true, requireParentSpan: false },
    }),
    new PrismaInstrumentation(),
  ],
});

if (telemetryEnabled) {
  sdk.start();
}

process.on('SIGTERM', () => {
  if (telemetryEnabled) {
    sdk.shutdown().catch((err) => console.error('OTEL shutdown error', err));
  }
});

