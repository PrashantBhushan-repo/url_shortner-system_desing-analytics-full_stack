# Environment configuration

Only example files belong in Git. Actual `.env`, `.env.*.local`, and mode files are ignored and excluded from Docker build contexts. Do not put production secrets in Docker build arguments or `VITE_*` variables.

## Choose how you are running the application

| Situation | Configuration | Start command |
| --- | --- | --- |
| Local infrastructure: PostgreSQL, Redis, Alloy, LGTM | Root `.env`, copied from `.env.example` | `node infrastructure/scripts/local.mjs up` |
| Entire local stack in Docker (integration check) | Same root `.env` | `node infrastructure/scripts/local.mjs --full-stack up` |
| Native backend + worker development | `backend/.env.development.local`, copied from `backend/.env.development.example` | `npm --prefix backend run dev` |
| Standalone native backend | Same native backend configuration | `npm --prefix backend run dev:backend` |
| Standalone native worker | Same native backend configuration; automatic separate identity/metrics port | `npm --prefix backend run worker:dev` |
| Native frontend development | Optional `frontend/.env.development.local`, copied from its example | `npm --prefix frontend run dev` |
| Production backend | `backend/.env.production.local` on server, or injected runtime variables | `npm --prefix backend run start:prod` |
| Production worker | Same production backend configuration | `npm --prefix backend run worker:prod` |
| Production frontend build | Optional `frontend/.env.production.local`, or public build arguments | `npm --prefix frontend run build` |
| Tests / GitHub CI | `NODE_ENV=test` and disposable test variables; optional `backend/.env.test.local` | Set in workflow; no development secrets are loaded |

Backend commands select the environment explicitly; the app does not guess based on its hostname or whether it is running on EC2. Vite selects development for `dev`, and production for `build`. Docker images default to production; local Compose explicitly selects development from the root `.env`.

## Backend loading order

Highest priority first:

1. Variables already injected by the shell, Docker, GitHub, or secret manager.
2. `backend/.env.<NODE_ENV>.local`.
3. `backend/.env.<NODE_ENV>`.
4. **Development only:** `backend/.env.local`, then legacy `backend/.env`.

The default is development when `NODE_ENV` is not set. Valid names are `development`, `production`, and `test`; spelling errors fail rather than silently choosing another mode. Files with a conflicting `NODE_ENV` fail too.

Production and test never fall back to generic `.env` or `.env.local`. Paths are resolved from the backend directory, not the terminal's current directory. Application, worker, seed, and MCP entry points share this loader.

Examples are templates and are never loaded automatically. Existing `backend/.env` is preserved as a development-only compatibility file. For new setups, copy the development template to `.env.development.local`. Avoid maintaining the same setting in both files.

Backend files use literal values, not `${OTHER_VARIABLE}` expansion. Write complete URLs and URL-encode passwords inside connection URLs. An explicitly injected empty variable still wins over file values.

## Local infrastructure and native development

PowerShell:

```powershell
Copy-Item .env.example .env
node infrastructure/scripts/local.mjs up
```

Bash:

```bash
cp .env.example .env
node infrastructure/scripts/local.mjs up
```

Copy only when the destination does not exist. An existing private root `.env` was prepared during this change using the previous Docker database credentials, preserving compatibility with existing volumes.

Root `.env` is the single source for Compose interpolation and backend/worker container injection. `BACKEND_ENV_FILE=./.env` connects those two mechanisms. Do not also pass `backend/.env` into Compose.

The default launcher starts exactly four infrastructure services and does not build application images. `--observability` remains accepted for older commands, but observability is enabled by default. `node infrastructure/scripts/local.mjs check` validates this configuration without printing secrets. The launcher reuses the existing PBUrls database/Redis Compose project to preserve the selected volumes after a checkout rename.

Native `dev` and `worker:dev` commands select development explicitly, load backend env files with the normal precedence above, and apply a native execution profile. They enable OTLP export to `http://localhost:4318`, use 100% local trace/request-log sampling, assign `pburls-backend`/`pburls-worker`, select distinct metrics ports and disable the backend's automatic child worker. Explicit shell `OTEL_*`/request-log sampling overrides still win. Shared legacy `METRICS_PORT`, `OTEL_SERVICE_NAME` and file-based Docker exporter overrides do not control these two roles.

Set `BACKEND_METRICS_PORT` and `WORKER_METRICS_PORT` in the root `.env` if changing the default 9464/9465 ports: Alloy and native launchers use the same values. Different values are required. The root file supplies only connection/published-port settings to the native launcher; it does not inject its Docker application origins or secrets wholesale.

A native `DATABASE_URL`/`REDIS_URL` in backend env files or the shell takes precedence. If absent, connection URLs are derived from the existing root Docker configuration. File-based URLs using Docker DNS names `db`/`redis` are translated to `127.0.0.1` and published host ports; explicitly injected Docker-only addresses fail with a safe error. Native localhost or remote URLs are preserved. Verify intended local connections before running migrations.

Run `npm --prefix backend run dev:check` for a secret-free configuration check. After installing dependencies, `npm --prefix backend run dev:setup` generates Prisma, applies migrations and seeds plans explicitly. Run `dev` in backend and `dev` in frontend in two terminals. Backend `dev` starts both backend and worker with hot reload; Ctrl+C stops both. Stop standalone processes before starting the combined command. The frontend uses Vite at `http://localhost:5173`.

