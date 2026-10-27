# PBUrls — Complete mounted API catalog

Generated from literal Express declarations by `build-architecture.mjs`. Snapshot: 23 October 2026.

Authentication and permission notes are route-family summaries. Handler checks and configuration can further restrict access. The two MCP mounts are listed separately because both paths are exposed. Health/metrics ingress access depends on deployment routing.

## Direct application routes

/health and /metrics are process/observability endpoints; /api/plans is public; redirect uses rate limiting and code validation. Payment webhook uses raw body and provider signature verification.

| Method | Full path | Source |
|---|---|---|
| POST | `/api/payments/webhook` | [app.js](../backend/src/app.js) |
| GET | `/health` | [app.js](../backend/src/app.js) |
| GET | `/metrics` | [app.js](../backend/src/app.js) |
| GET | `/api/plans` | [app.js](../backend/src/app.js) |
| GET | `/r/:shortCode` | [app.js](../backend/src/app.js) |

## /api/urls

Public public-stats; remaining routes require JWT and route-specific ownership. Create enforces quotas; bulk and QR require plan features.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/urls/public-stats` | [url.routes.js](../backend/src/routes/url.routes.js) |
| GET | `/api/urls/me` | [url.routes.js](../backend/src/routes/url.routes.js) |
| POST | `/api/urls/bulk` | [url.routes.js](../backend/src/routes/url.routes.js) |
| POST | `/api/urls` | [url.routes.js](../backend/src/routes/url.routes.js) |
| GET | `/api/urls/:id/health` | [url.routes.js](../backend/src/routes/url.routes.js) |
| GET | `/api/urls/id/:id` | [url.routes.js](../backend/src/routes/url.routes.js) |
| GET | `/api/urls/:shortCode/qr` | [url.routes.js](../backend/src/routes/url.routes.js) |
| GET | `/api/urls/:shortCode` | [url.routes.js](../backend/src/routes/url.routes.js) |
| PATCH | `/api/urls/:shortCode` | [url.routes.js](../backend/src/routes/url.routes.js) |
| PUT | `/api/urls/:shortCode` | [url.routes.js](../backend/src/routes/url.routes.js) |
| DELETE | `/api/urls/:shortCode` | [url.routes.js](../backend/src/routes/url.routes.js) |

## /api/auth

Mixed public and JWT routes; OTP, sensitive-action, login, and general rate limits are applied per route. OAuth and options are public. Evaluator bypass depends on configuration.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/auth/options` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| GET | `/api/auth/oauth/:provider` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| GET | `/api/auth/oauth/:provider/callback` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/register` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/verify-email` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/resend-otp` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/login` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/verify-login-otp` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/force-change-password` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/evaluator-bypass` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/forgot-password` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/reset-password` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/refresh` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/logout` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/change-password` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| GET | `/api/auth/profile` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| PUT | `/api/auth/profile` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/change-email/request` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/change-email/confirm` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| GET | `/api/auth/security-sessions` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/2fa/setup` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/2fa/enable` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| POST | `/api/auth/2fa/disable` | [auth.routes.js](../backend/src/routes/auth.routes.js) |
| DELETE | `/api/auth/delete-account` | [auth.routes.js](../backend/src/routes/auth.routes.js) |

## /api/security

JWT plus general or sensitive-auth rate limits.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/security/sessions` | [security.routes.js](../backend/src/routes/security.routes.js) |
| DELETE | `/api/security/sessions/:id` | [security.routes.js](../backend/src/routes/security.routes.js) |
| POST | `/api/security/sessions/revoke-all` | [security.routes.js](../backend/src/routes/security.routes.js) |
| POST | `/api/security/sessions/revoke-all-absolute` | [security.routes.js](../backend/src/routes/security.routes.js) |
| GET | `/api/security/login-history` | [security.routes.js](../backend/src/routes/security.routes.js) |

## /api/analytics

JWT plus controller ownership checks; geo/location, devices and export have plan-feature gates. Platform statistics has an additional controller check.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/analytics/account/top-links` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/platform` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/overview` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/timeseries` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/geo` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/locations` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/locations/detail` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/devices` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/referrers` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |
| GET | `/api/analytics/:urlId/export` | [analytics.routes.js](../backend/src/routes/analytics.routes.js) |

## /api/api-keys

JWT + api_access feature; revoke requires ownership.

| Method | Full path | Source |
|---|---|---|
| POST | `/api/api-keys` | [apiKey.routes.js](../backend/src/routes/apiKey.routes.js) |
| GET | `/api/api-keys` | [apiKey.routes.js](../backend/src/routes/apiKey.routes.js) |
| DELETE | `/api/api-keys/:id` | [apiKey.routes.js](../backend/src/routes/apiKey.routes.js) |

## /api/webhooks

JWT + webhooks_allowed feature; delete requires ownership. These manage registrations.

| Method | Full path | Source |
|---|---|---|
| POST | `/api/webhooks` | [webhook.routes.js](../backend/src/routes/webhook.routes.js) |
| GET | `/api/webhooks` | [webhook.routes.js](../backend/src/routes/webhook.routes.js) |
| DELETE | `/api/webhooks/:id` | [webhook.routes.js](../backend/src/routes/webhook.routes.js) |

