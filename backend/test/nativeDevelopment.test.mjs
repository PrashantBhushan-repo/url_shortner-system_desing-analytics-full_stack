import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nativeDevelopmentEnvironment } from '../src/config/nativeDevelopment.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pburls-native-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'pburls-native-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(root, '.env'), 'JWT_SECRET=development-secret\nOTEL_SDK_DISABLED=true\nMETRICS_PORT=9999\nOTEL_SERVICE_NAME=old-shared-service\nOTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://old-collector:4318/v1/traces\n');
  fs.writeFileSync(path.join(root, '.env.production.local'), 'JWT_SECRET=production-secret\n');
  return root;
}
const dockerEnv = { DATABASE_URL: 'postgresql://existing:private%40pass@db:5432/existing_db', REDIS_URL: 'redis://redis:6379', DB_HOST_PORT: '5435', REDIS_HOST_PORT: '6380' };

test('native roles share host connections while keeping worker identity and ports separate', t => {
  const root = fixture(t);
  const backend = nativeDevelopmentEnvironment({ role: 'backend', root, env: {}, dockerEnv });
  const worker = nativeDevelopmentEnvironment({ role: 'worker', root, env: {}, dockerEnv });
  assert.equal(backend.DATABASE_URL, 'postgresql://existing:private%40pass@127.0.0.1:5435/existing_db');
  assert.equal(worker.DATABASE_URL, backend.DATABASE_URL);
  assert.equal(worker.REDIS_URL, 'redis://127.0.0.1:6380');
  assert.equal(backend.METRICS_PORT, '9464');
  assert.equal(worker.METRICS_PORT, '9465');
  assert.equal(backend.OTEL_SERVICE_NAME, 'pburls-backend');
  assert.equal(worker.OTEL_SERVICE_NAME, 'pburls-worker');
  assert.equal(worker.IS_CHILD_WORKER, 'true');
  assert.equal(backend.IS_CHILD_WORKER, 'false');
  assert.equal(backend.DISABLE_CHILD_WORKER, 'true');
  assert.equal(worker.NODE_ENV, 'development');
  assert.equal(worker.JWT_SECRET, 'development-secret');
  assert.equal(worker.BASE_URL, 'http://localhost:5173');
});

test('native telemetry defaults supersede stale shared Docker settings', t => {
  const env = nativeDevelopmentEnvironment({ role: 'backend', root: fixture(t), env: {}, dockerEnv });
  assert.equal(env.OTEL_SDK_DISABLED, 'false');
  assert.equal(env.OTEL_EXPORTER_OTLP_ENDPOINT, 'http://localhost:4318');
  assert.equal(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, '');
  assert.equal(env.OTEL_TRACES_SAMPLER_ARG, '1');
  assert.equal(env.OBS_REQUEST_LOG_SAMPLE_RATIO, '1');
});

test('injected native connections and explicit telemetry overrides retain precedence', t => {
  const injected = { DATABASE_URL: 'postgresql://custom:secret@localhost:5440/custom', REDIS_URL: 'redis://localhost:6381', OTEL_SDK_DISABLED: 'true', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:14318', BACKEND_METRICS_PORT: '19464' };
  const result = nativeDevelopmentEnvironment({ role: 'backend', root: fixture(t), env: injected, dockerEnv });
  for (const key of ['DATABASE_URL', 'REDIS_URL', 'OTEL_SDK_DISABLED', 'OTEL_EXPORTER_OTLP_ENDPOINT']) assert.equal(result[key], injected[key]);
  assert.equal(result.METRICS_PORT, '19464');
  assert.equal(injected.NODE_ENV, undefined, 'Profile must not mutate caller environment');
});

test('rejects conflicting metrics ports and injected Docker-only addresses without revealing secrets', t => {
  const root = fixture(t);
  assert.throws(() => nativeDevelopmentEnvironment({ role: 'backend', root, env: { BACKEND_METRICS_PORT: '9464', WORKER_METRICS_PORT: '9464' }, dockerEnv }), /must differ/);
  assert.throws(() => nativeDevelopmentEnvironment({ role: 'backend', root, env: { DATABASE_URL: 'postgresql://user:PRIVATE_PASSWORD@db:5432/app' }, dockerEnv }), error => error.message.includes('host address') && !error.message.includes('PRIVATE_PASSWORD'));
});
