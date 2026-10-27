import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createLogger, createServer } from 'vite';
import { createAnalyticsSocket } from '../src/services/analyticsSocket.js';

const { Server } = createRequire(new URL('../../backend/package.json', import.meta.url))('socket.io');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 100; i++) { if (check()) return; await delay(20); }
  assert.fail(message);
}

test('live analytics survives StrictMode cleanup, proxy upgrades and navigation without hiding backend failures', { timeout: 60000 }, async () => {
  const backend = http.createServer((_req, res) => { res.writeHead(200); res.end('backend reachable'); });
  const io = new Server(backend);
  const transports = [], errors = [], opened = new Set();
  let requests = 0;
  backend.on('request', () => { requests++; });
  io.engine.on('connection', connection => transports.push(connection.transport.name));
  io.use((socket, next) => next(socket.handshake.auth.token === 'test-token' ? undefined : new Error('Authentication required')));
  io.on('connection', socket => {
    socket.on('join-url', (id, ack) => {
      ack({ success: id === '42' });
      socket.emit('click-tick', { urlId: id });
    });
  });
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
  const target = `http://127.0.0.1:${backend.address().port}`;
  const logger = createLogger('silent');
  logger.error = message => errors.push(String(message));
  const vite = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    customLogger: logger,
    server: { host: '127.0.0.1', port: 0, strictPort: false, proxy: {
      '/api': { target }, '/r/': { target }, '/socket.io': { target },
    } },
  });
  const open = token => {
    const connection = createAnalyticsSocket('/api', origin, token);
    opened.add(connection);
    return connection;
  };
  let origin;
  try {
    await vite.listen();
    origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const canceled = open('test-token');
    canceled.close(); // React StrictMode's first setup -> cleanup, before connecting.
    await delay(40);
    assert.equal(requests, 0, 'Canceled effect must not open an HTTP/WebSocket transport');

    const live = open('test-token');
    await once(live.socket, 'connect');
    const tick = once(live.socket, 'click-tick');
    const result = await live.socket.timeout(2000).emitWithAck('join-url', '42');
    assert.equal(result.success, true);
    assert.equal((await tick)[0].urlId, '42');
    assert.equal(transports[0], 'polling', 'Initial connection must use the polling handshake');
    await until(() => live.socket.io.engine.transport.name === 'websocket', 'Live connection did not upgrade to WebSocket');
    live.close();
    await until(() => io.engine.clientsCount === 0, 'Navigation left a live connection behind');

    for (let i = 0; i < 12; i++) {
      const short = open('test-token');
      await delay(i % 3 === 0 ? 0 : 10);
      short.close();
    }
    const rejected = open('wrong-token');
    const [error] = await once(rejected.socket, 'connect_error');
    assert.match(error.message, /Authentication required/);
    rejected.close();
    await delay(100);
    // Vite colors the heading and puts the Error on the next line. Only accept
    // read resets from WebSocket teardown; HTTP and other transport errors fail.
    const unexpectedProxyErrors = errors.filter(message => {
      const plain = message.replace(/\u001b\[[0-9;]*m/g, '');
      return plain.includes('proxy') && !/^ws proxy(?: socket)? error:\s*Error: read ECONNRESET(?:\s|$)/i.test(plain);
    });
    assert.deepEqual(unexpectedProxyErrors, [], errors.join('\n'));

    await new Promise(resolve => io.close(resolve));
    const response = await fetch(origin + '/api/probe');
    assert.equal(response.status, 502);
    assert.ok(errors.some(message => message.includes('http proxy error') && message.includes('ECONNREFUSED')), 'Real backend failures must remain visible');
  } finally {
    for (const connection of opened) connection.close();
    await vite.close();
    await new Promise(resolve => io.close(resolve));
    backend.closeAllConnections();
  }
});
