# Local functional baseline: 2026-10-24

This verifies measurement end to end. It does not establish production capacity or an optimization improvement.

Disposable production images ran under Docker Desktop/WSL. k6 2.3.0 used 1 RPS, a 10-second warmup and a 60-second measured period against a warm-cache redirect through Nginx. Destinations were not followed. Load used a temporary local HTTP listener; HTTPS/certificate validation passed separately. Trace and successful-request log sampling were 100% for this test; production defaults to 10%.

| Measurement | Observed value |
|---|---:|
| Measured requests | 60 |
| Measured count / configured duration | 1.00 RPS |
| Client p50 | 7.94 ms |
| Client p95 | 11.31 ms |
| Client p99 | 16.32 ms |
| Redirect failures / dropped iterations | 0 / 0 |
| Persisted clicks, including warmup + initial smoke redirect | 71 / 71 |
| Sampled cache hit ratio | 100% |
| Sampled maximum click-processing p95 | 82.01 ms |
| Sampled maximum click queue-wait p95 | 9.50 ms |
| Sampled maximum click creation-to-success p95 | 84.96 ms |
| Sampled maximum backend + worker process RSS | Approximately 566 MiB |
| Sampled maximum backend + worker CPU rate | 0.0503 cores |
| Sampled maximum pg pool waiting / live click waiting | 0 / 0 |
| Sampled application scrape health | 1 throughout |

Server percentiles use histogram buckets and rolling one-minute rates; their timing boundaries differ from client percentiles. Samples are 15 seconds apart. A sampled zero queue depth does not mean no jobs existed between scrapes. CPU rates are smoothed and can include warmup. Process RSS excludes PostgreSQL, Redis, Alloy and the local storage bundle.

There were no server query errors. Host CPU/memory/EBS series are intentionally absent locally. The application pg-query histogram was absent in this Prisma-based scenario; the separate real-PostgreSQL test verified both clients. Missing data remains missing rather than being presented as zero.

Raw reports: `.artifacts/observability/2026-10-24T14-20-36-768Z-image-smoke-baseline/`. The record includes actual measured request timestamps, settings, base Git revision and dirty-tree flag. Exact runtime image IDs are in the final security reports. Keep these artifacts for future comparisons.

Use the [controlled experiment procedure](README.md#3-run-a-controlled-optimization-experiment): record machine/dataset/sampling/rate-limit settings, change one factor and repeat each version at least three times under equivalent load. One low-rate run cannot establish an improvement.
