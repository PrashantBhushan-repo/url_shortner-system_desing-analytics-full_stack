# Billing implementation and operations

The customer console is at `/settings?tab=subscription` (also `/billing`). It includes plan comparison, monthly/quarterly/yearly checkout, coupon previews, usage, billing details, paginated/searchable/filterable payments, CSV export of the visible page, downloadable payment receipts, scheduled downgrade preferences, full remaining-balance refund requests, and payment/refund recovery controls. Both themes and mobile dialogs use the settings design tokens.

## Purchase and access rules

- Prices are authoritative on the server, in the smallest currency unit. Checkout displays the actual provider order amount.
- Razorpay Orders are one-time purchases. Renewal is manual. No recurring mandate, saved-card vault, automatic charge, or tax calculation is implemented or presented as active.
- Confirmed same-plan renewal extends the current paid period. A different plan replaces current access immediately without proration; the confirmation explains this before checkout.
- Only a provider-confirmed captured payment activates paid access. Authorization, checkout dismissal, network failures, and verification timeouts do not grant access.
- Month-end and leap-day renewal dates clamp to the last valid calendar day. Expired paid subscriptions fall back to Free when entitlements are read; existing links are preserved.
- Durable per-account request keys and PostgreSQL advisory locks protect concurrent checkout and activation. A delayed old capture cannot replace a newer purchase; it is recorded for billing review.
- Limited coupons reserve capacity across pending checkouts. Abandoned provider orders retain their coupon reservation because they can still be paid. A support review may be needed to retire these reservations safely.
- A free coupon purchase is recorded as a zero-charge purchase, atomically activated, and has no refundable gateway balance. Missing provider keys never enable simulated paid purchases.

## Refund rules

- Self-service requests cover the full remaining unrefunded balance, strictly before the 14-day deadline. New records use the verified provider payment timestamp; historical records fall back to their stored creation timestamp.
- Ownership, balance, captured status, gateway reference, consent, reason, and note lengths are checked on the server.
- `BillingRefund` persists the request before contacting the provider. Its UUID is reused as `X-Refund-Idempotency`, with an identical request body on retries. A timeout is `UNKNOWN`, not a success or a reason to issue a second refund.
- `PENDING` and `PROCESSING` refunds do not change returned-money totals or revoke paid access. Processed totals are fetched from the provider, exclude pending/failed refunds, and never decrease on a stale response.
- Full refunds cancel only access linked to the refunded payment. Newer purchases remain active; an eligible preceding paid subscription can be restored if it still has remaining time.
- Self-service refunds, administrator refunds, and approved finance refunds use the same durable path. Administrators may review payments outside the self-service window. Partial refunds must be issued through the provider dashboard and then reconciled; the app rejects unsupported partial-refund submissions.
- A definitively rejected refund remains visible as failed for support review. No receipt claims a bank credit solely because a request was accepted. Typical bank credit timing is described as an estimate.

## Reconciliation

- Checkout signatures use the order stored for the authenticated owner and a constant-time comparison. The provider payment must match the order, amount, and currency.
- `/api/payments/webhook` requires a configured webhook secret and the exact raw body. Duplicate event IDs are recorded idempotently; current provider state is fetched so delayed failure events cannot downgrade a paid/refunded payment.
- Customer “Check status” reconciles orders/payments/refunds. “Recover checkout” searches by the durable checkout receipt if order creation timed out before local persistence. A provider-confirmed missing order can release an uncharged reservation after the original request timeout. Ambiguous or multiple matches require support review.
- The admin reconciliation action fetches provider state; it cannot simply mark an unpaid transaction captured.
- Refund/payment signatures and arbitrary internal metadata are excluded from customer history. Billing details are snapshotted for future receipts; exported HTML escapes user text, and CSV exports neutralize spreadsheet formulas.

## Setup

1. Apply migrations with `npx prisma migrate deploy` in `backend`, then run `npx prisma generate`. Billing reliability, account cleanup, and recovery queue migrations were applied to the local development database during this change.
2. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for the intended test or live mode. They remain server-side; only the public key ID is sent to checkout.
3. Set `RAZORPAY_WEBHOOK_SECRET`, and register the publicly reachable HTTPS `/api/payments/webhook` URL in the matching Razorpay environment. Enable `payment.captured`, `payment.authorized`, `payment.failed`, `refund.created`, `refund.processed`, and `refund.failed`. Configure automatic capture in Razorpay if that is the intended payment flow.
4. Restart the API after source, schema, or environment changes. Rebuild/redeploy the frontend for a production deployment.
5. Keep `npm run worker:billing` running under your process supervisor, or run the existing `npm run worker` which now also starts recovery. Recovery uses PostgreSQL and continues when Redis is unavailable. Multiple instances lease jobs safely. The standalone worker does not send reminder emails; daily reminders still use the existing Redis worker.

## Automatic recovery and operations

