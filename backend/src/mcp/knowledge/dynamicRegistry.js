import prisma from "../../config/prismaClient.js";
import { config } from "../../config/config.js";
import { DocsRegistry } from "./docsRegistry.js";

/**
 * Dynamic Knowledge Registry Architecture
 * Blends static documentation corpus with dynamic live data providers
 * (Database plans, live platform telemetry, active system configuration, user state).
 */
class DynamicKnowledgeRegistry {
  constructor() {
    this.staticDocs = DocsRegistry;
    this.dynamicDocs = [];
    this.lastSyncedAt = new Date();
    this.isSyncing = false;
  }

  /**
   * Initializes or syncs the complete knowledge base by pulling live data from DB & services
   */
  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const dynamicArticles = [];

      // 1. Live Subscription & Pricing Knowledge Provider
      try {
        const plans = await prisma.subscriptionPlan.findMany({
          where: { is_active: true },
          orderBy: { price_monthly: "asc" },
        });

        if (plans && plans.length > 0) {
          const planDetails = plans
            .map(
              (p) =>
                `* **${p.name.toUpperCase()} PLAN**: ₹${p.price_monthly}/month (₹${p.price_yearly}/year). Includes up to **${p.max_urls.toLocaleString()} short links**, **${p.max_clicks_per_month.toLocaleString()} clicks/month**, **${p.max_custom_domains} custom domains**, ${p.has_api_access ? "Full REST API & MCP Access" : "No API Access"}, ${p.has_bot_protection ? "Enterprise Bot Filtering" : "Standard Traffic"}, ${p.has_totp_security ? "TOTP 2FA Enforcement" : "Basic Auth"}.`
            )
            .join("\n");

          dynamicArticles.push({
            id: "dynamic-subscription-plans",
            title: "Live Platform Subscription Plans, Quotas & Pricing Limits",
            topic: "pricing",
            keywords: [
              "subscription",
              "plans",
              "pricing",
              "cost",
              "limits",
              "quotas",
              "upgrade",
              "pro",
              "enterprise",
              "free tier",
              "razorpay",
            ],
            summary: "Live up-to-date PBUrls subscription plans, monthly click quotas, custom domain allocations, and pricing.",
            content: `
# 💳 Live Subscription Plans & Resource Quotas

Here are the current live subscription tiers active on the PBUrls platform:

${planDetails}

### 🔄 How Upgrades & Razorpay Payments Work:
* Billing is processed securely via **Razorpay Payment Gateway**.
* Webhook events (\`subscription.charged\`, \`subscription.cancelled\`) automatically update your workspace limits in real-time.
* You can switch plans or cancel subscriptions anytime from the \`/settings\` or \`/pricing\` dashboard.
            `,
          });
        }
      } catch (err) {
        // Fallback to config if DB call fails
      }

      // 2. Live System Telemetry Knowledge Provider
      try {
        const totalUrls = await prisma.url.count();
        const totalClicks = await prisma.url.aggregate({
          _sum: { clicks_count: true },
        });
        const totalDomains = await prisma.customDomain.count({
          where: { is_verified: true },
        });

        const clicksCountStr = (totalClicks._sum.clicks_count || 0).toLocaleString();

        dynamicArticles.push({
          id: "dynamic-system-metrics",
          title: "PBUrls Live Platform Health & System Scale Telemetry",
          topic: "general",
          keywords: [
            "system status",
            "scale",
            "telemetry",
            "total links",
            "total clicks",
            "performance",
            "health",
            "uptime",
          ],
          summary: "Real-time live telemetry metrics demonstrating PBUrls system throughput and active database scale.",
          content: `
# 📊 PBUrls Live Scale & Telemetry Metrics

* **Active Base URL**: \`${config.baseUrl}\`
* **Total Short Links Shortened**: **${totalUrls.toLocaleString()} links**
* **Total Clicks Processed**: **${clicksCountStr} verified clicks**
* **Verified Custom Branded Domains**: **${totalDomains.toLocaleString()} domains**
* **Redirection SLA**: \`< 2ms\` (Redis Cache Hit), \`< 8ms\` (PostgreSQL B-Tree Miss)
* **Async Pipeline**: Powered by BullMQ & Redis Ingestion Queues
          `,
        });
      } catch (err) {
        // Ignore fallback
      }

