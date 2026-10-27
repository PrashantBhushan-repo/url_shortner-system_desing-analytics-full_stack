# Razorpay sandbox verification

Verified on 22 October 2026 (India time), using the configured Razorpay **test** keys and the local PostgreSQL database. The payment provider and HTTPS webhook delivery were real sandbox services, with fictional QA accounts and no real-money transactions.

| Scenario | Observed result |
| --- | --- |
| ₹1 payment through Razorpay Checkout and its simulated netbanking bank | Provider captured payment; server verified it; subscription activated. |
| Genuine provider notifications | `payment.authorized`, `payment.captured`, and refund notifications arrived through the temporary HTTPS tunnel and processed. |
| Full refund | Provider reported `processed`; local payment became `REFUNDED`; purchased subscription ended. |
| Repeated refund submission | Existing refund returned; exactly one processed provider refund for each payment. |
| Missing browser verification and webhook | The test webhook was temporarily paused and the browser verification callback skipped. Local payment remained `CREATED` initially; the recovery worker fetched provider state and activated access. The QA job's next-check time was advanced to run this check promptly. |
| Second full refund | Recovered payment also refunded completely; provider and local totals agree. |
| Duplicate webhook delivery | Replayed signed provider payload acknowledged; only one stored event remained. |
| Invalid webhook signature | Rejected with HTTP 400. |
| Tunnel exposure | Other API paths returned HTTP 404 through the public tunnel. |
| Worker recovery jobs | Fixture jobs completed without recorded failures. |

Provider references retained for audit:

- Payment `pay_TqhefO9oYkI0qb`, refund `rfnd_TqhfeexgBVPmoF`: ₹1, fully refunded.
- Payment `pay_Tqhi9wqx31gTjl`, refund `rfnd_Tqhjg3qVh6iycT`: ₹1, fully refunded after the missing-confirmation recovery scenario.

The complete machine-readable evidence is in the ignored local file `backend/.billing-local/verification.json`. It contains no API secret or webhook secret. `npm run billing:verify-test` checks the retained fixtures against Razorpay again while the local setup runs.

Start the local test environment with `npm run billing:test-local` in `backend`. It requires local PostgreSQL, existing test keys, and the downloaded official Cloudflare tunnel executable at `.billing-local/cloudflared.exe`. Its Authenticode signature was verified as valid for Cloudflare, Inc. The script refuses live keys and remote databases, stores a generated webhook secret in `.env`, starts the local API and recovery worker, and registers or updates only its own test webhook. It exposes only the webhook route publicly. Keep this process running for local webhook delivery and recovery. It updates the temporary callback URL when restarted.

This validates the tested sandbox paths. The temporary tunnel is for development; a stable deployed HTTPS endpoint, supervised production processes, live keys, and live-mode acceptance checks are still needed before accepting real payments. Card and UPI completion were not verified; the completed sandbox payments used netbanking. Refund processing in the sandbox does not demonstrate a real bank account credit.
