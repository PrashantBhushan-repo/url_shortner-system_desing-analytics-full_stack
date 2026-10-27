# Workspace verification

Run `npm run test:workspace` in `frontend` for link state, reporting failures, QR tracking, and account-switch request isolation checks. Run `npm run build` for production compilation.

Run `npm run test:workspace` in `backend` for code generation, collision retries, ownership, socket authorization, expiry handling, and analytics SQL checks. The PostgreSQL integration test requires the configured database to be local. Its temporary fixtures run inside a transaction that is rolled back.

For isolated UI verification, run `node frontend/test/workspace-preview.mjs` from the repository root, then open `http://127.0.0.1:5231/dashboard`. This development-only Vite server substitutes in-memory QA data and authentication. It does not connect to the backend, grant real account access, or enter the production bundle. Stop it after verification.

The production frontend uses the real authenticated APIs. Restart the backend after source changes, keep `npm run worker` running for click processing, and apply the included Prisma migration in each deployment environment. The composite click index was applied to the local development database during verification.

Browser QA covered creation, editing the destination and alias without duplicating a link, deactivation, search, reporting period controls, and both color themes. A real signed-in redirect-to-worker-to-report session remains an integration check to perform with an authorized test account.

## Authentication verification

Run `npm run test:auth` in each application directory. Backend tests mock mail, Redis and account storage; they do not send messages or modify real passwords. Frontend tests cover error handling, password rules, incomplete responses, and avoiding token refresh for rejected public authentication requests.

Run `node frontend/test/auth-preview.mjs` from the repository root for isolated registration, email verification, sign-in, authenticator/backup-code, and password-recovery UI checks on port 5232. Use any `@example.invalid` email (prefix `totp` for the authenticator screen), the inert password `Test-only!123`, code `123456`, or backup code `abcdef-123456`. These fixtures never reach the backend. Stop this server after QA.

The normal development frontend proxies `/api` and `/socket.io` to the local API on port 5000. This preserves same-origin cookies on both `localhost` and `127.0.0.1`. For deployment, route these paths to the backend or configure `VITE_API_URL` and the backend's allowed frontend origin. OAuth provider callbacks must match their registered redirect URI and `CLIENT_URL`; the options endpoint exposes only configured provider names and start URLs. Email delivery failures now return an error instead of pretending to send a code. Valid SMTP and provider credentials are required for external delivery/sign-in.

## Location reports

Location APIs require link ownership (or the existing administrator access rule), the geography plan feature, and the account retention cutoff. The table groups by the full country/state/city tuple. City detail pages return 25 click records at a time with deterministic ordering; raw IP addresses, visitor identifiers, and coordinates are omitted. Browser QA uses fictional locations and click records through the isolated workspace fixture server.

The ingestion worker uses the installed `geoip-lite` local GeoLite database with a bounded LRU cache, avoiding external lookups for individual clicks. Loopback, private, malformed, and unresolved IPs remain unknown. No street address or neighborhood is inferred. The fix applies to new events; historic stored locations are displayed as originally recorded.

Keep the GeoLite data current using a MaxMind license and the [geoip-lite update instructions](https://github.com/geoip-lite/node-geoip#2-update-the-datafiles-optional), then restart ingestion workers. No license or database refresh was configured during this change. An outdated database limits location accuracy. Configure the deployment's Express trusted proxy boundary to match the real reverse-proxy chain; ingestion uses `req.ip` rather than arbitrarily prioritizing user-supplied IP headers.