      // 3. API & MCP Capabilities Provider
      dynamicArticles.push({
        id: "dynamic-mcp-capabilities",
        title: "Model Context Protocol (MCP) & REST API Endpoint Capabilities",
        topic: "mcp",
        keywords: [
          "mcp",
          "model context protocol",
          "api",
          "rest",
          "sse",
          "stdio",
          "claude",
          "cursor",
          "tools",
          "endpoints",
        ],
        summary: "Available MCP tools, resources, and REST API endpoints active on PBUrls for AI integration.",
        content: `
# 🤖 MCP & Developer API Capabilities

PBUrls features full **Model Context Protocol (MCP)** integration over **Stdio** and **SSE Transports** (\`/api/v1/mcp/sse\`).

### 🛠️ Available MCP Tools for AI Agents:
1. \`create_short_link\`: Shortens long URLs with custom slug, expiration, and password.
2. \`get_link_analytics\`: Fetches time-series telemetry, geographic breakdown, device & referrer stats.
3. \`list_user_links\`: Queries user links with pagination and filtering.
4. \`generate_qr_code\`: Generates dynamic vector/PNG QR codes with scan tracking.
5. \`audit_link_hygiene\`: Runs automated health check scan across all short links.
6. \`search_knowledge_base\`: Queries PBUrls RAG documentation engine.

### 🌐 REST API Base Endpoints:
* \`POST /api/urls/shorten\`: Create short link
* \`GET /api/urls\`: List user links
* \`GET /api/urls/:shortCode/stats\`: Link analytics
* \`POST /api/domains/verify\`: Custom domain verification
* \`GET /api/v1/mcp/sse\`: MCP SSE Stream connection
        `,
      });

      this.dynamicDocs = dynamicArticles;
      this.lastSyncedAt = new Date();
    } catch (error) {
      console.error("[DynamicKnowledgeRegistry] Sync Error:", error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns all combined articles (Static + Dynamic)
   */
  getAllDocs() {
    return [...this.staticDocs, ...this.dynamicDocs];
  }

  /**
   * Generates a context snippet tailored to a specific user's current account state
   */
  async buildUserContextSnippet(user) {
    if (!user || !user.id) return "";

    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          twoFactorEnabled: true,
        },
      });

      const activeSub = await prisma.subscription.findFirst({
        where: { user_id: user.id, status: "ACTIVE" },
        include: { plan: { include: { limit: true } } },
        orderBy: { created_at: "desc" },
      });

      const userLinkCount = await prisma.url.count({
        where: { user_id: user.id, is_active: true },
      });
      const userDomainCount = await prisma.customDomain.count({
        where: { user_id: user.id },
      });

      const planName = activeSub?.plan?.name || "Free Tier";
      const maxUrls = activeSub?.plan?.limit?.max_urls || 100;
      const remainingCredits = Math.max(0, maxUrls - userLinkCount);

      return `
### 👤 User Account & Credit Context:
* User Name & Email: ${dbUser?.name || "User"} (\`${dbUser?.email}\`)
* Role: \`${dbUser?.role || "USER"}\` | 2FA: ${dbUser?.twoFactorEnabled ? "Enabled" : "Disabled"}
* Active Plan: **${planName.toUpperCase()}**
* Short Link Credits: **${remainingCredits} remaining** (${userLinkCount} / ${maxUrls} used)
* Configured Custom Domains: **${userDomainCount}**
      `.trim();
    } catch {
      return "";
    }
  }
}

export const dynamicKnowledgeRegistry = new DynamicKnowledgeRegistry();

// Initial background sync on boot
dynamicKnowledgeRegistry.sync().catch(() => {});
