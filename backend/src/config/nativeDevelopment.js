import { backendRoot, loadEnvironment, validateEnvironment } from './environment.js';

// Native-only profile. Never imported by production entry points or Compose services.
export function nativeDevelopmentEnvironment({ role, env = process.env, root = backendRoot, dockerEnv = {} }) {
  if (!['backend', 'worker'].includes(role)) throw new Error('Native role must be backend or worker');
  const injected = { ...env };
  const result = { ...env, NODE_ENV: 'development' };
  loadEnvironment({ root, env: result });

  function connection(key, dockerHost, port, fallback) {
    const value = result[key] || dockerEnv[key] || fallback;
    if (!value) throw new Error(`${key} is required for native development`);
    let url;
    try { url = new URL(value); } catch { throw new Error(`${key} must be a valid connection URL`); }
    // Adapt Docker service DNS only; explicit native/remote connection URLs stay intact.
    if (url.hostname === dockerHost) {
      if (injected[key] !== undefined) throw new Error(`${key} must use a host address when injected into native development`);
      url.hostname = '127.0.0.1';
      url.port = String(port);
    }
    return url.toString();
  }

  const databaseFallback = dockerEnv.DB_PASSWORD ? (() => {
    const url = new URL('postgresql://db/');
    url.username = dockerEnv.DB_USER || 'postgres';
    url.password = dockerEnv.DB_PASSWORD;
    url.pathname = '/' + (dockerEnv.DB_NAME || 'url_shortener');
    return url.toString();
  })() : undefined;
  result.DATABASE_URL = connection('DATABASE_URL', 'db', injected.DB_HOST_PORT || dockerEnv.DB_HOST_PORT || 5435, databaseFallback);
  result.REDIS_URL = connection('REDIS_URL', 'redis', injected.REDIS_HOST_PORT || dockerEnv.REDIS_HOST_PORT || 6379, 'redis://127.0.0.1:6379');
  result.BASE_URL ||= 'http://localhost:5173';
  result.CLIENT_URL ||= 'http://localhost:5173';
  result.TRUST_PROXY = 'loopback';
  result.DISABLE_CHILD_WORKER = 'true';
  result.IS_CHILD_WORKER = String(role === 'worker');
  result.OTEL_SERVICE_NAME = `pburls-${role}`;
  // A common METRICS_PORT must not make two processes bind the same port.
  const backendPort = injected.BACKEND_METRICS_PORT || dockerEnv.BACKEND_METRICS_PORT || 9464;
  const workerPort = injected.WORKER_METRICS_PORT || dockerEnv.WORKER_METRICS_PORT || 9465;
  if (Number(backendPort) === Number(workerPort)) throw new Error('Backend and worker metrics ports must differ');
  result.METRICS_PORT = String(role === 'backend' ? backendPort : workerPort);
  result.OTEL_SDK_DISABLED = injected.OTEL_SDK_DISABLED ?? 'false';
  result.OTEL_EXPORTER_OTLP_ENDPOINT = injected.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  result.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = injected.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '';
  result.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = injected.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || '';
  result.OTEL_TRACES_SAMPLER = injected.OTEL_TRACES_SAMPLER || 'parentbased_traceidratio';
  result.OTEL_TRACES_SAMPLER_ARG = injected.OTEL_TRACES_SAMPLER_ARG ?? '1';
  result.OBS_REQUEST_LOG_SAMPLE_RATIO = injected.OBS_REQUEST_LOG_SAMPLE_RATIO ?? '1';
  validateEnvironment(result);
  return result;
}
