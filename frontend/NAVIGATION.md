# Navigation and page structure

The site has public product pages, a signed-in workspace, and role-protected administration. The workspace uses a shared header, mobile navigation, breadcrumbs, account controls, theme switching, and help links. Public demos remain read-only and clearly separated from real account data.

| Purpose | Canonical URL |
| --- | --- |
| Product website | `/` |
| Public workspace / admin demos | `/demo`, `/demo/admin` |
| Plan comparison | `/pricing` |
| Sign-in / registration | `/auth`, `/auth?mode=register` |
| Help and setup guides | `/help` |
| Personal links | `/dashboard` |
| Individual link analytics | `/analytics/:urlId` |
| Profile / password / sessions | `/settings/profile`, `/settings/password`, `/settings/security` |
| Two-factor / appearance | `/settings/two-factor`, `/settings/appearance` |
| Plans and billing | `/billing` |
| Domains / team | `/settings/domains`, `/settings/team` |
| API credentials / webhooks / AI clients | `/settings/api-keys`, `/settings/webhooks`, `/settings/integrations` |
| Administration | `/admin/overview` and the named sections in `src/routes/navigation.js` |
| Password-protected link | `/p/:shortCode` |

Billing is a standalone workspace page at `/billing`. It has no settings sidebar or account forms. Settings retains Account, Workspace, and Developers groups, with one feature per route. Old `/settings/billing`, `/refund`, `/refunds`, and `/settings?tab=subscription` links redirect to Billing while preserving other query values and anchors. `/profile` and other legacy settings tabs redirect to their named settings routes. Login/signup aliases are supported. Trailing slashes normalize before authentication guards run. Unknown pages have a recovery screen; ordinary users receive an explicit access-restricted screen for administrator routes. Backend authorization remains authoritative.

Sign-in keeps a validated internal `next` destination through credentials, registration mode switching, and OAuth. External destinations, authentication loops, and unknown paths are rejected. The OAuth callback removes its token-bearing URL from history and lets protected routes load the real account profile.

Dashboard search, status, sort, pagination, and the link creator are represented by `q`, `status`, `sort`, `page`, and `create` query parameters. Analytics uses `range`. Admin sections use route paths, and settings use named section paths. These views survive refresh and browser navigation. A link opened for analytics carries the link-list return location so “Back to links” retains filters. Scroll position and keyboard focus are managed on page navigation; hash targets account for the sticky header.

Pricing uses the same plan-review and provider checkout component as Billing. Plan and cycle can be preselected through `plan` and `cycle` query parameters. An anonymous visitor returns to the selected plan after authentication; checkout still requires an explicit review. Purchasing a different plan, renewing, and scheduling a free downgrade follow the billing policies already implemented. No simulated payments are introduced.

Loading and render failures have recovery UI. Help includes searchable product guides and real setup destinations. Focused workspace and account pages keep the assistant out of the content area; assistance remains available on the website, pricing, and help pages.

## Verification

- `npm run test:navigation`, `npm run test:workspace`, `npm run test:auth`, `npm run test:billing`, and `npm run build` in `frontend`.
- Targeted ESLint checks cover the route infrastructure, shared layout, and changed public/workspace pages.
- `node frontend/test/navigation-preview.mjs` starts a separate fixture server on `127.0.0.1:5234`. It renders the real frontend and authentication context against fictional HTTP responses, with no backend proxy or payment-provider calls.
- With Playwright available, run `node frontend/test/navigation.browser.mjs`. `PLAYWRIGHT_MODULE_PATH` and `PLAYWRIGHT_CHROMIUM_PATH` can select an existing Playwright installation and browser. The checks cover authentication return paths, legacy and canonical redirects, role restrictions, filters, checkout review, help search and anchors, protected-link routing, mobile menus, themes, and administrator deep links. Screenshots and a results file are saved in `image/workspace-preview/navigation`.

Navigation browser checks use fixtures; they do not exercise live accounts or external services. Production hosting must continue serving SPA routes through `index.html`, while `/api/`, `/r/`, and `/socket.io/` go to the backend. The existing Nginx configuration already does this; Vite now also proxies `/r/` in development.
