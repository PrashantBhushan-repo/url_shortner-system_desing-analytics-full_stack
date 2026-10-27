# Public product demos

- `/demo`: workspace overview, searchable campaigns, analytics, QR color preview, and integration discovery.
- `/demo/admin`: administration overview, searchable sample users, link moderation, fictional invoices, audit events, and operations discovery.
- `?view=links`, `?view=analytics`, etc. preserve the selected section in the URL. Unknown sections fall back to Overview.

Both routes are public, clearly labelled read-only previews. `demoData.js` contains immutable fictional fixtures and reserved `example.com` destinations. Demo components do not import authentication or API clients, issue credentials, or persist record changes. QR customization only generates an image in browser memory. The real `/admin` route and admin APIs retain their authentication and authorization checks.

The retired `/api/auth/evaluator-bypass` endpoint returns HTTP 410 without creating sessions, cookies, accounts, or subscriptions. Restart or redeploy the backend to apply this change. Retiring the endpoint does not revoke sessions issued by older deployments.

Run regression checks from the repository root:

```sh
npm run test:demo --prefix backend
npm run test:demo --prefix frontend
npm run build --prefix frontend
```

The fixtures are a product walkthrough, not evidence of real users, traffic, revenue, or current pricing. Live backend actions are tested separately with authorized accounts.
