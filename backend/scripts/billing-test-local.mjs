// Local Razorpay sandbox only. Never launches with live keys or a remote DB.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Razorpay from 'razorpay';
import { config } from '../src/config/config.js';
import { initSocket } from '../src/config/socket.js';
import prisma from '../src/config/prismaClient.js';
import { startBillingRecovery } from '../src/services/billingRecovery.js';
import { createBillingOrder, verifyBillingPayment, requestBillingRefund, syncBillingPayment } from '../src/services/billing.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.join(root, '.billing-local');
const host = config.db.connectionString ? new URL(config.db.connectionString).hostname : config.db.host;
if (!config.razorpay.keyId.startsWith('rzp_test_') || !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Sandbox requires test keys and a local database.');
await fs.mkdir(stateDir, { recursive: true });
if (!config.razorpay.webhookSecret) {
  const secret = crypto.randomBytes(32).toString('hex');
  const envPath = path.join(root, '.env.development.local');
  const existing = await fs.readFile(envPath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const line = 'RAZORPAY_WEBHOOK_SECRET=' + secret;
  await fs.writeFile(envPath, /^RAZORPAY_WEBHOOK_SECRET\s*=/m.test(existing) ? existing.replace(/^RAZORPAY_WEBHOOK_SECRET\s*=.*$/m, line) : existing.trimEnd() + '\n' + line + '\n');
  config.razorpay.webhookSecret = secret;
  console.log('Webhook secret stored in backend/.env.development.local (not printed).');
}
const { default: app } = await import('../src/app.js');
const api = app.listen(5000, '127.0.0.1');
await new Promise((resolve, reject) => { api.once('listening', resolve); api.once('error', reject); });
initSocket(api);
const stopRecovery = startBillingRecovery();
console.log('Local API: http://127.0.0.1:5000; PostgreSQL billing recovery active.');

// Expose only the signed webhook route through the temporary tunnel.
const ingress = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/payments/webhook') { res.writeHead(404).end(); return; }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100 * 1024) { res.writeHead(413).end(); return; }
    chunks.push(chunk);
  }
  try {
    const result = await fetch('http://127.0.0.1:5000/api/payments/webhook', {
      method: 'POST', signal: AbortSignal.timeout(4000), body: Buffer.concat(chunks),
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': String(req.headers['x-razorpay-signature'] || ''), 'x-razorpay-event-id': String(req.headers['x-razorpay-event-id'] || '') },
    });
    res.writeHead(result.status, { 'content-type': 'application/json' }).end(await result.text());
  } catch { res.writeHead(503).end(); }
});
await new Promise((resolve, reject) => { ingress.listen(5242, '127.0.0.1', resolve); ingress.once('error', reject); });

const sdk = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
const events = ['payment.captured', 'payment.authorized', 'payment.failed', 'refund.created', 'refund.processed', 'refund.failed'];
let tunnel, registration;
const priorState = JSON.parse(await fs.readFile(path.join(stateDir, 'state.json'), 'utf8').catch(() => '{}'));
const state = { mode: 'test', startedAt: new Date().toISOString(), api: 'http://127.0.0.1:5000', workerPid: process.pid, webhookRegistered: false,
  fixtureUserId: priorState.fixtureUserId, fixturePlanId: priorState.fixturePlanId, testStartedAt: priorState.testStartedAt || priorState.startedAt };