- Webhook requests validate the raw-body signature, store the event in PostgreSQL, and acknowledge without waiting for provider calls. Database failure returns an error so delivery can be retried. The recovery worker picks up unprocessed events, including events committed just before an API crash.
- A background scan discovers checkout/refund work after a crash. Open purchases are checked approximately every five minutes after their first check; pending refunds every minute; completed purchases daily to detect dashboard refunds. Queue backlog and provider failures can delay checks. Older payment records without a checkout are included.
- Jobs use five-minute leases, `SKIP LOCKED`, fenced completion, exponential backoff, jitter, and provider Retry-After. Eight consecutive failures flag review; retries continue. Unresolved payments older than a day are also flagged. A long-running expired worker cannot overwrite a newer queue lease; financial updates remain protected by account locks and provider refund idempotency.
- Purchase requests include the last fulfilled purchase visible when the customer reviewed billing. A fresh key from a stale tab is rejected after another purchase completes. Existing provider orders remain reusable after failed attempts and beyond 30 minutes; their unknown outcome cannot silently create another charge. Starting a different purchase while such an order remains open requires support review. Do not delete reservations just to unblock checkout.
- A second captured provider payment on the same order is retained as an additional charge reference and shown for review; it never grants access twice. Delayed older purchases also require review. These ambiguous charges require an operator to confirm intent and use the provider dashboard for the appropriate refund; there is no automatic duplicate-charge refund policy.
- Refund response failures use conditional writes so a stale timeout cannot overwrite an already confirmed refund. Refund retries keep the original durable key and amount. The provider enforces the remaining refundable balance if a dashboard refund races a request.
- Admin → Reconciliation includes recovery failures, captured payments requiring review, and retry controls. API equivalents: `GET /api/admin/billing/recovery` and audited `POST /api/admin/billing/recovery/:id/retry`. These retries perform status recovery and may resume an already authorized refund request; they never create a new purchase order.
- Monitor these diagnostics and supervise worker uptime. No external paging integration is configured. Last job activity is diagnostic activity, not a dedicated worker heartbeat. Large installations should add queue retention, indexed incremental scanning, and provider-wide rate budgeting before increasing throughput.
- The merchant must configure automatic capture. Authorization alone grants no paid access, and this implementation does not automatically call a manual capture API. Unresolved authorization is checked and escalated for review.
- During webhook-secret rotation, set `RAZORPAY_PREVIOUS_WEBHOOK_SECRET` temporarily to validate redeliveries signed with the prior secret. Remove it after the delivery retry window. Never log either secret.
- Entitlements are read from PostgreSQL rather than trusting a Redis subscription snapshot, preventing a failed cache invalidation from preserving refunded access. Renewal reminders describe manual renewal; expiry updates share account locks with purchases and cannot overwrite a newer paid subscription.

The implementation provides durable retries and operational review paths; it does not guarantee immediate recovery during database/provider outages, prevent bank-side debits, certify compliance, automate disputes/chargebacks or tax accounting, or prove every real provider/bank outcome through mocked tests. Confirm capture, delayed delivery, refund settlement, and worker supervision in the intended Razorpay environment before production use.

The development environment has Razorpay **test** keys. A webhook secret is now stored in the ignored `.env`, and a temporary HTTPS test webhook was registered through the provider API. Two isolated ₹1 sandbox payments were captured and fully refunded. Genuine payment/refund delivery, replay handling, and recovery with both browser verification and webhook delivery absent were verified. See [sandbox results](BILLING-TEST-RESULTS.md). No real-money charge was created. Keep `npm run billing:test-local` running to retain local webhook delivery and recovery; its callback URL changes when restarted and is updated through Razorpay. Production deployment still requires a stable HTTPS endpoint and separate live-mode acceptance checks.

## Verification

- `npm run test:billing` in `backend`: policy, ownership, signatures, duplicate/concurrent capture, zero-charge coupons, reserved coupon limits, pending/rejected/unknown refunds, replay, partial-balance reconciliation, manual finance refunds, and recovery. The PostgreSQL integration test only runs on a local database and rolls all fixtures back.
- `npm run test:billing` in `frontend`: quotes, currency display, usage boundaries, CSV safety, checkout dismissal/reuse, provider script failures, authorization, verification uncertainty, and account changes.
- `npm run test:workspace` in both applications; `npm run test:auth` in `backend`; `npm run build` in `frontend`.
- `node frontend/test/billing-preview.mjs` from the repository root serves fictional UI fixtures on port 5233. It is not imported into production and never contacts the backend or a bank. Browser QA covers both themes, desktop/mobile, coupon errors, profile saves, downgrade/resume, filters, pagination, receipts, refunds, checkout dismissal, and delayed confirmation.

Provider references: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [idempotent normal refunds](https://razorpay.com/docs/api/refunds/normal-refunds-idempotent/), and [Orders API](https://razorpay.com/docs/api/orders/fetch-all/).
