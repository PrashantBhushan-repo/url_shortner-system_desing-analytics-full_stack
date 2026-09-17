/**
 * Comprehensive Enterprise Knowledge Corpus of PBUrls
 * Covers 8 Core Sections:
 * 1. Shortening, Redirection, Custom Aliases, Expiration, Passwords & Dynamic QR Codes
 * 2. Payments, Razorpay Procedures, Checkout Workflow & Plan Availability
 * 3. Analytics Dashboard, Telemetry Breakdown, GeoIP & HyperLogLog (HLL)
 * 4. Billing Management, Invoices, Subscription Cancellations & Refund Guidelines
 * 5. Authorization & Authentication (JWT, OAuth, TOTP 2FA, RBAC, API Keys)
 * 6. Admin Portal Options, Platform Metrics, User Moderation & Plan Administration
 * 7. Settings Page Features (Profile, Custom Domains CNAME, Webhooks HMAC, Teams)
 * 8. Platform Security, Rate Limiting, Bot Crawlers, HTTP Headers & MCP Controls
 */
export const DocsRegistry = [
  // SECTION 1: Shortening, Redirection, Aliases & QR Codes
  {
    id: "url-shortening-redirection-qr",
    title: "URL Shortening, HTTP 302 Redirection, Custom Aliases, Expiration, Password Protection & Dynamic QR Codes",
    topic: "links",
    keywords: [
      "shorten", "redirect", "alias", "custom slug", "qr code", "dynamic qr",
      "password protection", "expiration", "expires_at", "base62", "custom domain",
      "vector qr", "svg", "png", "scan tracking", "active status", "tags", "302"
    ],
    summary: "Complete guide to URL shortening options, custom alias/slug generation, password encryption (bcrypt), link expiration, HTTP 302 redirection engine, and dynamic vector QR code scan tracking.",
    content: `
# 🔗 1. URL Shortening, Redirection Engine & Dynamic QR Codes

PBUrls provides a high-throughput link management and redirection engine.

### 🌟 Core URL Shortening Capabilities:
1. **Base62 & Custom Slugs**:
   * **Auto-generated Slugs**: Converted via Base62 bijective algorithm (\`[0-9a-zA-Z]\`), providing \(56.8\\text{ Billion}\) combinations for 6-character codes.
   * **Custom Slugs / Aliases**: Users can define branded custom aliases (e.g. \`pburls.com/r/summer-sale\`) up to 64 alphanumeric characters.
2. **Custom Domain Association**: Attach registered custom domains (e.g. \`go.yourbrand.com/r/slug\`) to shorten URLs under your own company brand.
3. **Password-Protected Links**:
   * Encrypted using **bcrypt with salt rounds**.
   * Visitors attempting to access a password-protected link are routed to \`/p/:shortCode\` to enter the password before being redirected to the destination.
4. **Expiring Short Links**:
   * Set optional expiration timestamps (\`expires_at\`).
   * When expired, PBUrls returns HTTP **410 Gone** and halts redirection.
5. **Link Activation & Hygiene Controls**:
   * Instantly toggle links on/off (\`is_active = false\`).
   * Automated health checkers test target URLs and record failure counts (\`health_check_failures\`).

### 📱 Dynamic Vector QR Code Engine:
* **Real-time Scan Telemetry**: Every QR code scan is automatically tracked with device type, location, and timestamp.
* **Dynamic Target Updating**: Update the destination URL at any time without needing to re-print physical QR codes!
* **High-Res Downloads**: Export QR codes in scalable SVG vector format or high-DPI PNGs for print, posters, and product packaging.
* **Quick Command**: Use command \`/qr for <shortCode>\` in the AI Assistant to generate QR codes on demand.

### ⚡ HTTP 302 Redirection & Caching Strategy:
* **HTTP 302 (Found)** guarantees 100% telemetry capture on every click.
* **Dual-Tier Cache Topology**: Hot redirect links resolve in memory via **Redis** (\`< 2ms\`) with fallback to **PostgreSQL B-Tree indexed queries** (\`< 8ms\`).
* **Cache Stampede Prevention**: Uses a long Redis TTL (6 hours) with Single-Flight locks to prevent database spikes during viral traffic surges.
    `,
  },

  // SECTION 2: Payments, Procedures & Plan Availability
  {
    id: "payments-subscriptions-pricing",
    title: "Payments Procedure, Razorpay Integration, Checkout Workflow & Subscription Plan Availability",
    topic: "pricing",
    keywords: [
      "payments", "razorpay", "checkout", "subscription", "plans", "pricing",
      "free tier", "pro plan", "enterprise plan", "coupons", "discount", "currency",
      "razorpay_signature", "order_id", "billing cycle", "upgrade"
    ],
    summary: "Detailed overview of available subscription plans, Razorpay payment procedure, checkout order creation, coupon validation, and monthly vs. yearly billing availability.",
    content: `
# 💳 2. Payment Details, Procedures & Subscription Plan Availability

PBUrls offers flexible subscription tiers and payment flows powered by **Razorpay Payment Gateway**.

### 📦 Subscription Plans & Resource Allocations:
1. **FREE TIER** (₹0/month):
   * **Resource Limits**: Up to 100 short links, 5,000 clicks/month, 0 custom domains, standard traffic.
2. **PRO PLAN** (₹499/month or ₹4,999/year):
   * **Resource Limits**: Up to 5,000 short links, 250,000 clicks/month, 5 custom domains, full REST API & MCP access, bot filtering, TOTP 2FA.
3. **ENTERPRISE PLAN** (₹1,999/month or ₹19,999/year):
   * **Resource Limits**: Unlimited short links, 5,000,000 clicks/month, 50 custom domains, priority support, dedicated IP, HMAC webhooks, custom SLA.

### 🔄 Razorpay Payment Procedure & Checkout Flow:
1. **Plan Selection**: Select Monthly or Yearly billing cycle on the \`/pricing\` page.
2. **Coupon Code Validation**: Optional promo coupons can be applied at checkout. The system validates active date ranges (\`valid_until\`), max redemption limits, and plan applicability.
3. **Order Creation**: Server initializes a Razorpay Order via \`Razorpay.orders.create()\`, returning an \`order_id\` and exact amount in INR currency subunit (paise).
4. **Client Modal Checkout**: Razorpay Checkout Modal opens in the browser. Supports Credit/Debit Cards, UPI (Google Pay, PhonePe, Paytm), NetBanking, and Wallets.
5. **Cryptographic Signature Verification**: Upon successful payment, the backend verifies \`razorpay_signature\` using HMAC-SHA256:
   \`\`\`javascript
   const expectedSig = crypto.createHmac('sha256', keySecret).update(order_id + '|' + payment_id).digest('hex');
   \`\`\`
6. **Instant Provisioning**: Once verified, user workspace limits and subscription status (\`ACTIVE\`) update immediately.
    `,
  },

  // SECTION 3: Analytics Section Features
  {
    id: "analytics-telemetry-hll",
    title: "Analytics Section Features, Time-Series Telemetry, GeoIP Mapping & Redis HyperLogLog (HLL)",
    topic: "analytics",
    keywords: [
      "analytics", "telemetry", "clicks", "unique visitors", "hll", "hyperloglog",
      "geoip", "maxmind", "country", "city", "device", "browser", "os", "referrer",
      "bot filtering", "export csv", "json report", "time series", "analytics page"
    ],
    summary: "Detailed guide to features available in the Analytics section including click breakdowns, GeoIP mapping, device categories, HyperLogLog unique visitor estimation, and CSV export.",
    content: `
# 📊 3. Analytics Section & Telemetry Features

The Analytics section (\`/analytics\`) delivers real-time click telemetry and visitor insights.

### 📈 Available Features in the Analytics Section:
1. **Click Performance Dashboard**:
   * **Total Clicks**: Cumulative click count across selected time ranges (24 hours, 7 days, 30 days, 90 days, or custom range).
   * **Time-Series Charts**: Granular hourly and daily click distribution graphs.
2. **Unique Visitor Counting via Redis HyperLogLog (HLL)**:
   * Uses Redis \`PFADD\` and \`PFCOUNT\` algorithms for memory-efficient unique visitor estimation.
   * Tracks up to **1 Billion unique visitors using only 12 KB memory** with \`< 0.81%\` standard error.
3. **Geographic Distribution (GeoIP)**:
   * Integrates **MaxMind GeoIP database** to map visitor IP addresses to Country, Region, and City.
   * Interactive world map and country breakdown tables.
4. **Device, Browser & Operating System Breakdown**:
   * **Device Types**: Desktop, Mobile, Tablet, Smart TV, Bot.
   * **Browsers**: Chrome, Safari, Firefox, Edge, Opera, Samsung Internet.
   * **Operating Systems**: iOS, Android, Windows, macOS, Linux.
5. **Referrer & Source Attribution**:
   * Identifies traffic origin: Direct, Social Media (Twitter/X, LinkedIn, Facebook, Instagram), Search Engines (Google, Bing), External Domains.
6. **Automated Bot & Crawler Filtering**:
   * Social crawlers (Slackbot, Twitterbot, Googlebot, LinkedInBot) are separated using user-agent signature inspection.
   * Toggle between **Human Only Clicks** vs **Raw All Traffic**.
7. **Telemetry Data Export**:
   * Download analytics data in **CSV** or **JSON** formats for external business intelligence and reporting.
    `,
  },

  // SECTION 4: Billing & Refund Guidelines
  {
    id: "billing-refund-guidelines",
    title: "Billing Management, Invoices, Subscription Modifications & Refund Policy Guidelines",
    topic: "pricing",
    keywords: [
      "billing", "refund", "invoice", "receipt", "cancellation", "downgrade",
      "upgrade", "prorated", "razorpay refund", "7 day money back", "policy",
      "billing history", "auto renewal"
    ],
    summary: "Comprehensive guidelines on billing management, downloading invoice receipts, prorated subscription upgrades, cancellation procedures, and 7-day refund policy rules.",
    content: `
# 📄 4. Billing, Invoices & Refund Policy Guidelines

Complete operational guidelines for managing your subscription billing, invoices, and refunds.

### 💳 Billing & Invoice Management:
1. **Invoice History**: View all historical payment transactions under \`/settings\` -> **Billing & Subscription**. Download official tax invoices with breakdown of GST/Tax, plan name, and transaction IDs.
2. **Subscription Upgrades & Downgrades**:
   * Upgrading from Free to Pro or Enterprise takes effect immediately upon payment confirmation.
   * Prorated credits are applied when upgrading mid-cycle.
3. **Subscription Cancellation**:
   * You can cancel auto-renewal anytime from \`/settings\`.
   * Upon cancellation, your workspace retains active plan quotas until the end of the current paid billing cycle (\`cancel_at_period_end = true\`).

### 🛡️ Refund Policy Guidelines:
1. **7-Day Money-Back Guarantee**:
   * New subscribers to paid plans (Pro or Enterprise) are eligible for a **100% full refund** within **7 days** of the initial subscription purchase.
2. **Refund Eligibility Criteria**:
   * Request must be submitted within 7 calendar days of transaction date.
   * Workspace must not have violated platform Terms of Service (e.g. spamming, phishing, malware link distribution).
3. **Refund Processing Procedure**:
   * To request a refund, contact support or click **Request Refund** in Billing Settings.
   * Refunds are processed via Razorpay API (\`Razorpay.payments.refund()\`).
   * Funds return to the original payment source (Card, UPI, NetBanking) within **5 to 7 business days**.
    `,
  },

  // SECTION 5: Authorization & Authentication
  {
    id: "auth-jwt-totp-apikeys",
    title: "Authorization, Authentication, JWT Tokens, OAuth, TOTP 2FA & Scoped API Keys",
    topic: "mcp",
    keywords: [
      "auth", "authentication", "authorization", "jwt", "refresh token", "access token",
      "google oauth", "github oauth", "totp", "2fa", "two factor", "bcrypt", "rbac",
      "admin role", "user role", "api key", "bearer token", "session", "cookie"
    ],
    summary: "In-depth guide to PBUrls security architecture including JWT authentication, OAuth login, TOTP 2FA setup, Role-Based Access Control (RBAC), and developer API keys.",
    content: `
# 🔐 5. Authorization, Authentication & Access Control

PBUrls enforces security protocols for user authentication and developer API access.

### 🔑 User Authentication Protocols:
1. **JWT Dual-Token Authentication**:
   * **Access Token**: Short-lived JSON Web Token (15-minute expiration) sent in authorization header.
   * **Refresh Token**: Long-lived token stored in HTTP-Only, Secure, SameSite cookie (\`refreshToken\`).
2. **OAuth 2.0 Third-Party Authentication**:
   * Supports **Google OAuth** and **GitHub OAuth** social logins.
   * Accounts are automatically provisioned and linked via verified email addresses.
3. **Password Security**: Passwords are hashed using **bcrypt** with salt rounds. Plaintext passwords are never logged or stored.

### 🛡️ Two-Factor Authentication (TOTP 2FA):
* Supports standard Authenticator apps (Google Authenticator, Authy, 1Password, Microsoft Authenticator).
* Implements **RFC 6238 TOTP algorithm** with 30-second time windows.
* Generates 8 single-use emergency **Backup Recovery Codes** during 2FA setup.

### 👥 Role-Based Access Control (RBAC):
* **\`USER\`**: Standard account with personal link management, custom domain configuration, and billing controls.
* **\`ADMIN\`**: Platform administrator with access to platform-wide telemetry, user management, and plan creation.
* **\`SUPER_ADMIN\`**: Full operational rights including billing refunds, system configuration, and database maintenance.

### 🔑 Developer API Keys:
* Generate scoped API keys under \`/settings\` -> **Developer API Keys**.
* Keys use prefix format: \`pb_live_xxxxxxxx...\`
* HTTP Bearer Header: \`Authorization: Bearer pb_live_...\`
* API Key Permission Scopes: \`READ\` (analytics/links query), \`WRITE\` (link creation/edits), \`ADMIN\` (full workspace control).
    `,
  },

  // SECTION 6: Admin Section Features
  {
    id: "admin-dashboard-management",
    title: "Admin Section Options, System Telemetry, User Management, Plan Creation & Billing Audit",
    topic: "general",
    keywords: [
      "admin", "admin portal", "admin dashboard", "user management", "ban user",
      "suspend", "plan creation", "billing audit", "refund administration",
      "platform metrics", "system load", "knowledge sync", "link moderation"
    ],
    summary: "Complete guide to options available in the Admin section including platform health overview, user management, plan limit customization, financial audits, and link moderation.",
    content: `
# ⚙️ 6. Admin Section Options & Management Portal

The Admin Portal (\`/admin\`) provides administrators with complete oversight of platform operations.

### 🛠️ Options & Capabilities Available in the Admin Section:
1. **Platform Overview & Telemetry Dashboard**:
   * **System Totals**: Real-time count of total registered users, active short links, total platform clicks, and verified custom domains.
   * **Server Metrics**: Redis cache hit ratios, queue backlog sizes, database connections, and memory usage.
2. **User Management & Account Administration**:
   * **User Search & Directory**: Search registered users by name, email, or user ID.
   * **Account Suspension / Ban**: Instantly suspend abusive user accounts, disabling all their shortened links.
   * **Manual Plan Overrides**: Manually upgrade user tiers or grant custom resource allocations (e.g. extra domain allowance).
3. **Link Moderation & Abuse Control**:
   * **System Link Search**: Inspect short links across the entire platform.
   * **Phishing & Spam Deactivation**: Flag and force-deactivate harmful or illegal links.
4. **Subscription Plan Administration (\`adminPlan.controller.js\`)**:
   * Create new subscription plans or update existing tier parameters (monthly price, yearly price, max link count, monthly click quota, custom domain quota, bot protection toggle, TOTP 2FA requirement).
5. **Financial & Billing Audit (\`adminBilling.controller.js\`)**:
   * Revenue analytics, monthly recurring revenue (MRR), total gross revenue.
   * Inspect all Razorpay order transactions, webhook events, and payment failures.
   * Issue administrative refunds directly to customer payment methods.
6. **Knowledge Base Synchronization**:
   * Execute manual trigger to re-index system documentation, active subscription plans, and API capabilities into RAG memory.
    `,
  },

  // SECTION 7: Settings Page Features
  {
    id: "settings-domains-webhooks-teams",
    title: "Settings Page Features: Profile Settings, Custom Domains CNAME/SSL, Webhooks HMAC & Team Collaboration",
    topic: "domains",
    keywords: [
      "settings", "profile", "custom domain", "cname", "dns", "ssl", "webhook",
      "hmac", "team", "workspace", "collaboration", "api keys", "security settings",
      "2fa setup", "change password", "notifications"
    ],
    summary: "Detailed walkthrough of all features available on the Settings page including profile updates, custom domain CNAME/SSL setup, HMAC webhooks, API key generation, and team workspaces.",
    content: `
# ⚙️ 7. Settings Page Features & Configuration

The Settings page (\`/settings\`) contains tabs for account management, branding, webhooks, security, and team collaboration.

### 🛠️ Available Features & Tabs in Settings:
1. **Profile Settings**:
   * Update display name, email address, bio, and upload custom profile avatar.
   * Choose interface theme (Light / Dark Mode) and preferred AI assistant tone (Technical / Concise / Marketing).
2. **Custom Branded Domains**:
   * Add custom subdomains (e.g. \`links.mybrand.com\`).
   * **DNS Setup**: Point a **CNAME Record** to \`cname.pburls.com\`.
   * Automated verification check (\`dns.resolveCname\`) and automatic TLS/SSL certificate issuance.
3. **Security & Session Management**:
   * Change account password.
   * Enable/Disable **TOTP 2FA Authenticator**. View and generate fresh backup codes.
   * Inspect active login sessions with IP address, browser, OS, and remote session termination.
4. **Developer API Keys**:
   * Generate new secret API keys (\`pb_live_...\`).
   * Assign key name, expiration date, and permission scopes (\`READ\`, \`WRITE\`, \`ADMIN\`).
   * Revoke active keys instantly.
5. **HMAC Signed Webhooks**:
   * Register HTTP POST webhook endpoints to receive real-time events (\`click.recorded\`, \`link.expired\`, \`domain.verified\`).
   * Copy shared secret for **HMAC-SHA256 signature verification**.
   * Test webhook endpoint payloads on demand.
6. **Team Collaboration & Workspaces**:
   * Invite team members via email.
   * Assign granular team roles: \`OWNER\` (full management), \`MEMBER\` (create/edit links), \`VIEWER\` (read analytics only).
   * Share branded links and domain assets across workspace members.
    `,
  },

  // SECTION 8: Platform Security & Protection Features
  {
    id: "security-rate-limiting-protection",
    title: "Platform Security Architecture, Rate Limiting, Bot Protection, HTTP Headers & MCP Controls",
    topic: "general",
    keywords: [
      "security", "rate limiting", "express rate limit", "helmet", "bot protection",
      "http headers", "csrf", "xss", "cors", "mcp security", "permissions", "idempotency",
      "password link", "link expiration", "abuse prevention"
    ],
    summary: "Comprehensive details on security mechanisms in PBUrls including rate limiting, Helmet HTTP headers, bot crawler protection, password link encryption, and MCP access control.",
    content: `
# 🛡️ 8. Platform Security, Rate Limiting & Protection Mechanisms

PBUrls incorporates defense-in-depth security measures to protect user data, infrastructure, and URL integrity.

### 🛡️ Core Security Features & Guidelines:
1. **HTTP Security Headers & CORS**:
   * Enforces **Helmet.js** middleware: \`X-Content-Type-Options: nosniff\`, \`Referrer-Policy: no-referrer\`, \`X-XSS-Protection: 1; mode=block\`.
   * Configures CORS with explicit client origins, allowed headers, and credential support.
2. **Multi-Tier Rate Limiting**:
   * **Link Creation Limiter** (\`createUrlLimiter\`): Restricts URL shortening requests per minute to prevent database spam.
   * **Redirect Endpoint Limiter** (\`redirectLimiter\`): Protects edge servers against DDoS amplification attacks.
   * **Auth Endpoint Limiter**: Prevents credential brute-forcing on login/register routes.
3. **Bot & Crawler Traffic Isolation**:
   * Automatic inspection of incoming user-agent strings isolates automated crawlers (Slackbot, Googlebot, Twitterbot).
   * Bot traffic is flagged (\`is_bot = true\`) to protect clean analytics dashboards.
4. **Password-Protected & Expiring Links**:
   * Sensitive links can be encrypted with bcrypt passwords.
   * Automatic timestamp enforcement returns HTTP **410 Gone** for expired links.
5. **Model Context Protocol (MCP) Access Control**:
   * Validates tool permission scopes (\`READ\`, \`WRITE\`, \`ADMIN\`) before executing AI actions.
   * **Idempotency Key Verification**: Prevents duplicate link creations or mutations during AI request retries.
    `,
  },

  // FOUNDATIONAL TECHNICAL ARTICLES
  {
    id: "about-pburls",
    title: "PBUrls Platform Overview & Dual-Tier Architecture",
    topic: "general",
    keywords: ["what is pburls", "overview", "architecture", "features", "how it works", "redis", "postgres", "dual tier", "high throughput"],
    summary: "PBUrls is an enterprise-grade URL shortener, link management platform, and real-time telemetry engine engineered for high-throughput sub-2ms redirects.",
    content: `
# 🌐 PBUrls Platform Overview & System Architecture

PBUrls is a modern, high-performance link management and analytics engine built for creators, marketing organizations, and developer platforms.

### 🏛️ Core Architectural Highlights:
* **Sub-2ms Redirection Engine**: Implements a dual-tier caching topology where hot links resolve in memory via **Redis** (\`< 2ms\`) with fallback to **PostgreSQL B-Tree indexed queries** (\`< 8ms\`).
* **Decoupled Telemetry Pipeline**: Click analytics are buffered asynchronously into **BullMQ Redis message queues**, preventing database disk I/O contention during viral traffic surges.
* **Real-Time Click Telemetry**: Tracks total clicks, unique visitors (**HyperLogLog**), geographic countries/cities (**MaxMind GeoIP**), device models, browsers, operating systems, and referrers.
* **Automated Bot & Scraper Filtering**: Separates automated social crawlers (Twitterbot, Slackbot, Googlebot) from genuine human conversions.
* **Branded Custom Domains**: Point your own domain (e.g. \`go.yourbrand.com\`) via DNS CNAME records with automated TLS/SSL.
* **Dynamic QR Codes**: Instant vector and high-resolution PNG QR codes with built-in scan tracking.
* **Enterprise AI Gateway & MCP**: Full integration with Claude Desktop, Cursor IDE, and cloud AI agents via Model Context Protocol (MCP).
    `,
  },
  {
    id: "base62-dsa-encoding",
    title: "DSA & Algorithm: Base62 Encoding & Bijective Short Codes",
    topic: "dsa",
    keywords: ["base62", "algorithm", "dsa", "encoding", "bijective", "hash", "short code generation", "collision", "math", "slug"],
    summary: "How Base62 encoding, mathematical character spaces (56.8 Billion keys), and the looping collision resolver work in PBUrls.",
    content: `
# 🔢 DSA: Base62 Encoding & Bijective Slug Generation

When shortening a destination URL, PBUrls converts numerical IDs or cryptographic tokens into compact, URL-safe short strings using **Base62 Bijective Mapping**.

### 1. Why Base62 Instead of Base64?
* **URL Safety**: Standard Base64 contains \`+\` and \`/\` characters, which have reserved syntactic meanings in URLs and require URL encoding.
* **Character Set**: Base62 uses strictly alphanumeric characters: \`[0-9a-zA-Z]\` (10 digits + 26 lowercase + 26 uppercase = 62 characters).
* **Information Density**: A 6-character Base62 string represents \(62^6 = 56,800,235,584\) (over **56.8 Billion**) unique combinations.

### 2. Conversion Algorithm:
\`\`\`text
Algorithm EncodeBase62(number):
    characterSet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    shortCode = ""
    while number > 0:
        remainder = number % 62
        shortCode = characterSet[remainder] + shortCode
        number = Math.floor(number / 62)
    return shortCode
\`\`\`
* **Time Complexity**: \(O(\\log_{62} N)\) — executes in under \`0.05 microseconds\`.
* **Space Complexity**: \(O(1)\) auxiliary memory.

### 3. Crypto-Random Slugs & Collision Resolution:
To protect against sequential ID harvesting (where attackers scrape sequential URLs \`r/A123\`, \`r/A124\`), PBUrls generates crypto-random tokens and uses a **Looping Collision Resolver**:
* If PostgreSQL returns unique constraint violation (\`23505\` on \`short_code\`), the transaction rolls back, increments the attempt counter, and regenerates a fresh random slug.
    `,
  },
];
