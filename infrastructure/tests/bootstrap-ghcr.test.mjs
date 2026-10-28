import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { bootstrap, kinds } from '../scripts/bootstrap-ghcr.mjs';

function fixture({ initial = {}, published = 'private', login = 'owner', apiStatus, transportError } = {}) {
  const packages = new Map(Object.entries(initial));
  const calls = [], output = [];
  const options = {
    repository: 'owner/repo', namespace: 'fresh-private', token: 'fake-setup-secret',
    log: value => output.push(value),
    fetchImpl: async (url, request) => {
      assert.equal(request.headers.Authorization, 'Bearer fake-setup-secret');
      if (transportError) throw new Error('fake-setup-secret');
      const endpoint = new URL(url).pathname.slice(1);
      const data = endpoint === 'user' ? { login } : endpoint === 'repos/owner/repo' ? { owner: { login: 'owner', type: 'User' } }
        : packages.has(endpoint.split('/').at(-1)) ? { visibility: packages.get(endpoint.split('/').at(-1)) } : null;
      return { status: apiStatus || (data ? 200 : 404), ok: !apiStatus && !!data, json: async () => data };
    },
    docker: (args, childOptions) => {
      assert.equal(args[0], '--config');
      assert.equal(childOptions.env.GHCR_SETUP_TOKEN, '');
      assert.equal(childOptions.env.GH_TOKEN, '');
      assert.equal(childOptions.env.GITHUB_TOKEN, '');
      assert.ok(!args.some(arg => arg.includes('fake-setup-secret')));
      calls.push({ args, options: childOptions });
      if (args[2] === 'push') packages.set(args[3].split('/').at(-1).split(':')[0], published);
      return { status: 0 };
    },
  };
  return { options, calls, output, packages };
}

test('private bootstrap publishes only empty unlabeled placeholders and erases temporary login', async () => {
  const f = fixture();
  await bootstrap(f.options);
  assert.equal(f.calls.filter(c => c.args[2] === 'push').length, 4);
  assert.equal(f.calls.filter(c => c.args[2] === 'build').length, 1);
  const build = f.calls.find(c => c.args[2] === 'build');
  assert.ok(build.options.input.startsWith('FROM scratch\n'));
  assert.ok(!/COPY|ADD|org.opencontainers.image.source/.test(build.options.input));
  assert.equal(build.args.at(-1), '-');
  assert.equal(f.calls.find(c => c.args[2] === 'login').options.input, 'fake-setup-secret\n');
  for (const kind of kinds) assert.equal(f.packages.get(`fresh-private-${kind}`), 'private');
  assert.ok(f.output.some(line => line.includes('GHCR_PACKAGE_NAMESPACE=fresh-private')));
  assert.ok(!f.output.join('\n').includes('fake-setup-secret'));
  await assert.rejects(access(build.args[1]), { code: 'ENOENT' });
});

test('any existing public package stops setup before login or writes', async () => {
  const f = fixture({ initial: { 'fresh-private-ops': 'public' } });
  await assert.rejects(bootstrap(f.options), /not private/);
  assert.equal(f.calls.length, 0);
});

test('unexpected public publication stops immediately and clears temporary credentials', async () => {
  const f = fixture({ published: 'public' });
  await assert.rejects(bootstrap(f.options), /STOP.*did not report private/);
  assert.equal(f.calls.filter(c => c.args[2] === 'push').length, 1);
  await assert.rejects(access(f.calls[0].args[1]), { code: 'ENOENT' });
});

test('already private packages are verified without pushing placeholder tags', async () => {
  const f = fixture({ initial: Object.fromEntries(kinds.map(k => [`fresh-private-${k}`, 'private'])) });
  await bootstrap(f.options);
  assert.equal(f.calls.length, 0);
});

test('wrong identity, API denials and transport failures fail before Docker without leaking tokens', async () => {
  for (const settings of [{ login: 'another-owner' }, { apiStatus: 403 }, { transportError: true }]) {
    const f = fixture(settings);
    await assert.rejects(bootstrap(f.options), error => !error.message.includes('fake-setup-secret'));
    assert.equal(f.calls.length, 0);
  }
});

test('Docker failures clean temporary login and never log token-bearing diagnostics', async () => {
  const f = fixture();
  const docker = f.options.docker;
  f.options.docker = (args, options) => {
    docker(args, options);
    return { status: 1, stderr: 'fake-setup-secret' };
  };
  await assert.rejects(bootstrap(f.options), error => /Docker build failed/.test(error.message) && !error.message.includes('fake-setup-secret'));
  await assert.rejects(access(f.calls[0].args[1]), { code: 'ENOENT' });
});

test('invalid repository or namespace cannot reach network or Docker', async () => {
  for (const invalid of [{ repository: 'owner/repo;rm' }, { namespace: '../bad' }, { namespace: 'UPPERCASE' }]) {
    const f = fixture();
    await assert.rejects(bootstrap({ ...f.options, ...invalid }));
    assert.equal(f.calls.length, 0);
  }
});
