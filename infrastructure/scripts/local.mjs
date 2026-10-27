#!/usr/bin/env node
// Copy bytes into a small, secret-free context; Docker cannot read some OneDrive reparse points.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const fullStack = args.includes('--full-stack');
// --observability remains accepted for existing commands; local telemetry is now on by default.
const filtered = args.filter(arg => !['--observability', '--full-stack'].includes(arg));
const command = filtered.shift() || 'up';
if (!['up', 'build', 'check', 'down', 'stop', 'logs', 'ps'].includes(command)) {
  throw new Error('Usage: node infrastructure/scripts/local.mjs [--full-stack] up|build|check|down|stop|logs|ps [Compose arguments]');
}
if (!fullStack && command === 'build') throw new Error('Native development uses upstream infrastructure images. Use --full-stack build to build application images.');
if (!fullStack && command === 'up' && filtered.some(arg => ['backend', 'worker', 'frontend'].includes(arg))) {
  throw new Error('Application containers require --full-stack. Native development starts only db, redis, alloy and lgtm.');
}
const compose = ['compose', '--project-directory', root, '-f', path.join(root, 'docker-compose.yml'),
  '-f', path.join(root, 'infrastructure/observability/compose.local.yml')];
if (!fullStack) compose.push('-f', path.join(root, 'infrastructure/observability/compose.native.yml'));
// A renamed checkout must keep using the existing DB/Redis Compose project and volumes.
const inventory = spawnSync('docker', ['inspect', '--format', '{{.Name}}|{{index .Config.Labels "com.docker.compose.project"}}', 'pburls_db', 'pburls_redis'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
});
if (inventory.error) throw new Error('Docker is unavailable. Start Docker Desktop before running this command.');
const projects = new Set();
for (const line of (inventory.stdout || '').trim().split('\n').filter(Boolean)) {
  const [, project] = line.trim().split('|');
  if (!project || project === '<no value>') throw new Error('An existing PBUrls database container is not managed by Compose; configure its ownership before starting another stack.');
  projects.add(project);
}
if (projects.size > 1) throw new Error('Existing PostgreSQL and Redis containers belong to different Compose projects.');
const existingProject = [...projects][0];
if (existingProject && process.env.COMPOSE_PROJECT_NAME && existingProject !== process.env.COMPOSE_PROJECT_NAME) {
  throw new Error('COMPOSE_PROJECT_NAME conflicts with the existing database containers.');
}
const projectFile = path.join(root, '.local-compose-project');
let rememberedProject;
try { rememberedProject = (await readFile(projectFile, 'utf8')).trim(); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const project = existingProject || process.env.COMPOSE_PROJECT_NAME || rememberedProject || path.basename(root).toLowerCase().replace(/[^a-z0-9_-]/g, '');
if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error('Invalid local Compose project name');
compose.push('--project-name', project);
// Keep volume selection stable even after `down` removes all discoverable containers.
if (existingProject || command === 'up') await writeFile(projectFile, project + '\n');
const cache = path.resolve(process.env.PBURLS_BUILD_CACHE || path.join(os.tmpdir(), 'pburls-docker-build-contexts'));
async function materialize(app, entries) {
  const files = [];
  async function visit(relative) {
    const name = path.basename(relative);
    if (name === '.env' || name.startsWith('.env.') || ['node_modules', '.billing-local', '.git'].includes(name)) return;
    const absolute = path.join(root, app, relative);
    const info = await stat(absolute);
    if (info.isDirectory()) {
      for (const child of (await readdir(absolute)).sort()) {
        if (app === 'backend' && relative === 'src' && child === 'generated') continue;
        await visit(path.join(relative, child));
      }
    } else if (info.isFile()) files.push([relative, await readFile(absolute)]);
  }
  for (const entry of entries) await visit(entry);
  const hash = createHash('sha256');
  for (const [name, bytes] of files) hash.update(name.replaceAll('\\', '/')).update('\0').update(bytes).update('\0');
  const destination = path.join(cache, `${app}-${hash.digest('hex').slice(0, 20)}`);
  await mkdir(destination, { recursive: true });
  for (const [name, bytes] of files) {
    const target = path.join(destination, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  // Keep empty required COPY directories too.
  if (app === 'frontend') await mkdir(path.join(destination, 'public'), { recursive: true });
  return destination;
}
if (fullStack && ['up', 'build', 'check'].includes(command)) {
  const backend = await materialize('backend', ['.dockerignore', 'Dockerfile', 'package.json', 'package-lock.json', 'server.js', 'otel.js', 'src', 'prisma', 'scripts', 'worker', 'bin']);
  const frontend = await materialize('frontend', ['.dockerignore', 'Dockerfile', 'package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'src', 'public', 'nginx.conf', 'nginx-http.conf', 'nginx-routes.conf', 'nginx-security.conf']);
  const contextId = createHash('sha256').update(root).update(backend).update(frontend).digest('hex').slice(0, 20);
  const override = path.join(cache, `compose-${contextId}.json`);
  await writeFile(override, JSON.stringify({ services: { backend: { build: { context: backend } }, worker: { build: { context: backend } }, frontend: { build: { context: frontend } } } }));
  compose.push('-f', override);
  console.log(`Docker build contexts: ${cache}`);
}
if (!fullStack && command === 'up') {
  // Switching modes must not leave duplicate API/worker consumers running.
  const stopped = spawnSync('docker', [...compose, '--profile', 'container-app', 'stop', 'backend', 'worker', 'frontend'], {
    cwd: root, env: process.env, stdio: 'inherit',
  });
  if (stopped.error || stopped.status !== 0) throw new Error('Could not stop application containers before native development.');
}
if (command === 'check') compose.push('config', '--quiet');
else if (command === 'up') compose.push('up', '-d', ...(fullStack ? ['--build'] : []));
else compose.push(command);
compose.push(...filtered);
if (command === 'up' && !fullStack) compose.push('db', 'redis', 'alloy', 'lgtm');
console.log(fullStack ? 'Local mode: application and observability containers.' : 'Local mode: 4 infrastructure containers; run backend, worker and frontend with npm.');
const child = spawn('docker', compose, { cwd: root, env: process.env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
