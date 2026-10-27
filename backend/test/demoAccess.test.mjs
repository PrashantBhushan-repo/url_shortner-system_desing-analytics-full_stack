import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { evaluatorBypassController } from "../src/middlewares/retiredDemo.middleware.js";

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.post("/api/auth/evaluator-bypass", evaluatorBypassController);
  server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

for (const body of [{ role: "ADMIN" }, { role: "USER" }, {}, { role: "OWNER" }]) {
  test(`retired bypass never issues a session for ${JSON.stringify(body)}`, async () => {
    const response = await fetch(`${base}/api/auth/evaluator-bypass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("set-cookie"), null);
    const result = await response.json();
    assert.equal(result.success, false);
    assert.equal(result.code, "DEMO_BYPASS_RETIRED");
    assert.equal(result.accessToken, undefined);
    assert.equal(result.data, undefined);
  });
}
