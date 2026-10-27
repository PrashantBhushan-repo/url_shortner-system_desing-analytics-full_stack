#!/usr/bin/env bash
set -Eeuo pipefail
export BACKEND_IMAGE=$1 MIGRATION_IMAGE=$2 FRONTEND_IMAGE=$3
export SMOKE_DIR
SMOKE_DIR=$(mktemp -d /tmp/pburls-smoke.XXXXXX)
project="pburls-smoke-${GITHUB_RUN_ID:-$$}"
root=$(cd "$(dirname "$0")/../.." && pwd)
compose=(docker compose --env-file /dev/null -p "$project" -f "$root/infrastructure/compose.smoke.yml")
if [[ ${OBSERVABILITY_SMOKE:-false} == true ]]; then
  compose+=(-f "$root/infrastructure/observability/compose.smoke.yml")
fi
if [[ ${BENCHMARK_SMOKE:-false} == true ]]; then
  [[ ${OBSERVABILITY_SMOKE:-false} == true ]] || { echo 'BENCHMARK_SMOKE requires OBSERVABILITY_SMOKE'; exit 1; }
  compose+=(-f "$root/infrastructure/observability/compose.benchmark.yml")
fi
cleanup() {
  code=$?
  mkdir -p "$root/.artifacts/observability"
  python3 - "$root/.artifacts/observability/${project//[^a-zA-Z0-9_-]/_}-result.json" "$code" <<'PY'
import datetime, json, os, pathlib, sys
pathlib.Path(sys.argv[1]).write_text(json.dumps({
    'finished_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'passed' if sys.argv[2] == '0' else 'failed',
    'exit_code': int(sys.argv[2]),
    'images': {key: os.environ.get(key) for key in ['BACKEND_IMAGE', 'MIGRATION_IMAGE', 'FRONTEND_IMAGE']},
    'observability': os.environ.get('OBSERVABILITY_SMOKE') == 'true',
    'benchmark': os.environ.get('BENCHMARK_SMOKE') == 'true',
}, indent=2) + '\n')
PY
  if [[ $code -ne 0 ]]; then
    mkdir -p "$root/.artifacts/observability"
    logfile="$root/.artifacts/observability/${project//[^a-zA-Z0-9_-]/_}.log"
    "${compose[@]}" logs --no-color --tail 200 > "$logfile" 2>&1 || true
    cat "$logfile"
    echo "Smoke diagnostics saved to $logfile"
  fi
  "${compose[@]}" down -v --remove-orphans
  [[ $SMOKE_DIR == /tmp/pburls-smoke.* ]] && rm -rf -- "$SMOKE_DIR"
  exit "$code"
}
trap cleanup EXIT
mkdir -p "$SMOKE_DIR/certificates/live/smoke.company.test"
cert="$SMOKE_DIR/certificates/live/smoke.company.test"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=smoke.company.test' \
  -addext 'subjectAltName=DNS:smoke.company.test' -keyout "$cert/privkey.pem" -out "$cert/fullchain.pem" 2>/dev/null
sed 's/__DOMAIN__/smoke.company.test/g' "$root/infrastructure/nginx/https.conf.template" > "$SMOKE_DIR/default.conf"
if [[ ${BENCHMARK_SMOKE:-false} == true ]]; then
  cat >> "$SMOKE_DIR/default.conf" <<'NGINX'
server {
  listen 8080;
  server_name _;
  include /etc/nginx/snippets/pburls-routes.conf;
}
NGINX
fi
"${compose[@]}" up -d --wait --wait-timeout 120 db redis
"${compose[@]}" run --rm migrate
if [[ ${OBSERVABILITY_SMOKE:-false} == true ]]; then
  "${compose[@]}" run --rm --no-deps -e OBS_POSTGRES_PASSWORD=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    --entrypoint node migrate scripts/prepare-monitoring.mjs
  "${compose[@]}" up -d lgtm alloy
