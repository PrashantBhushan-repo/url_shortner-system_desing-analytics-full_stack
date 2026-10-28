// One-time local creation of empty private packages; never publishes application code.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export const kinds = ['backend', 'migration', 'frontend', 'ops'];

export function validate(repository, namespace) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) throw new Error('Use --repository owner/repository.');
  if (!/^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/.test(namespace ?? '') || namespace.length > 200) {
    throw new Error('Use a lowercase --namespace prefix without owner, slash or image suffix.');
  }
}

export async function bootstrap({ repository, namespace, token, fetchImpl = fetch,
  docker = (args, options) => spawnSync('docker', args, options), log = console.log }) {
  validate(repository, namespace);
  if (!token?.trim() || /[\r\n]/.test(token)) throw new Error('Provide a classic PAT with write:packages.');
  const [owner] = repository.toLowerCase().split('/');
  async function api(endpoint) {
    let response;
    try { response = await fetchImpl(`https://api.github.com/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'pburls-private-bootstrap' },
      signal: AbortSignal.timeout(20000),
    }); } catch { throw new Error('Cannot reach GitHub API; check connectivity before retrying.'); }
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}: check token identity and write:packages permission.`);
    return response.json();
  }
  const user = await api('user');
  const repo = await api(`repos/${repository}`);
  if (!repo || !user || repo.owner?.login?.toLowerCase() !== owner) throw new Error('Cannot verify repository ownership.');
  if (repo.owner.type !== 'User' || user.login?.toLowerCase() !== owner) {
    throw new Error('This local setup requires a personal-account repository and its owner\'s token.');
  }
  const packagePath = kind => `users/${owner}/packages/container/${namespace}-${kind}`;
  const pending = [];
  // Inspect ALL packages before performing any writes. Never reuse a public name.
  for (const kind of kinds) {
    const pkg = await api(packagePath(kind));
    if (pkg && pkg.visibility !== 'private') throw new Error(`${namespace}-${kind} is not private. Choose a genuinely unused namespace; no packages were changed.`);
    if (!pkg) pending.push(kind);
  }
  log(`Package namespace: ${namespace}`);
  const directory = await mkdtemp(path.join(tmpdir(), 'pburls-ghcr-'));
  const image = `pburls-bootstrap-local:${randomBytes(6).toString('hex')}`;
  const command = (args, input) => {
    const result = docker(['--config', directory, ...args], {
      input, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, DOCKER_CONFIG: directory, GHCR_SETUP_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '' },
    });
    if (result.error || result.status !== 0) throw new Error(`Docker ${args[0]} failed. Check Docker Desktop, internet access and the token's write:packages permission.`);
  };
  try {
    if (pending.length) {
      // No source-repository label and no application files in this first publication.
      // Login configuration is outside the build context: stream only the Dockerfile.
      command(['build', '--platform', 'linux/amd64', '--tag', image, '-'],
        'FROM scratch\nLABEL org.opencontainers.image.title="PBUrls private package placeholder"\nCMD ["/placeholder-not-for-deployment"]\n');
      command(['login', 'ghcr.io', '--username', owner, '--password-stdin'], token + '\n');
      for (const kind of pending) {
        const target = `ghcr.io/${owner}/${namespace}-${kind}:private-bootstrap`;
        command(['tag', image, target]);
        command(['push', target]);
        const pkg = await api(packagePath(kind));
        if (pkg?.visibility !== 'private') throw new Error(`STOP: ${namespace}-${kind} did not report private visibility after publication. Do not start CI; inspect the package settings or contact GitHub support.`);
        log(`Verified private: ${namespace}-${kind}`);
      }
    }
    // Recheck every package, including existing packages skipped above.
    for (const kind of kinds) {
      if ((await api(packagePath(kind)))?.visibility !== 'private') throw new Error(`Private verification failed for ${namespace}-${kind}.`);
    }
  } finally {
    // Remove only our verified temporary directory, including temporary Docker login.
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('pburls-ghcr-')) {
      throw new Error('Refusing cleanup outside the private bootstrap temporary directory.');
    }
    await rm(directory, { recursive: true, force: true });
  }
  log('All four packages verified PRIVATE. Application code was not uploaded.');
  for (const kind of kinds) log(`https://github.com/users/${owner}/packages/container/package/${namespace}-${kind}`);
  log(`NEXT: In EACH package's settings, add ${repository} under Manage Actions access with Write access. Keep inherited access disabled.`);
  log(`THEN: set repository variable GHCR_PACKAGE_NAMESPACE=${namespace}, and start a new CI run on main. Revoke the one-time setup PAT afterward.`);
}

async function hiddenToken() {
  if (process.env.GHCR_SETUP_TOKEN) return process.env.GHCR_SETUP_TOKEN;
  if (!process.stdin.isTTY) throw new Error('Run in an interactive terminal to enter the setup PAT, or provide GHCR_SETUP_TOKEN temporarily.');
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write('Paste the one-time classic PAT (hidden; press Enter): ');
  try { return await terminal.question(''); }
  finally { terminal.close(); process.stdout.write('\n'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { repository: { type: 'string' }, namespace: { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) {
      console.log('node infrastructure/scripts/bootstrap-ghcr.mjs --repository owner/repo [--namespace unused-prefix]\nRequires Docker Desktop and a one-time classic PAT with write:packages. PAT input is hidden. No application images, AWS resources, existing packages or repository settings are changed.');
    } else {
      const namespace = values.namespace || `pburls-private-${randomBytes(6).toString('hex')}`;
      validate(values.repository, namespace);
      await bootstrap({ repository: values.repository, namespace, token: await hiddenToken() });
    }
  } catch (error) {
    // Never print raw HTTP/Docker responses or token-bearing request objects.
    console.error(error instanceof Error ? error.message : 'Private package setup failed.');
    process.exitCode = 1;
  }
}
