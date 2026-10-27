import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { backendRoot, loadEnvironment, validateEnvironment } from '../src/config/environment.js';

function fixture(t, files) {
  const prefix = path.join(os.tmpdir(), 'pburls-env-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => {
    assert.ok(root.startsWith(prefix));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(root, name), contents);
  return root;
}

test('development resolves by priority without overwriting injected variables', t => {
  const root = fixture(t, {
    '.env': 'LEGACY=yes\nJWT_SECRET=legacy\n', '.env.local': 'LOCAL=yes\nJWT_SECRET=local\n',
    '.env.development': 'MODE=yes\nJWT_SECRET=mode\n',
    '.env.development.local': 'JWT_SECRET=private\nPORT=5009\n',
  });
  const env = { PORT: '5010' };
  const result = loadEnvironment({ root, env });
  assert.equal(result.mode, 'development');
  assert.equal(env.JWT_SECRET, 'private');
  assert.equal(env.PORT, '5010');
  assert.equal(env.LEGACY, 'yes');
  assert.equal(env.LOCAL, 'yes');
  assert.equal(env.MODE, 'yes');
});

test('production and test never inherit generic or development secrets', t => {
  const root = fixture(t, {
    '.env': 'JWT_SECRET=legacy\n', '.env.local': 'SMTP_PASS=private-dev\n',
    '.env.development.local': 'DATABASE_URL=dev-db\n',
    '.env.production.local': 'PRODUCTION_SETTING=yes\n', '.env.test': 'TEST_SETTING=yes\n',
  });
  for (const mode of ['production', 'test']) {
    const env = { NODE_ENV: mode };
    loadEnvironment({ root, env });
    assert.equal(env.JWT_SECRET, undefined);
    assert.equal(env.SMTP_PASS, undefined);
    assert.equal(env.DATABASE_URL, undefined);
    assert.equal(env[mode === 'production' ? 'PRODUCTION_SETTING' : 'TEST_SETTING'], 'yes');
  }
});

test('rejects ambiguous environment names and conflicting file modes', t => {
  const root = fixture(t, { '.env.production': 'NODE_ENV=development\n' });
  assert.throws(() => loadEnvironment({ root, env: { NODE_ENV: 'prod' } }), /NODE_ENV/);
  assert.throws(() => loadEnvironment({ root, env: { NODE_ENV: 'production' } }), /conflicts/);
});

const production = () => ({
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:password@db:5432/app',
  REDIS_URL: 'redis://redis:6379', JWT_SECRET: 'a'.repeat(64),
  BASE_URL: 'https://short.company.test', CLIENT_URL: 'https://short.company.test', TRUST_PROXY: 'false',
});

test('production accepts explicit valid runtime settings without a file', () => {
  assert.doesNotThrow(() => validateEnvironment(production()));
});

test('production rejects missing secrets, placeholders, HTTP, invalid ports and flags', () => {
  assert.throws(() => validateEnvironment({ NODE_ENV: 'production' }), /DATABASE_URL/);
  for (const change of [
    { JWT_SECRET: 'REPLACE_ME_WITH_A_LONG_PRODUCTION_SECRET' }, { CLIENT_URL: 'http://localhost:5173' },
    { DATABASE_URL: 'mysql://user:password@db/app' }, { PORT: '5000oops' },
    { SMTP_SECURE: 'yes' }, { BYPASS_EMAIL_ERROR: 'true' },
  ]) assert.throws(() => validateEnvironment({ ...production(), ...change }), /Invalid environment/);
});

test('validation errors never contain secret values or credential URLs', () => {
  const secret = 'very-private-token';
  try { validateEnvironment({ ...production(), DATABASE_URL: secret, JWT_SECRET: secret }); }
  catch (error) { assert.equal(error.message.includes(secret), false); return; }
  assert.fail('Expected invalid settings to fail');
});

test('loader locates backend independently of the current working directory', () => {
  assert.equal(path.basename(path.normalize(backendRoot).replace(/[\\/]$/, '')), 'backend');
  const output = execFileSync(process.execPath, [path.join(backendRoot, 'scripts/env.mjs'), 'test', '--check'], {
    cwd: os.tmpdir(), env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8',
  });
  assert.match(output, /valid \(test\)/);
});

test('Docker database initialization and application credentials must agree', () => {
  const settings = { ...production(), BACKEND_ENV_FILE: './.env', DB_USER: 'user', DB_PASSWORD: 'password', DB_NAME: 'app' };
  assert.doesNotThrow(() => validateEnvironment(settings));
  assert.throws(() => validateEnvironment({ ...settings, DB_PASSWORD: 'different-private-password' }), /DB_PASSWORD conflicts/);
});
// Observability ratios are validated separately from secret/URL requirements.
test('observability flags and sampling ratios reject invalid configuration', () => {
  for (const settings of [
    { OBSERVABILITY_ENABLED: 'yes' }, { OBS_TRACE_SAMPLE_RATIO: '2' },
    { OBS_REQUEST_LOG_SAMPLE_RATIO: '-0.1' }, { OTEL_TRACES_SAMPLER_ARG: 'NaN' },
  ]) assert.throws(() => validateEnvironment({ NODE_ENV: 'test', ...settings }), /must be/);
  assert.doesNotThrow(() => validateEnvironment({ NODE_ENV: 'test', OBSERVABILITY_ENABLED: 'true', OBS_TRACE_SAMPLE_RATIO: '0.1', OBS_REQUEST_LOG_SAMPLE_RATIO: '1' }));
});
