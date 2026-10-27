import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import execution from 'k6/execution';
const latency = new Trend('redirect_latency', true);
const failed = new Rate('redirect_failures');
const requests = new Counter('redirect_requests');
// Use the generator's actual request timestamps, excluding image/init time.
const started = new Trend('redirect_request_started_unix_ms');
const finished = new Trend('redirect_request_finished_unix_ms');
const rate = Number(__ENV.RATE || 1);
export const options = {
  discardResponseBodies: true,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  scenarios: {
    // One continuous scenario avoids canceling requests at a warmup boundary.
    measure: { executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration: `${Number(__ENV.DURATION || 60) + 10}s`, preAllocatedVUs: 10, maxVUs: 100, gracefulStop: '10s' },
  },
  thresholds: {
    redirect_failures: ['rate<0.01'],
    redirect_latency: [`p(95)<${__ENV.P95_BUDGET_MS || 250}`],
    'dropped_iterations{scenario:measure}': ['count==0'],
  },
};
function request() {
  return http.get(__ENV.TARGET_URL, { redirects: 0, timeout: '10s', tags: { name: 'GET /r/:shortCode' } });
}
export default function () {
  const requestStart = Date.now();
  const measured = requestStart - execution.scenario.startTime >= 10000;
  const response = request();
  if (!measured) return;
  latency.add(response.timings.duration);
  failed.add(![301, 302, 307, 308].includes(response.status));
  requests.add(1);
  started.add(requestStart);
  finished.add(Date.now());
}
export function handleSummary(data) { return { [__ENV.SUMMARY_PATH || '/results/k6.json']: JSON.stringify({ ...data, pburls: { finished_at_ms: Date.now() } }, null, 2) }; }
