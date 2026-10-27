// Linux Docker bridge gateways cannot reach ports published only on host loopback.
// Keep smoke listeners private and let a local Linux load generator share host networking.
export function k6Network(rawUrl, { platform, native = false }) {
  const target = new URL(rawUrl);
  const local = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(target.hostname);
  if (native || !local) return { target: target.toString(), args: [] };
  if (platform === 'linux') {
    if (target.hostname === 'host.docker.internal') target.hostname = '127.0.0.1';
    return { target: target.toString(), args: ['--network', 'host'] };
  }
  // Docker Desktop routes this special hostname to its host OS.
  target.hostname = 'host.docker.internal';
  return { target: target.toString(), args: ['--add-host', 'host.docker.internal:host-gateway'] };
}