fi
"${compose[@]}" up -d --wait --wait-timeout 180 backend worker frontend
"${compose[@]}" exec -T frontend nginx -t
curl_tls=(curl --noproxy '*' --fail --silent --show-error --cacert "$cert/fullchain.pem" --resolve smoke.company.test:18443:127.0.0.1)
"${curl_tls[@]}" https://smoke.company.test:18443/dashboard -o /dev/null
"${curl_tls[@]}" https://smoke.company.test:18443/api/plans > "$SMOKE_DIR/plans.json"
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data' "$SMOKE_DIR/plans.json"
for route in ready metrics assets/not-found.js; do
  [[ $(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' --cacert "$cert/fullchain.pem" --resolve smoke.company.test:18443:127.0.0.1 "https://smoke.company.test:18443/$route") == 404 ]]
done
curl --noproxy '*' -sI http://127.0.0.1:18080/dashboard | grep -qi 'location: https://smoke.company.test/dashboard'
"${curl_tls[@]}" -I https://smoke.company.test:18443/ | grep -qi 'strict-transport-security:'
# Real redirect -> BullMQ -> worker -> persisted click, inside a disposable database.
"${compose[@]}" exec -T backend node --input-type=module <<'JS'
import { PrismaClient } from './src/generated/prisma/index.js';
const db = new PrismaClient();
try {
  const user = await db.user.create({data:{name:'CI smoke',email:'smoke@company.test',role:'USER'}});
  await db.url.create({data:{user_id:user.id,short_code:'SmokeCI42',long_url:'https://example.com/smoke'}});
} finally { await db.$disconnect(); }
JS
"${curl_tls[@]}" -D "$SMOKE_DIR/redirect.headers" https://smoke.company.test:18443/r/SmokeCI42 -o /dev/null
grep -qi 'location: https://example.com/smoke' "$SMOKE_DIR/redirect.headers"
"${compose[@]}" exec -T backend node --input-type=module <<'JS'
import { PrismaClient } from './src/generated/prisma/index.js';
const db = new PrismaClient();
try {
  for (let i=0;i<30;i++) {
    const link=await db.url.findFirst({where:{short_code:'SmokeCI42'}});
    if(await db.click.count({where:{url_id:link.id}})>0) process.exitCode=0;
    else { await new Promise(r=>setTimeout(r,1000)); continue; }
    console.log('Redirect and worker persistence verified'); break;
  }
  const link=await db.url.findFirst({where:{short_code:'SmokeCI42'}});
  if(await db.click.count({where:{url_id:link.id}})===0) throw new Error('Worker did not persist click');
} finally { await db.$disconnect(); }
JS
echo 'Container, TLS, routing, readiness, redirect, and worker smoke tests passed.'
if [[ ${OBSERVABILITY_SMOKE:-false} == true ]]; then
  cd "$root"
  node infrastructure/observability/smoke.mjs
fi
if [[ ${BENCHMARK_SMOKE:-false} == true ]]; then
  OBS_ENVIRONMENT=production \
  PROMETHEUS_QUERY_URL=http://127.0.0.1:13001/api/datasources/proxy/uid/prometheus/api/v1/query_range \
  BENCHMARK_NOTES='Disposable production images; local HTTP through Nginx; warm cache; 1 RPS; functional measurement baseline, not capacity; TLS verified separately.' \
  P95_BUDGET_MS=2000 \
    node "$root/infrastructure/observability/benchmark.mjs" run image-smoke-baseline http://127.0.0.1:18081/r/SmokeCI42 1 60 | tee "$SMOKE_DIR/benchmark.log"
  expected_clicks=$(python3 - "$SMOKE_DIR/benchmark.log" <<'PY'
import json, pathlib, sys
lines = pathlib.Path(sys.argv[1]).read_text().splitlines()
record_file = pathlib.Path(next(line[8:] for line in reversed(lines) if line.startswith('Result: ')))
record = json.loads(record_file.read_text())
metrics = json.loads((record_file.parent / 'server-metrics.json').read_text())
errors = [name for name, value in metrics.items() if value.get('error')]
assert not errors, 'Server metric queries failed: ' + ', '.join(errors)
assert metrics['process_memory_bytes']['count'] > 0, 'Application resource samples missing'
assert metrics['app_scrape_up']['min'] == 1, 'Application scrape failed during the measurement'
assert record['passed'] and record['measurements']['failure_fraction'] == 0
summary = json.loads((record_file.parent / 'k6.json').read_text())
# Include warmup requests and the one redirect made by the earlier smoke check.
print(int(summary['metrics']['http_reqs']['values']['count']) + 1)
PY
)
  "${compose[@]}" exec -T -e EXPECTED_CLICKS="$expected_clicks" backend node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { PrismaClient } from './src/generated/prisma/index.js';
const db = new PrismaClient();
try {
  const link = await db.url.findFirst({ where: { short_code: 'SmokeCI42' } });
  const clicks = await db.click.count({ where: { url_id: link.id } });
  assert.equal(clicks, Number(process.env.EXPECTED_CLICKS), 'A redirect click was lost or duplicated');
  console.log(`All ${clicks} redirect clicks, including warmup, persisted exactly once.`);
} finally { await db.$disconnect(); }
JS
fi
