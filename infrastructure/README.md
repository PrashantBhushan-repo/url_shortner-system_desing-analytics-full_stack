# PBUrls infrastructure

Read [DEPLOYMENT.md](DEPLOYMENT.md) for production setup and operations.

- `aws/stack.yml`: EC2, retained encrypted EBS, Elastic IP, IAM, and GitHub OIDC.
- `compose.production.yml`: private PostgreSQL/Redis, backend, worker, migration tools, and public Nginx.
- `nginx/`: HTTP certificate bootstrap and production HTTPS configuration.
- `scripts/`: installation, disk checks, deployment, renewal, rollback, GitHub setup, and smoke testing.
- `Dockerfile`: small deployment bundle transported through private GHCR.
- `compose.smoke.yml` and `tests/`: disposable integration and configuration checks.

Local development still uses the root `docker-compose.yml` and private root `.env`. Do not use the local Compose file as the production deployment.

`node infrastructure/scripts/local.mjs up` starts only PostgreSQL, Redis, Alloy and LGTM. Run backend, worker and frontend natively with the npm commands in the root README. `--full-stack up` selects the seven-container integration workflow. `observability/compose.native.yml` configures Alloy to scrape the laptop through `host.docker.internal`; production keeps the container targets.

See [observability/README.md](observability/README.md) for optional local Grafana and production Alloy → Grafana Cloud, dashboards, alerts and repeatable optimization measurements. No Kubernetes or S3 is required.
