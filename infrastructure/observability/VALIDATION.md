# Verification performed on 2026-10-24

The complete disposable production-image test passed locally, including the actual telemetry pipeline and application load test. Production activation requires the user's Cloud credentials and EC2 configuration.

## Native workflow verification: 2026-10-25

The default workflow now runs four infrastructure containers with native backend/worker/Vite processes. A real native-to-Docker smoke check passed: backend readiness, Vite API proxy, both application metrics scrapes through `host.docker.internal`, PostgreSQL and Redis metrics, worker queue-poll metrics, request logs in Loki and backend traces in Tempo.

Twenty native configuration/environment/telemetry/readiness checks passed. Both native and full-container Compose configurations were validated, and Alloy configuration validation passed with the production fallback targets. The local Alloy service now runs as its data-directory owner (`alloy`) with the existing capability restrictions; this resolves the named-volume permission failure exposed by the native smoke check.

Existing PostgreSQL/Redis volume names were preserved by reusing their Compose project. The launcher remembers that project in the ignored `.local-compose-project` file so a later `down`/`up` also keeps the same volume selection. No working database volumes were removed. Test-owned native processes stopped after verification; only PostgreSQL, Redis, Alloy and LGTM remain running for this project.

## Passed

- Backend, migration and static Nginx runtime images built from locked dependencies. Prisma generation and migrations work with the patched dependency versions.
- Full image test: HTTPS certificate validation, HTTP-to-HTTPS redirect, static/SPA routing, security headers, private metrics/readiness routes, application readiness, real redirect, BullMQ worker and PostgreSQL persistence.
- Prometheus received application/PostgreSQL/Redis metrics; Loki received request logs; Tempo received redirect traces. Dedicated `pg_monitor` role setup passed.
- Local Grafana file provisioning and API provisioning work together: three dashboards and eleven alert rules. The image test uses the same datasource/dashboard files as local development.
- Real k6 application baseline: 1 RPS, 10-second warmup, 60-second measured period; 60 measured requests, zero redirect failures/dropped iterations. All 71 clicks, including warmup and initial smoke redirect, persisted exactly once. See [BASELINE.md](BASELINE.md).
- Both final runtime images passed Trivy 0.69.3's blocking high/critical scan with available fixes, with no secret findings. Production npm audit reported zero vulnerabilities. This is a dated scan result, not a guarantee against future vulnerabilities.
- Twenty backend checks covering telemetry/privacy, real PostgreSQL pg/Prisma instrumentation, environment isolation, readiness, invalid-body HTTP 400 behavior and offline email composition.
- Sixteen workspace tests, six auth tests, 41 billing tests and four retired-demo-access tests; existing 30 trace propagation assertions, metrics endpoint and MCP registration checks.
- Three measurement/provisioning harness tests, including real native k6 2.3.0. A follow-up run verified saved capture timestamps match actual measured requests and exclude initialization/warmup.
- Six infrastructure Python checks, shell syntax, actionlint and CloudFormation cfn-lint; complete application/host/HTTPS Alloy configuration validation.
- Local/production/smoke Compose checks. The OneDrive-compatible launcher passes `--observability check` without printing runtime secrets.

## Evidence

Ignored machine-local reports under `.artifacts/observability/`:

- `2026-10-24T14-20-36-768Z-image-smoke-baseline/`: original k6 summary, measurement record and raw server samples.
- `pburls-smoke-observability-final-20261024-result.json`: successful final image test.
- `smoke-run.log`: full final run transcript.
- `backend-vulns-final.json` and `frontend-vulns-final.json`: exact image metadata/security results.

CI runs the image test and security gate on GitHub-hosted runners, retaining measurement/security/diagnostic artifacts for 14 days. The workflow was validated locally; this report does not claim a GitHub-hosted run has already occurred.

## Docker recovery

With explicit user approval, Docker's data disk was moved to `D:\DockerDesktop\wsl\disk\docker_data.vhdx`, verified by SHA-256, and Docker restarted. The original C: disk directory is a junction to D:. A separately verified recovery copy remains under `D:\DockerDesktop\backups\2026-10-24-before-storage-relocation\`.

Existing PostgreSQL/Redis volumes were retained. PostgreSQL health/write-rollback and Redis PONG/persistence checks passed after recovery. Temporary test containers/volumes were removed; the user's database and Redis containers remain running. This recovery copy is not an automated application backup policy.

## Production configuration still required

Live EC2 deployment, Grafana Cloud ingestion and actual notification delivery have not been exercised: no production target or Cloud credentials were supplied. Follow [README.md](README.md) to configure SSM SecureStrings, provision Cloud dashboards/rules, and test a contact point/notification policy. No S3 resources are introduced.

The local low-rate baseline is a functional measurement, not a capacity result or optimization improvement. Host/EBS panels require the production Linux collector; browser rendering and worldwide external uptime monitoring are outside this implementation.