const saveState = () => fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2));
async function register(url) {
  const webhookUrl = url + '/api/payments/webhook';
  state.webhookUrl = webhookUrl;
  try {
    let result;
    // The quick-tunnel URL is printed before its DNS/connection is necessarily
    // ready. Retry URL validation without creating a second webhook after a
    // response is lost; first discover the exact URL with the provider.
    for (let attempt = 0; ; attempt++) {
      try {
        const existing = JSON.parse(await fs.readFile(path.join(stateDir, 'webhook.json'), 'utf8').catch(() => '{}'));
        const listed = existing.id ? null : await sdk.webhooks.all({ count: 100 });
        const id = existing.id || listed?.items?.find(item => item.url === webhookUrl)?.id;
        const payload = { url: webhookUrl, secret: config.razorpay.webhookSecret, events: Object.fromEntries(events.map(event => [event, true])), active: true };
        result = id ? await sdk.webhooks.edit(payload, id) : await sdk.webhooks.create(payload);
        break;
      } catch (error) {
        if (attempt >= 4 || [401, 403].includes(error.statusCode)) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
    await fs.writeFile(path.join(stateDir, 'webhook.json'), JSON.stringify({ id: result.id, url: webhookUrl }, null, 2));
    state.webhookRegistered = true;
    console.log('Razorpay TEST webhook registered: ' + webhookUrl);
  } catch (error) {
    state.registrationError = error.statusCode || 'PROVIDER_UNAVAILABLE';
    console.log('Razorpay webhook registration unavailable: HTTP ' + state.registrationError + '. Dashboard registration may be required.');
  }
  await saveState();
}
if (!process.argv.includes('--no-tunnel')) {
  const binary = path.join(stateDir, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  await fs.access(binary);
  tunnel = spawn(binary, ['tunnel', '--url', 'http://127.0.0.1:5242', '--no-autoupdate', '--protocol', 'http2'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  function tunnelOutput(data) {
    const match = String(data).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !registration) registration = register(match[0]);
  }
  tunnel.stdout.on('data', tunnelOutput); tunnel.stderr.on('data', tunnelOutput);
  tunnel.on('error', () => console.error('Webhook tunnel failed to start.'));
  tunnel.on('exit', code => { state.tunnelExited = code; void saveState(); console.error('Webhook tunnel stopped; restart the local sandbox to restore delivery.'); });
}
await saveState();

// The QA page is private to loopback, random URL, sandbox fixtures only.
let fixture, lastOrder;
const nonce = crypto.randomBytes(18).toString('hex');
const qaPath = '/qa/' + nonce;
const qa = http.createServer(async (req, res) => {
  if (!req.url.startsWith(qaPath)) { res.writeHead(404).end(); return; }
  try {
    if (req.method === 'GET' && req.url === qaPath) {
      if (!fixture) {
        const suffix = crypto.randomUUID();
        const user = await prisma.user.create({ data: { name: 'Razorpay Sandbox QA', email: 'billing-qa-' + suffix + '@example.invalid', emailVerified: true, securityEmailAlerts: false } });
        const plan = await prisma.plan.create({ data: { key: 'qa' + suffix.slice(0, 12), name: 'Sandbox verification', price_monthly: 100, currency: 'INR' } });
        fixture = { user, plan };
        state.fixtureUserId = user.id; state.fixturePlanId = plan.id; state.testStartedAt = new Date().toISOString(); await saveState();
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(`<!doctype html><meta charset="utf-8"><title>Razorpay test verification</title><h1>₹1 sandbox payment</h1><p>Test keys only. Fictional QA account.</p><button id="pay">Pay test ₹1</button><button id="refund">Refund test purchase</button><pre id="status">Ready</pre><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
        const endpoint=${JSON.stringify(qaPath)};
        async function call(action,body={}) {const r=await fetch(endpoint+'/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();document.querySelector('#status').textContent=JSON.stringify(data,null,2);if(!r.ok)throw Error(data.error);return data;}
        document.querySelector('#pay').onclick=async()=>{try{const order=await call('order');const checkout=new Razorpay({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'PBUrls sandbox QA',description:'Isolated ₹1 test',prefill:{name:'Sandbox QA',email:'qa@example.invalid',contact:'9000090000'},handler:async result=>{window.qaCallback=result;document.querySelector('#status').textContent='Provider callback received';if(!window.dropCallback)window.qaVerified=await call('verify',result);}});checkout.open();}catch(e){document.querySelector('#status').textContent=e.message;}};
        document.querySelector('#refund').onclick=async()=>{try{window.qaRefund=await call('refund');}catch(e){document.querySelector('#status').textContent=e.message;}};
        window.qaCall=call;
      </script>`);
      return;
    }
    if (req.method !== 'POST' || !fixture) { res.writeHead(404).end(); return; }
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 8192) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    let result;
    if (req.url === qaPath + '/order') {
      const latest = await prisma.payment.findFirst({ where: { user_id: fixture.user.id, subscription_id: { not: null } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
      await prisma.plan.update({ where: { id: fixture.plan.id }, data: { is_active: true } });
      try { lastOrder = await createBillingOrder(fixture.user.id, { planKey: fixture.plan.key, billingCycle: 'MONTHLY', requestKey: crypto.randomUUID(), expectedPurchaseId: latest?.id || null }); }
      finally { await prisma.plan.update({ where: { id: fixture.plan.id }, data: { is_active: false } }); }
      result = lastOrder;
    } else if (req.url === qaPath + '/verify') {
      const payment = await verifyBillingPayment(fixture.user.id, input);
      result = { id: payment.id, status: payment.status, subscriptionId: payment.subscription_id };
      console.log('Sandbox verified:', JSON.stringify(result));
    } else if (req.url === qaPath + '/refund') {
      const refund = await requestBillingRefund(fixture.user.id, { paymentId: lastOrder.paymentId, reason: 'Isolated sandbox verification', acceptedTerms: true });
      result = { id: refund.id, status: refund.status, gatewayRefundId: refund.gateway_refund_id };
      console.log('Sandbox refund:', JSON.stringify(result));
    } else if (req.url === qaPath + '/status') {
      const payment = await syncBillingPayment(fixture.user.id, lastOrder.paymentId);
      result = { id: payment.id, status: payment.status, refund: payment.refund, subscriptionId: (await prisma.payment.findUnique({ where: { id: payment.id } })).subscription_id };
    } else if (req.url === qaPath + '/expedite-recovery') {
      await prisma.$executeRaw`UPDATE "BillingRecoveryJob" SET due_at = NOW() WHERE id = ${'checkout:' + lastOrder.checkoutId} AND (lease_until IS NULL OR lease_until < NOW())`;
      result = { recoveryScheduled: true };
    } else { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(result));
  } catch (error) { res.writeHead(error.statusCode || 500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: error.message, code: error.errorCode || null })); }
});
await new Promise((resolve, reject) => { qa.listen(5241, '127.0.0.1', resolve); qa.once('error', reject); });
state.qaUrl = 'http://127.0.0.1:5241' + qaPath; await saveState();
console.log('Sandbox QA ready; private URL saved to backend/.billing-local/state.json.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  stopRecovery(); tunnel?.kill(); api.close(); ingress.close(); qa.close();
  if (fixture) await prisma.plan.update({ where: { id: fixture.plan.id }, data: { is_active: false } }).catch(() => {});
  await prisma.$disconnect(); process.exit(0);
});
