import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertChecks, alertThresholds } from '../observability/alert-rules.mjs';

test('threshold overrides are bounded, typed and validated before provisioning', () => {
  assert.equal(alertThresholds().redirectP95Seconds, 0.25);
  assert.equal(alertThresholds('{"redirectP95Seconds":0.5}').redirectP95Seconds, 0.5);
  for (const value of ['[]', 'null', '{"unknown":1}', '{"httpMinRequests":"100"}', '{"windowMinutes":0}', '{"windowMinutes":61}', '{"failedJobs":0.5}', '{"redirectP95Seconds":-1}', '{"httpErrorRatio":1}', '{"httpMinErrors":101}']) {
    assert.throws(() => alertThresholds(value), undefined, value);
  }
  assert.throws(() => alertChecks('production"} or vector(1)'));
});

test('tuned rules preserve resource identities and separate retries from failed-state jobs', () => {
  const rules = alertChecks('production');
  assert.equal(rules.length, 11);
  assert.equal(new Set(rules.map(rule => rule[0])).size, 11);
  const failures = rules.find(rule => rule[0] === 'queue-errors');
  assert.match(failures[2], /state="failed"/);
  assert.doesNotMatch(failures[2], /pburls_queue_jobs_total/);
  assert.match(failures[2], /pburls_queue_poll_success/);
  assert.equal(failures[4], '5m');
  const errors = rules.find(rule => rule[0] === 'server-errors');
  assert.match(errors[2], /clamp_min/);
  assert.match(errors[2], />= 100/);
  assert.match(errors[2], />= 5/);
  const latency = rules.find(rule => rule[0] === 'redirect-slow');
  assert.match(latency[2], /_count/);
  const backlog = rules.find(rule => rule[0] === 'queue-backlog');
  assert.match(backlog[2], /time\(\) - /);
  assert.match(backlog[2], /timestamp_seconds/);
  assert.match(backlog[2], /and on\(queue\)/);
  assert.equal(backlog[4], '2m');
});
