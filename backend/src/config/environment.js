import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const modes = ['development', 'production', 'test'];

// Existing process variables always win. Never read files from the caller's cwd.
export function loadEnvironment({ root = backendRoot, env = process.env } = {}) {
  const mode = env.NODE_ENV || 'development';
  if (!modes.includes(mode)) throw new Error('NODE_ENV must be development, production, or test');
  const names = [`.env.${mode}.local`, `.env.${mode}`];
  // Legacy files are development-only: they must never leak into production or CI.
  if (mode === 'development') names.push('.env.local', '.env');
  const loaded = [];
  for (const name of names) {
    const filename = path.join(root, name);
    if (!fs.existsSync(filename)) continue;
    const parsed = dotenv.parse(fs.readFileSync(filename));
    if (parsed.NODE_ENV && parsed.NODE_ENV !== mode) {
      throw new Error(`${name}: NODE_ENV conflicts with selected ${mode} mode`);
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined) env[key] = value;
    }
    loaded.push(name);
  }
  env.NODE_ENV = mode;
  return { mode, loaded };
}

export function validateEnvironment(env = process.env) {
  const errors = [];
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'BASE_URL', 'CLIENT_URL'];
  const production = env.NODE_ENV === 'production';
  const placeholder = /change[-_ ]?me|replace[-_ ]?me|your[-_ ]|super-secret|\.example(?:[/:]|$)/i;
  if (production) {
    for (const key of required) {
      if (!env[key]?.trim() || placeholder.test(env[key])) errors.push(`${key} must be configured for production`);
    }
    if ((env.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET must contain at least 32 characters in production');
    if (env.BYPASS_EMAIL_ERROR === 'true') errors.push('BYPASS_EMAIL_ERROR must not be enabled in production');
    if (!env.TRUST_PROXY) errors.push('TRUST_PROXY must explicitly identify the proxy network or be false in production');
  }
  for (const [key, protocols] of Object.entries({
    DATABASE_URL: ['postgres:', 'postgresql:'], REDIS_URL: ['redis:', 'rediss:'],
    BASE_URL: ['http:', 'https:'], CLIENT_URL: ['http:', 'https:'],
  })) {
    if (!env[key]) continue;
    try {
      const url = new URL(env[key]);
      if (!protocols.includes(url.protocol) || !url.hostname) throw new Error();
      if (production && ['BASE_URL', 'CLIENT_URL'].includes(key) &&
          (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    } catch { errors.push(`${key} must be a valid ${production && ['BASE_URL', 'CLIENT_URL'].includes(key) ? 'public HTTPS ' : ''}URL`); }
  }
  for (const key of ['PORT', 'DB_PORT', 'SMTP_PORT', 'METRICS_PORT']) {
    if (env[key] !== undefined && (!/^\d+$/.test(env[key]) || Number(env[key]) < 1 || Number(env[key]) > 65535)) {
      errors.push(`${key} must be an integer between 1 and 65535`);
    }
  }
  for (const key of ['OTEL_SDK_DISABLED', 'SMTP_SECURE', 'DISABLE_CHILD_WORKER', 'IS_CHILD_WORKER', 'BYPASS_EMAIL_ERROR', 'OBSERVABILITY_ENABLED']) {
    if (env[key] !== undefined && !['true', 'false'].includes(env[key])) errors.push(`${key} must be true or false`);
  }
  for (const key of ['OBS_REQUEST_LOG_SAMPLE_RATIO', 'OBS_TRACE_SAMPLE_RATIO', 'OTEL_TRACES_SAMPLER_ARG']) {
    if (env[key] !== undefined && (!/^(0(?:\.\d+)?|1(?:\.0+)?)$/.test(env[key]))) errors.push(`${key} must be between 0 and 1`);
  }
  const adminFields = ['ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD', 'ADMIN_SEED_NAME'];
  if (adminFields.some(key => env[key]) && adminFields.some(key => !env[key])) {
    errors.push('ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, and ADMIN_SEED_NAME must be set together or all left blank');
  }
  if (env.BACKEND_ENV_FILE && env.DATABASE_URL) {
    try {
      const db = new URL(env.DATABASE_URL);
      const expected = { DB_USER: decodeURIComponent(db.username), DB_PASSWORD: decodeURIComponent(db.password), DB_NAME: decodeURIComponent(db.pathname.slice(1)) };
      for (const [key, value] of Object.entries(expected)) {
        if (env[key] !== undefined && env[key] !== value) errors.push(`${key} conflicts with DATABASE_URL`);
      }
    } catch { /* URL validation above reports invalid connection strings. */ }
  }
  if (errors.length) throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
}
