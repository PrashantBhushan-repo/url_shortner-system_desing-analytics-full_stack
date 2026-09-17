import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import app from "../src/app.js";
import { metricsRegistry, startMetricsServer } from "../src/telemetry/metrics.js";

const appServer = app.listen(0);
const metricsServer = startMetricsServer(0);
await once(appServer, "listening");
await once(metricsServer, "listening");

const request = (port, path) => new Promise((resolve, reject) => {
  const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode, body }));
  });
  req.on("error", reject);
});

try {
  const appPort = appServer.address().port;
  const metricsPort = metricsServer.address().port;
  const health = await request(appPort, "/health");
  const metrics = await request(metricsPort, "/metrics");

  assert.equal(health.status, 200);
  assert.equal(metrics.status, 200);
  assert.match(metrics.body, /pburls_http_requests_total/);
  assert.match(metrics.body, /pburls_process_cpu_user_seconds_total/);
  assert.match(await metricsRegistry.metrics(), /service="pburls-backend"/);
  console.log("Metrics endpoint and default process metrics passed.");
} finally {
  await new Promise((resolve) => appServer.close(resolve));
  await new Promise((resolve) => metricsServer.close(resolve));
}