For a full container integration check, stop native processes and use `node infrastructure/scripts/local.mjs --full-stack up`. Only this mode materializes source-only build contexts to work around OneDrive reparse points; set `PBURLS_BUILD_CACHE` to place them on D:. The container frontend uses Nginx at port 3000. The native launcher is never used in production.

Full-stack Compose seeds plans automatically; native development uses the explicit `dev:setup` command. Admin seeding is optional: leave all three `ADMIN_SEED_*` fields blank, or set all three to bootstrap an administrator.

Docker uses `db:5432` and `redis:6379` internally. Native Node uses host-published addresses such as `127.0.0.1:5435` and `127.0.0.1:6379`. Keep these configurations separate.

`DB_NAME`, `DB_USER`, and `DB_PASSWORD` initialize the PostgreSQL container. `DATABASE_URL` configures the application and Prisma: keep the database name/user/password consistent. Changing an env file does not change credentials in an existing PostgreSQL volume; change the database credentials deliberately instead of deleting the volume.

The full-container frontend is at `http://localhost:3000`; native Vite is at `http://localhost:5173`. Set native `BASE_URL` to the public origin for generated links and `CLIENT_URL` to the exact frontend origin. If you change `FRONTEND_HOST_PORT` for full-stack mode, update that mode's root origins too.

Database, Redis, and direct backend ports bind to host loopback. Only use `TRUST_PROXY=uniquelocal` when the backend is reachable exclusively through your trusted Docker proxy network; otherwise configure exact trusted CIDRs or `false`.

Use single quotes for literal Docker env values containing `$` to avoid Compose interpolation. Shell variables have higher priority than root `.env`; clear stale shell variables when changing environments.

## Production setup

1. Copy `backend/.env.production.example` to `backend/.env.production.local` on the server only, or inject variables from your deployment system.
2. Replace the public HTTPS origins, database URL, JWT secret, proxy trust, and any enabled provider credentials.
3. Generate a JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Run `npm --prefix backend run env:check -- production` to validate without starting the app or printing secrets.
5. Use `npm --prefix backend run start:prod` and `worker:prod`, or inject `NODE_ENV=production` into their containers.

Production fails early for missing required values, template secrets, short JWT secrets, invalid connection URLs, non-HTTPS public origins, invalid ports/booleans, and enabled email-error bypass. Optional integrations remain disabled when their credentials are blank. SMTP must be configured if you want email-based flows to deliver mail.

The root Compose file is a **local** stack. Production uses `infrastructure/compose.production.yml`, runtime secrets from Parameter Store, GHCR images, and the scripts described in [infrastructure/DEPLOYMENT.md](infrastructure/DEPLOYMENT.md). Admin seeding is a deliberate one-time operation.

If a future Compose deployment uses a different env file, both mechanisms must select it:

```bash
docker compose --env-file backend/.env.production.local config --quiet
```

The production template sets `BACKEND_ENV_FILE=./backend/.env.production.local` for that reason. Production scripts select the runtime env and release manifest explicitly; follow the production deployment guide rather than starting the root local stack on EC2.

## Frontend rules

`VITE_API_URL=/api` is the recommended public setting in both environments. Vite proxies it locally, and Nginx proxies it in Docker/production. Socket.IO resolves the same origin correctly. `DEV_API_PROXY_TARGET` changes only the Vite server's backend target; it is not exposed to browser code.

Vite's precedence is injected variables, mode-specific local file, mode-specific file, `.env.local`, then `.env`. Keep secrets out of **all** frontend files. Prefer mode-specific files; avoid putting development URLs in generic frontend `.env.local`, because Vite reads it during production builds too.

Frontend variables are compiled into static JavaScript at build time. Changing container runtime env does not update already built frontend files. A relative `/api` allows one built image to work across domains without rebuilding.

## Database and seed commands

Use the environment-aware wrappers rather than bare Prisma migration commands:

```bash
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:migrate:prod
npm --prefix backend run seed:admin
```

`db:migrate` follows the selected `NODE_ENV`, defaulting to development. `db:migrate:prod` explicitly selects production. For a production admin seed, set `NODE_ENV=production` and the one-time admin credentials before invoking it. These commands do real database work; environment checks alone do not.

## GitHub Actions

CI injects `NODE_ENV=test`, telemetry disabled by default, and non-production connection values directly. PostgreSQL/Redis service containers support the integration checks. Dedicated observability tests enable telemetry against a disposable receiver and a separate image smoke stack; production credentials are never used.

Image builds receive only public frontend settings. Backend production secrets are runtime settings; they are not needed to build the image. GHCR publishing uses the built-in GitHub token. EC2 receives a separate read-only package token from Parameter Store. AWS OIDC supplies short-lived deployment credentials.

## Safe checks

```bash
npm --prefix backend run env:check
npm --prefix backend run env:check -- production
npm --prefix backend run test:env
npm --prefix frontend run test:env
docker compose config --quiet
```

`env:check` prints only validation status and mode. Do not publish plain `docker compose config` output: it can contain resolved secrets.

Removing a real env file from Git tracking does not remove it from older commits. Rotate credentials that have been committed; this change does not rewrite repository history.

Reference: [Vite modes and env precedence](https://vite.dev/guide/env-and-mode), [Docker Compose env precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/).
