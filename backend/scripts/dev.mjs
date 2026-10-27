import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { backendRoot } from '../src/config/environment.js';
import { nativeDevelopmentEnvironment } from '../src/config/nativeDevelopment.js';

const mode = process.argv[2];
if (!['backend', 'worker', 'setup', 'check'].includes(mode)) throw new Error('Usage: node scripts/dev.mjs backend|worker|setup|check');
// Read only the Docker connection configuration; never inject its app settings or print secrets.
const dockerFile = path.resolve(backendRoot, '../.env');
const dockerEnv = fs.existsSync(dockerFile) ? dotenv.parse(fs.readFileSync(dockerFile)) : {};
const env = nativeDevelopmentEnvironment({ role: mode === 'worker' ? 'worker' : 'backend', dockerEnv });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: backendRoot, env, stdio: 'inherit' });
    const forward = signal => child.kill(signal);
    const interrupt = () => forward('SIGINT');
    const terminate = () => forward('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => { cleanup(); resolve(code ?? (signal ? 1 : 0)); });
  });
}

if (mode === 'check') {
  nativeDevelopmentEnvironment({ role: 'worker', dockerEnv });
  console.log('Native backend and worker settings valid. Separate service identities/metrics ports; no connection values displayed.');
} else if (mode === 'setup') {
  // Run explicitly when setting up or changing migrations, never on each hot reload.
  for (const args of [
    ['node_modules/prisma/build/index.js', 'generate'],
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    ['prisma/seed.js'],
    ...(env.ADMIN_SEED_EMAIL ? [['prisma/seedAdmin.js']] : []),
  ]) {
    const code = await run(args);
    if (code !== 0) { process.exitCode = code; break; }
  }
} else {
  console.log(`Native ${mode}: telemetry enabled unless disabled by shell; metrics port ${env.METRICS_PORT}.`);
  const entry = mode === 'worker' ? 'worker/index.js' : 'server.js';
  process.exitCode = await run(['node_modules/nodemon/bin/nodemon.js', '--watch', 'src', '--watch', 'otel.js',
    '--watch', mode === 'worker' ? 'worker' : 'server.js', '--ignore', 'src/generated/**', '--ext', 'js,mjs,json', entry]);
}