## /api/teams

JWT; invite/revoke require OWNER or ADMIN; membership listing requires a matching team role.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/teams` | [team.routes.js](../backend/src/routes/team.routes.js) |
| POST | `/api/teams` | [team.routes.js](../backend/src/routes/team.routes.js) |
| POST | `/api/teams/invite` | [team.routes.js](../backend/src/routes/team.routes.js) |
| POST | `/api/teams/accept` | [team.routes.js](../backend/src/routes/team.routes.js) |
| POST | `/api/teams/revoke` | [team.routes.js](../backend/src/routes/team.routes.js) |
| GET | `/api/teams/:teamId/members` | [team.routes.js](../backend/src/routes/team.routes.js) |

## /api/domains

JWT + custom_domain_allowed; verify requires ownership. DNS verification is currently simulated.

| Method | Full path | Source |
|---|---|---|
| POST | `/api/domains` | [domain.routes.js](../backend/src/routes/domain.routes.js) |
| POST | `/api/domains/:id/verify` | [domain.routes.js](../backend/src/routes/domain.routes.js) |
| GET | `/api/domains` | [domain.routes.js](../backend/src/routes/domain.routes.js) |

## /api/admin

Admin IP boundary + JWT + ADMIN role + admin rate limiter; selected operations add step-up and audit wrappers.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/admin/billing/recovery` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/billing/recovery/:id/retry` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/plans` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/plans/:id` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/subscriptions` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/subscriptions/:id/cancel` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/subscriptions/:id/resume` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/subscriptions/:id/renew` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/subscriptions/:id/prorate` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/subscriptions/:id/change-plan` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/users` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/users/:id` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/users/:id/status` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/users/:id/role` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/urls` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| DELETE | `/api/admin/urls/:id` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/audit-log` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/dashboard/overview` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/dashboard/billing-reports` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/payments` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/payments/:id/refund` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/payments/:id/invoice` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/payments/:id/dunning-retry` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/payments/:id/write-off` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/payments/reconciliation` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/payments/:id/reconcile-sync` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/webhooks/events` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/webhooks/events/:id/reprocess` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/coupons` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/coupons` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| PATCH | `/api/admin/coupons/:id` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| GET | `/api/admin/approvals` | [admin.routes.js](../backend/src/routes/admin.routes.js) |
| POST | `/api/admin/approvals/:id/decide` | [admin.routes.js](../backend/src/routes/admin.routes.js) |

## /api/subscription

JWT + subscription rate limiter; service enforces lifecycle/refund rules.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/subscription` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| POST | `/api/subscription/change` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| POST | `/api/subscription/cancel` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| POST | `/api/subscription/resume` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| GET | `/api/subscription/invoices` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| POST | `/api/subscription/refund-request` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| POST | `/api/subscription/invoices/:id/refund-sync` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| GET | `/api/subscription/billing-profile` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |
| PUT | `/api/subscription/billing-profile` | [subscription.routes.js](../backend/src/routes/subscription.routes.js) |

## /api/payments

active-coupons is public; validate-coupon permits optional auth; checkout/sync routes use JWT and billing rate limits. Mock routes are configuration dependent.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/payments/active-coupons` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/validate-coupon` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/create-order` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/verify` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/:id/sync` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/checkouts/:id/sync` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/mock-verify` | [payments.routes.js](../backend/src/routes/payments.routes.js) |
| POST | `/api/payments/mock-fail` | [payments.routes.js](../backend/src/routes/payments.routes.js) |

## /api/v1/mcp

info is public; SSE authenticates an API key; messages uses an established in-memory session ID.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/v1/mcp/info` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |
| GET | `/api/v1/mcp/sse` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |
| POST | `/api/v1/mcp/messages` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |

## /api/mcp

Alias of /api/v1/mcp. The SSE transport advertises the canonical versioned message endpoint.

| Method | Full path | Source |
|---|---|---|
| GET | `/api/mcp/info` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |
| GET | `/api/mcp/sse` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |
| POST | `/api/mcp/messages` | [mcp.routes.js](../backend/src/routes/mcp.routes.js) |

## /api/assistant

chat has optional auth; sync requires JWT; action handlers enforce their own user/plan context.

| Method | Full path | Source |
|---|---|---|
| POST | `/api/assistant/chat` | [assistant.routes.js](../backend/src/routes/assistant.routes.js) |
| POST | `/api/assistant/sync` | [assistant.routes.js](../backend/src/routes/assistant.routes.js) |

## Socket.IO contract

| Direction | Event | Payload / behavior |
|---|---|---|
| Client → server | `join-url` | Numeric URL ID; authorized room join, optional acknowledgement |
| Client → server | `leave-url` | Numeric URL ID; leaves `url:ID` |
| Server → client | `click-tick` | URL ID, country, device, timestamp |
| Server → client | `analytics-error` | Room authorization failure message |

Handshake uses `auth.token` or a Bearer Authorization header. Transport path: `/socket.io/`.
