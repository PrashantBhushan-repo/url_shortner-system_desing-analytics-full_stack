import { buildUserContext } from "../mcp/server/context.js";
import { knowledgeSearchEngine } from "../mcp/knowledge/searchEngine.js";
import { dynamicKnowledgeRegistry } from "../mcp/knowledge/dynamicRegistry.js";
import { syncKnowledgeBase } from "../mcp/knowledge/index.js";
import { shortenUrl, generateUrlQrCode } from "../services/url.service.js";
import { getUserTopLinks } from "../services/analytics.service.js";
import prisma from "../config/prismaClient.js";
import { config } from "../config/config.js";

/**
 * Intelligent Conversational Response Synthesizer
 * Formats RAG documents into crisp, natural, human-like responses with actionable next steps
 */
const synthesizeResponse = (doc, userQuery, userContextSnippet = "", tone = "technical") => {
  const lowerQuery = userQuery.toLowerCase();
  const summary = doc.summary || "";
  const title = doc.title || "PBUrls Information";

  // 1. Refunds & Cancellations
  if (lowerQuery.includes("refund") || lowerQuery.includes("money back") || lowerQuery.includes("cancel")) {
    return `### 💸 PBUrls Refund Policy & Subscription Cancellation Guidelines

* **7-Day 100% Money-Back Guarantee**: New Pro or Enterprise subscribers can request a full refund within **7 calendar days** of purchase.
* **How to Request**: Navigate to \`/settings\` -> **Billing** and click **Request Refund**, or contact customer support.
* **Processing**: Refunds are processed via Razorpay directly to your original payment method within **5 to 7 business days**.
* **Cancellation**: You can cancel auto-renewal anytime from \`/settings\`. Your account retains paid features until the billing period ends.`;
  }

  // 2. Custom Domains & CNAME
  if (lowerQuery.includes("cname") || lowerQuery.includes("custom domain") || lowerQuery.includes("dns") || lowerQuery.includes("subdomain")) {
    return `### 🌐 How to Configure a Custom Branded Domain

Using custom branded domains (e.g. \`go.yourbrand.com\`) increases click-through rates by **34%**.

1. **Add Domain**: Go to **[/domains](/domains)** and enter your subdomain (e.g. \`go.mycompany.com\`).
2. **Configure DNS CNAME**: Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap) and add a record:
   * **Type**: \`CNAME\`
   * **Host/Name**: \`go\` (your subdomain prefix)
   * **Target/Value**: \`cname.pburls.com\`
3. **Verify**: Click **Verify Domain** in PBUrls. Automatic SSL certificates are issued immediately once verified!`;
  }

  // 3. Pricing, Plans & Upgrades
  if (lowerQuery.includes("plan") || lowerQuery.includes("pricing") || lowerQuery.includes("cost") || lowerQuery.includes("pro") || lowerQuery.includes("enterprise") || lowerQuery.includes("upgrade")) {
    return `### 💳 PBUrls Subscription Plans & Limits

* **Free Plan** (₹0/mo): 100 short links, 5,000 clicks/month, standard redirect speed.
* **Pro Plan** (₹499/mo): 5,000 short links, 250,000 clicks/month, **5 custom domains**, full REST API & MCP access, bot filtering, TOTP 2FA.
* **Enterprise Plan** (₹1,999/mo): Unlimited short links, 5,000,000 clicks/month, **50 custom domains**, priority support, dedicated IP, HMAC webhooks.

👉 *View and upgrade plans on the **[/pricing](/pricing)** page.*`;
  }

  // 4. Analytics & Telemetry
  if (lowerQuery.includes("analytics") || lowerQuery.includes("traffic") || lowerQuery.includes("clicks") || lowerQuery.includes("hyperloglog") || lowerQuery.includes("geoip")) {
    return `### 📊 Analytics & Telemetry Features

* **Time-Series Charts**: View hourly and daily click graphs on **[/analytics](/analytics)**.
* **Unique Visitors (HyperLogLog)**: Uses Redis HLL algorithms for sub-1% error visitor counting.
* **Geographic & Device Mapping**: Breakdown traffic by Country/City (MaxMind GeoIP), Browsers, OS, and Device Types.
* **Bot Filtering**: Social crawlers (Slackbot, Twitterbot, Googlebot) are automatically filtered out.
* **CSV/JSON Export**: Download full telemetry reports anytime.`;
  }

  // 5. Auth, TOTP 2FA & API Keys
  if (lowerQuery.includes("totp") || lowerQuery.includes("2fa") || lowerQuery.includes("api key") || lowerQuery.includes("auth") || lowerQuery.includes("jwt")) {
    return `### 🔐 Security, 2FA & Developer API Keys

* **TOTP 2FA Setup**: Go to **[/settings](/settings)** -> Security. Scan the QR code with Google Authenticator or Authy and save your 8 recovery codes.
* **Developer API Keys**: Generate scoped keys (\`pb_live_...\`) under Settings -> API Keys. Pass key as header: \`Authorization: Bearer pb_live_...\`
* **OAuth Login**: Connect Google or GitHub for 1-click login.`;
  }

  // 6. Admin Options
  if (lowerQuery.includes("admin") || lowerQuery.includes("moderation") || lowerQuery.includes("suspend")) {
    return `### ⚙️ Admin Portal Features & Options

* **Platform Dashboard**: Monitor system total links, verified clicks, revenue, server load, and Redis queue hit ratios on **[/admin](/admin)**.
* **User Management**: View user directory, suspend abusive accounts, or grant custom plan quotas.
* **Plan Administration**: Customize monthly pricing, click quotas, and domain allowances.
* **Billing Audit**: Inspect Razorpay transaction logs and issue administrative refunds.`;
  }

  // 7. Settings Page Features
  if (lowerQuery.includes("setting") || lowerQuery.includes("profile") || lowerQuery.includes("webhook") || lowerQuery.includes("team")) {
    return `### ⚙️ What's Available in Settings

* **Profile & Theme**: Update name, email, avatar, and switch Light/Dark mode.
* **Custom Domains**: Manage CNAME domain verification and SSL certificates.
* **Security & Sessions**: Toggle TOTP 2FA and terminate remote browser sessions.
* **Developer API Keys & Webhooks**: Configure HMAC signed webhooks (\`click.recorded\`, \`link.expired\`) and secret API keys.
* **Team Workspaces**: Invite members and assign roles (\`OWNER\`, \`MEMBER\`, \`VIEWER\`).`;
  }

  // Default clean markdown synthesis
  let text = `### 💡 ${title}\n\n${summary}\n\n`;
  const cleanBody = doc.content
    .replace(/#+\s+.*?\n/g, "") // remove heavy h1 titles
    .trim();

  // Extract first 4 concise bullet sections or paragraphs
  const paragraphs = cleanBody.split("\n\n").filter((p) => p.trim().length > 0).slice(0, 3);
  text += paragraphs.join("\n\n");

  if (userContextSnippet) {
    text += `\n\n${userContextSnippet}`;
  }

  return text;
};

/**
 * Enterprise In-App AI Assistant Controller (Supports authenticated & guest visitors)
 */
export const handleAssistantChat = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { message, tone = "technical", pageContext = "/" } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    const user = req.user || null;
    let cleanMsg = message.trim();
    let lowerMsg = cleanMsg.toLowerCase();

    // 0. Handle Greetings & Smalltalk
    const greetingRegex = /^(h[ia|ey]+|hello+|greetings|good\s*(morning|afternoon|evening)|heyya|yo+)(\s+.*)?$/i;
    const smalltalkList = ["who are you", "what can you do", "help", "thanks", "thank you", "ok", "okay", "cool", "super"];

    if (greetingRegex.test(lowerMsg) || smalltalkList.includes(lowerMsg)) {
      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "GREETING",
        latencyMs,
        message: `👋 **Hi ${user?.name || "there"}! I'm your PBUrls AI Copilot.**\n\nI can help you shorten links, generate QR codes, analyze click telemetry, configure custom domains, check subscription plans, or answer any platform questions.\n\nHow can I help you today?`,
        suggestions: [
          "Create a short link",
          "Show subscription plans & limits",
          "How to configure custom domain CNAME?",
          "Show my top performing links",
        ],
      });
    }

    // Map Slash Commands
    if (lowerMsg.startsWith("/shorten")) {
      cleanMsg = cleanMsg.replace(/^\/shorten\s*/i, "shorten ");
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/qr")) {
      cleanMsg = cleanMsg.replace(/^\/qr\s*/i, "generate qr for ");
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/analytics") || lowerMsg.startsWith("/top")) {
      cleanMsg = "show my top performing links";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/hygiene") || lowerMsg.startsWith("/health")) {
      cleanMsg = "run a link hygiene check";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/dns") || lowerMsg.startsWith("/domain")) {
      cleanMsg = "how to configure custom domain CNAME?";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/plans") || lowerMsg.startsWith("/pricing")) {
      cleanMsg = "show subscription plans and limits";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/profile") || lowerMsg.startsWith("/me") || lowerMsg.startsWith("/info")) {
      cleanMsg = "show my account profile and info";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/credits") || lowerMsg.startsWith("/quota") || lowerMsg.startsWith("/balance")) {
      cleanMsg = "show my subscription plan and remaining credits";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/history")) {
      cleanMsg = "show my url generation history";
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/navigate") || lowerMsg.startsWith("/goto")) {
      cleanMsg = cleanMsg.replace(/^\/(navigate|goto)\s*/i, "take me to ");
      lowerMsg = cleanMsg.toLowerCase();
    } else if (lowerMsg.startsWith("/sync") || lowerMsg === "sync knowledge base") {
      await syncKnowledgeBase();
      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "ACTION_KNOWLEDGE_SYNC",
        latencyMs,
        message: `⚡ **Knowledge Base Synchronized Successfully!**\n\nRe-indexed all documentation, subscription plans, database telemetry, and API endpoints into memory.`,
        suggestions: ["Show subscription plans and limits", "How does bot filtering work?", "Show my top performing links"],
      });
    }

    // 1. Detect Intent: Shorten URL Action
    const urlMatch = cleanMsg.match(/(https?:\/\/[^\s]+)/i);
    const hasCreateKeyword =
      lowerMsg.includes("shorten") ||
      lowerMsg.includes("short link") ||
      lowerMsg.includes("create link") ||
      lowerMsg.includes("new link") ||
      lowerMsg.includes("make a link");

    if (urlMatch && hasCreateKeyword) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to Shorten Links**\n\nPlease [Sign In or Register](/auth) to create short URLs, generate QR codes, and track analytics.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits", "How does bot filtering work?"],
        });
      }

      const longUrl = urlMatch[0];
      const aliasMatch =
        cleanMsg.match(/alias\s+['"]?([a-zA-Z0-9_-]+)['"]?/i) ||
        cleanMsg.match(/slug\s+['"]?([a-zA-Z0-9_-]+)['"]?/i) ||
        cleanMsg.match(/with\s+['"]?([a-zA-Z0-9_-]+)['"]?/i);

      let customSlug = null;
      if (aliasMatch && aliasMatch[1] && !["link", "short", "alias", "slug", "a"].includes(aliasMatch[1].toLowerCase())) {
        customSlug = aliasMatch[1];
      }

      try {
        const link = await shortenUrl(longUrl, customSlug, null, user);
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "ACTION_CREATE_LINK",
          latencyMs,
          message: `✨ **Short Link Created Successfully!**\n\nYour short URL: \`${config.baseUrl}/r/${link.shortCode}\`\n\nDestination: [${link.longUrl}](${link.longUrl})`,
          data: { link },
          suggestions: [
            `Show analytics for ${link.shortCode}`,
            `Generate a QR code for ${link.shortCode}`,
            "Show my top performing links",
          ],
        });
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: false,
          type: "ACTION_ERROR",
          latencyMs,
          message: `❌ **Could not create link:** ${err.message}`,
          suggestion: "Try choosing a different custom slug or omitting it to generate an auto slug.",
          suggestions: ["List my links", "How do custom domains work?", "Show pricing plans"],
        });
      }
    }

    if (
      lowerMsg === "create a short link" ||
      lowerMsg === "create short link" ||
      lowerMsg === "shorten a link" ||
      lowerMsg === "new link" ||
      lowerMsg === "shorten"
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to Create Links**\n\nPlease [Sign In or Register](/auth) to create short URLs and manage links.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits", "How to configure custom domain?"],
        });
      }

      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "PROMPT_CREATE_LINK",
        latencyMs,
        message: `🔗 **Ready to create your short link!**\n\nPaste your destination URL below, or use the format:\n\`shorten https://yourwebsite.com with alias my-slug\``,
        suggestions: [
          "shorten https://github.com with alias my-repo",
          "shorten https://google.com with alias my-search",
          "How to configure custom domain?",
        ],
      });
    }

    // 2. Detect Intent: Generate QR Code Action
    if (lowerMsg.includes("qr") || lowerMsg.includes("qr code")) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required for QR Code Generation**\n\nPlease [Sign In or Register](/auth) to generate and download dynamic QR codes for your short links.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const codeMatch =
        cleanMsg.match(/for\s+['"]?([a-zA-Z0-9_-]+)['"]?/i) ||
        cleanMsg.match(/link\s+['"]?([a-zA-Z0-9_-]+)['"]?/i);

      let shortCode = codeMatch ? codeMatch[1] : null;

      if (!shortCode) {
        const latest = await prisma.url.findFirst({
          where: { user_id: user.id },
          orderBy: { created_at: "desc" },
        });
        if (latest) shortCode = latest.short_code;
      }

      if (shortCode) {
        try {
          const qrDataUrl = await generateUrlQrCode(shortCode, user);
          const latencyMs = Date.now() - startTime;
          return res.status(200).json({
            success: true,
            type: "ACTION_QR_CODE",
            latencyMs,
            message: `📱 **Dynamic QR Code Generated for \`${shortCode}\`**\n\nScans on this QR code are tracked with live telemetry analytics.`,
            data: { shortCode, qrDataUrl },
            suggestions: [`Show analytics for ${shortCode}`, "Run a link hygiene check", "List my links"],
          });
        } catch (err) {
          // fallback
        }
      }
    }

    // 3. Detect Intent: List Links Action
    if (
      lowerMsg.includes("list links") ||
      lowerMsg.includes("my links") ||
      lowerMsg.includes("show links") ||
      lowerMsg.includes("all links")
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to View Links**\n\nPlease [Sign In or Register](/auth) to view your links.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const userUrls = await prisma.url.findMany({
        where: { user_id: user.id, is_active: true },
        orderBy: { created_at: "desc" },
        take: 6,
      });
      const total = await prisma.url.count({
        where: { user_id: user.id, is_active: true },
      });
      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "ACTION_LIST_LINKS",
        latencyMs,
        message: `📋 **Your Personal Links Overview (${total} Total Links)**`,
        data: {
          total,
          links: userUrls.map((u) => ({
            id: u.id.toString(),
            longUrl: u.long_url,
            shortCode: u.short_code,
            shortUrl: `${config.baseUrl}/r/${u.short_code}`,
            clicksCount: Number(u.clicks_count || 0),
            createdAt: u.created_at,
          })),
        },
        suggestions: [
          "Show my top performing links",
          "Run a link hygiene check",
          "Create a short link",
        ],
      });
    }

    // 4. Detect Intent: Top Performing Links Action
    if (
      lowerMsg.includes("top link") ||
      lowerMsg.includes("top performing") ||
      lowerMsg.includes("most clicked")
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required for Analytics**\n\nPlease [Sign In or Register](/auth) to view your link analytics.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const topLinks = await getUserTopLinks(user.id, 5);
      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "ACTION_TOP_LINKS",
        latencyMs,
        message: `🏆 **Your Top Performing Links (Last 30 Days)**\n\nRanked by verified visitor engagement:`,
        data: {
          timeRange: "30d",
          topLinks,
        },
        suggestions: ["Run a link hygiene check", "How does bot filtering work?", "List my links"],
      });
    }

    // 5. Detect Intent: Link Hygiene / Audit
    if (
      lowerMsg.includes("hygiene") ||
      lowerMsg.includes("health check") ||
      lowerMsg.includes("broken link") ||
      lowerMsg.includes("audit link")
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required for Hygiene Check**\n\nPlease [Sign In or Register](/auth) to run health check scans.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const links = await prisma.url.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: "desc" },
        take: 20,
      });

      const failing = links.filter((l) => !l.is_alive || l.health_check_failures > 0);
      const healthy = links.filter((l) => l.is_active && l.is_alive && l.health_check_failures === 0);
      const latencyMs = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        type: "ACTION_HYGIENE_REPORT",
        latencyMs,
        message: `🩺 **Link Hygiene Audit Completed**\n\nScanned **${links.length}** links. Status: **${healthy.length} Healthy**, **${failing.length} Issues Detected**.`,
        data: {
          totalScanned: links.length,
          healthyCount: healthy.length,
          failingCount: failing.length,
          failingLinks: failing.map((f) => ({ shortCode: f.short_code, longUrl: f.long_url })),
        },
        suggestions: ["Show my top performing links", "How to configure custom domain CNAME?", "Create a short link"],
      });
    }

    // 5b. Detect Intent: User Account Profile & Personal Info
    if (
      lowerMsg.includes("my info") ||
      lowerMsg.includes("my profile") ||
      lowerMsg.includes("who am i") ||
      lowerMsg.includes("my email") ||
      lowerMsg.includes("password status") ||
      lowerMsg.includes("account details") ||
      lowerMsg.includes("account info") ||
      lowerMsg === "profile"
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to View Personal Profile**\n\nPlease [Sign In or Register](/auth) to view your account details and security status.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          twoFactorEnabled: true,
          createdAt: true,
          must_change_password: true,
          _count: {
            select: {
              apiKeys: true,
              webhooks: true,
              urls: true,
            },
          },
        },
      });

      const memberDate = dbUser?.createdAt ? new Date(dbUser.createdAt).toLocaleDateString() : "N/A";
      const latencyMs = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        type: "ACTION_USER_PROFILE",
        latencyMs,
        message: `### 👤 Account & Security Profile Overview

* **Name**: **${dbUser?.name || "N/A"}**
* **Email**: \`${dbUser?.email || "N/A"}\`
* **User ID**: \`${dbUser?.id}\`
* **Account Status**: **${dbUser?.status || "ACTIVE"}**
* **System Role**: \`${dbUser?.role || "USER"}\`
* **Member Since**: ${memberDate}
* **Total Short Links Created**: **${dbUser?._count?.urls || 0} Links**

#### 🛡️ Security & Authentication Posture:
* **Password Status**: ✅ **Active & Verified** *(Note: Plaintext passwords are never exposed for SOC2/AWS security compliance)*.
* **TOTP 2FA**: ${dbUser?.twoFactorEnabled ? "🔒 **Enabled** (Protected)" : "⚠️ **Disabled** (Recommended: [Enable 2FA in Settings](/settings))"}
* **Developer API Keys**: **${dbUser?._count?.apiKeys || 0} Active Keys**
* **HMAC Webhooks**: **${dbUser?._count?.webhooks || 0} Registered Webhooks**`,
        data: {
          user: {
            id: dbUser?.id,
            name: dbUser?.name,
            email: dbUser?.email,
            role: dbUser?.role,
            status: dbUser?.status,
            twoFactorEnabled: dbUser?.twoFactorEnabled,
            createdAt: dbUser?.createdAt,
            apiKeysCount: dbUser?._count?.apiKeys,
            webhooksCount: dbUser?._count?.webhooks,
            urlsCount: dbUser?._count?.urls,
          },
        },
        suggestions: [
          "Show my subscription plan and remaining credits",
          "Show my url generation history",
          "Take me to settings page",
        ],
      });
    }

    // 5c. Detect Intent: Subscription & Credit Balance Telemetry
    if (
      lowerMsg.includes("credit") ||
      lowerMsg.includes("remaining credit") ||
      lowerMsg.includes("my quota") ||
      lowerMsg.includes("my subscription") ||
      lowerMsg.includes("how many credit") ||
      lowerMsg === "balance"
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to View Credits**\n\nPlease [Sign In or Register](/auth) to inspect your subscription plan and remaining short link credits.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const activeSub = await prisma.subscription.findFirst({
        where: { user_id: user.id, status: "ACTIVE" },
        include: { plan: { include: { limit: true } } },
        orderBy: { created_at: "desc" },
      });

      const activeUrlsCount = await prisma.url.count({
        where: { user_id: user.id, is_active: true },
      });

      const planName = activeSub?.plan?.name || "Free Tier";
      const maxUrls = activeSub?.plan?.limit?.max_urls || 100;
      const remainingCredits = Math.max(0, maxUrls - activeUrlsCount);
      const usedPercent = Math.min(100, Math.round((activeUrlsCount / maxUrls) * 100));
      const maxClicksMonthly = activeSub?.plan?.limit?.max_clicks_per_month || 5000;
      const renewalDate = activeSub?.current_period_end
        ? new Date(activeSub.current_period_end).toLocaleDateString()
        : "N/A (Free Tier)";

      const latencyMs = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        type: "ACTION_CREDITS_TELEMETRY",
        latencyMs,
        message: `### 💳 Subscription & Short Link Credits Telemetry

* **Current Active Plan**: **${planName.toUpperCase()}**
* **Total Link Credit Quota**: **${maxUrls.toLocaleString()} Short Links**
* **Links Shortened**: **${activeUrlsCount.toLocaleString()} Links** (${usedPercent}% Used)
* **Short Link Credits Remaining**: 🎯 **${remainingCredits.toLocaleString()} Links Remaining**
* **Monthly Click Limit**: **${maxClicksMonthly.toLocaleString()} Clicks/Month**
* **Billing Cycle**: **${activeSub?.billing_cycle || "MONTHLY"}** (Renewal: ${renewalDate})

👉 *Need more short link credits? Upgrade anytime on the **[/pricing](/pricing)** page.*`,
        data: {
          planName,
          maxUrls,
          activeUrlsCount,
          remainingCredits,
          usedPercent,
          maxClicksMonthly,
          renewalDate,
        },
        suggestions: [
          "Show my url generation history",
          "Show my account profile and info",
          "Take me to pricing page",
        ],
      });
    }

    // 5d. Detect Intent: URL Generation History
    if (
      lowerMsg.includes("generation history") ||
      lowerMsg.includes("url history") ||
      lowerMsg.includes("link history") ||
      lowerMsg.includes("created links history")
    ) {
      if (!user) {
        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "PROMPT_AUTH",
          latencyMs,
          message: `🔒 **Account Required to View URL History**\n\nPlease [Sign In or Register](/auth) to view your short link creation history.`,
          suggestions: ["Sign in or Register", "Show subscription plans & limits"],
        });
      }

      const recentUrls = await prisma.url.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: "desc" },
        take: 6,
      });

      const totalUrls = await prisma.url.count({
        where: { user_id: user.id },
      });

      let historyListText = recentUrls
        .map(
          (u, idx) =>
            `${idx + 1}. **\`${u.short_code}\`** -> [${u.longUrl || u.long_url}](${u.longUrl || u.long_url}) | **${u.clicks_count || 0} clicks** (${new Date(u.created_at).toLocaleDateString()})`
        )
        .join("\n");

      if (!historyListText) {
        historyListText = "*No short links generated yet.*";
      }

      const latencyMs = Date.now() - startTime;
      return res.status(200).json({
        success: true,
        type: "ACTION_URL_HISTORY",
        latencyMs,
        message: `### 📜 Your URL Generation History (${totalUrls} Total Short Links)

${historyListText}

👉 *View detailed click telemetry on the **[/analytics](/analytics)** page.*`,
        data: {
          totalUrls,
          urls: recentUrls.map((u) => ({
            shortCode: u.short_code,
            longUrl: u.long_url,
            clicks: Number(u.clicks_count || 0),
            createdAt: u.created_at,
          })),
        },
        suggestions: [
          "Show my subscription plan and remaining credits",
          "Create a short link",
          "Run a link hygiene check",
        ],
      });
    }

    // 5e. Enhanced Intelligent Site Navigation & Feature Guidance Router
    const navKeywords = [
      "want to go", "want to visit", "go to", "go ", "take me", "navigate",
      "open ", "visit ", "head to", "how to reach", "where is", "how to go",
      "show me", "link for", "redirect", "login", "auth", "signin", "sign in",
      "register", "signup", "sign up", "domain", "domains", "cname", "analytics",
      "pricing", "plans", "settings", "profile", "admin", "dashboard", "this page",
      "same page", "how to use", "feature"
    ];

    const isNavOrFeatureQuery = navKeywords.some((kw) => lowerMsg.includes(kw));

    if (isNavOrFeatureQuery) {
      let targetPath = null;
      let targetName = null;
      let featureInstructions = "";

      // 1. Resolve Target Page
      if (lowerMsg.includes("auth") || lowerMsg.includes("login") || lowerMsg.includes("signin") || lowerMsg.includes("sign in") || lowerMsg.includes("register") || lowerMsg.includes("signup") || lowerMsg.includes("sign up")) {
        targetPath = "/auth";
        targetName = "Authentication & Login Page";
        featureInstructions = `* **Login Tab**: Enter your registered email & password to sign in.
* **Register Tab**: Click "Register" to create a new free PBUrls account.
* **Google & GitHub OAuth**: Use 1-click social sign-in buttons for fast authentication.
* **2FA Code**: If TOTP 2FA is active, enter your 6-digit Google Authenticator OTP code.`;
      } else if (lowerMsg.includes("domain") || lowerMsg.includes("cname") || lowerMsg.includes("dns")) {
        targetPath = "/domains";
        targetName = "Custom Domains Management";
        featureInstructions = `* **Add Custom Domain**: Enter your subdomain prefix (e.g. \`go.yourbrand.com\`).
* **Configure DNS CNAME**: In your DNS provider (Cloudflare, GoDaddy), add \`CNAME\` -> \`cname.pburls.com\`.
* **Instant SSL**: Click **Verify Domain** for immediate SSL certificate provisioning.`;
      } else if (lowerMsg.includes("analytic") || lowerMsg.includes("traffic") || lowerMsg.includes("stats") || lowerMsg.includes("clicks") || lowerMsg.includes("geoip")) {
        targetPath = "/analytics";
        targetName = "Analytics & Telemetry Dashboard";
        featureInstructions = `* **Time-Series Graphs**: Select 24h, 7d, 30d, or custom date ranges.
* **Visitor Breakdown**: Inspect GeoIP country maps, device OS, and referrer headers.
* **Unique Visitors**: Powered by Redis HyperLogLog for sub-1% error precision.
* **Export Data**: Click "Export CSV/JSON" to download full click logs.`;
      } else if (lowerMsg.includes("plan") || lowerMsg.includes("price") || lowerMsg.includes("pricing") || lowerMsg.includes("upgrade") || lowerMsg.includes("subscription")) {
        targetPath = "/pricing";
        targetName = "Subscription Plans & Pricing";
        featureInstructions = `* **Compare Tiers**: Compare Free (100 links), Pro (5,000 links), Enterprise (Unlimited links).
* **Billing Options**: Toggle between Monthly & Yearly billing (20% discount).
* **Razorpay Payment**: Click "Upgrade Plan" to pay securely via Razorpay.`;
      } else if (lowerMsg.includes("setting") || lowerMsg.includes("api key") || lowerMsg.includes("webhook") || lowerMsg.includes("security") || lowerMsg.includes("2fa") || lowerMsg.includes("team")) {
        targetPath = "/settings";
        targetName = "Account & Developer Settings";
        featureInstructions = `* **Profile Tab**: Update name, email, avatar, and switch Light/Dark mode.
* **Security Tab**: Enable TOTP 2FA authentication & manage active browser sessions.
* **API Keys Tab**: Generate scoped developer keys (\`pb_live_...\`).
* **Webhooks Tab**: Configure HMAC signed webhooks (\`click.recorded\`, \`link.expired\`).
* **Team Tab**: Invite workspace members and assign roles (\`OWNER\`, \`MEMBER\`).`;
      } else if (lowerMsg.includes("admin")) {
        targetPath = "/admin";
        targetName = "Admin Control Portal";
        featureInstructions = `* **System Overview**: Monitor global platform scale, total clicks, and server load.
* **User Management**: Inspect user directory, grant custom link quotas, or suspend accounts.
* **Billing Audit**: Inspect Razorpay transaction logs and process admin refunds.`;
      } else if (lowerMsg.includes("this page") || lowerMsg.includes("same page") || lowerMsg.includes("how to use") || lowerMsg.includes("feature")) {
        // Fallback to current page context
        if (pageContext.includes("/domains")) {
          targetPath = "/domains";
          targetName = "Custom Domains Management";
          featureInstructions = `* **Add Domain**: Enter your subdomain (e.g. \`go.yourbrand.com\`).
* **CNAME Record**: Point your DNS \`CNAME\` -> \`cname.pburls.com\`.
* **Verify**: Click **Verify Domain** to activate automatic SSL certificates.`;
        } else if (pageContext.includes("/analytics")) {
          targetPath = "/analytics";
          targetName = "Analytics Dashboard";
          featureInstructions = `* **Time-Series Charts**: View hourly and daily click graphs.
* **Geo & Devices**: Breakdown traffic by Country/City, Browsers, and OS.
* **Export**: Download full telemetry report as CSV/JSON.`;
        } else if (pageContext.includes("/pricing")) {
          targetPath = "/pricing";
          targetName = "Pricing Plans";
          featureInstructions = `* **Plan Limits**: Free (100 links), Pro (5,000 links), Enterprise (Unlimited links).
* **Razorpay Payment**: Secure billing and instant plan upgrades.`;
        } else if (pageContext.includes("/settings")) {
          targetPath = "/settings";
          targetName = "Settings Dashboard";
          featureInstructions = `* **Profile & Security**: Manage name, email, password, and TOTP 2FA.
* **Developer Tools**: Generate API keys and HMAC webhooks.`;
        } else if (pageContext.includes("/auth")) {
          targetPath = "/auth";
          targetName = "Authentication Portal";
          featureInstructions = `* **Login & Register**: Switch tabs to log in or create a new account.
* **OAuth**: Use 1-click Google or GitHub login.`;
        } else if (pageContext.includes("/admin")) {
          targetPath = "/admin";
          targetName = "Admin Portal";
          featureInstructions = `* **Moderation**: Suspend users and audit transactions.`;
        } else {
          targetPath = "/";
          targetName = "Home Dashboard";
          featureInstructions = `* **Shorten Link**: Paste long URL and click Shorten.
* **Custom Alias**: Choose custom short slug.
* **QR Codes**: Generate dynamic QR code with scan tracking.`;
        }
      }

      if (targetPath && targetName) {
        const isSamePage = pageContext === targetPath;

        const pathSteps = isSamePage
          ? [
              `📍 You are already on **${targetName}** (\`${pageContext}\`)`,
              `Follow the step-by-step feature instructions below to use this page`,
            ]
          : [
              `Start at current page: \`${pageContext}\``,
              `Look at the top application header navigation bar`,
              `Click on **${targetName}** (or route \`${targetPath}\`)`,
            ];

        const latencyMs = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          type: "ACTION_NAVIGATE",
          latencyMs,
          message: `### 🧭 ${isSamePage ? `Feature Guidance for ${targetName}` : `Navigation & Feature Guidance: Moving to ${targetName}`}

${
  isSamePage
    ? `📍 **You are currently on the ${targetName} (\`${pageContext}\`)**`
    : `* **Direct Page Link**: **[Open ${targetName}](${targetPath})**\n* **Navigation Path**: From \`${pageContext}\` ➔ Click **${targetName}** (\`${targetPath}\`) in top header bar`
}

#### 📋 How to Use Features on this Page (${targetName}):
${featureInstructions}

${isSamePage ? `👉 *You're already here! Follow the feature instructions above.*` : `👉 *Click the **🚀 Jump to ${targetName}** button below to go there immediately!*`}`,
          data: {
            targetPath,
            targetName,
            pathSteps,
            currentLocation: pageContext,
            isSamePage,
          },
          suggestions: [
            `Take me to login page`,
            `Take me to custom domains`,
            `Take me to analytics`,
            `Take me to settings`,
            `Show my subscription plan and remaining credits`,
          ],
        });
      }
    }

    // 7. Dynamic Knowledge RAG Engine (Smart Synthesized Response)
    const knowledgeResults = knowledgeSearchEngine.search(cleanMsg, null, 2);

    if (knowledgeResults.length > 0 && knowledgeResults[0].relevanceScore >= 15) {
      const primaryDoc = knowledgeResults[0];
      const userSnippet = user ? await dynamicKnowledgeRegistry.buildUserContextSnippet(user) : "";
      
      const synthesizedMessage = synthesizeResponse(primaryDoc, cleanMsg, userSnippet, tone);
      const latencyMs = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        type: "KNOWLEDGE_RAG",
        latencyMs,
        message: synthesizedMessage,
        data: {
          articleTitle: primaryDoc.title,
          topic: primaryDoc.topic,
          summary: primaryDoc.summary,
          pageContext,
        },
        suggestions: [
          "Show subscription plans & limits",
          "How does bot filtering work?",
          "How to configure custom domain CNAME?",
          "Show my top performing links",
        ],
      });
    }

    // 8. Conversational Fallback when query is non-technical or general
    const latencyMs = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      type: "CONVERSATIONAL",
      latencyMs,
      message: `🤖 **I'm here to help!**\n\nYou can ask me about shortening links, custom domain CNAME setup, subscription plans & refund policy, analytics breakdown, TOTP 2FA, or admin features.\n\nOr try choosing one of the suggested options below:`,
      suggestions: [
        "Create a short link",
        "Show subscription plans & limits",
        "How to configure custom domain CNAME?",
        "Show my top performing links",
      ],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to trigger manual dynamic knowledge base synchronization
 */
export const syncKnowledgeBaseController = async (req, res, next) => {
  try {
    await syncKnowledgeBase();
    res.status(200).json({
      success: true,
      message: "Knowledge base synchronized and re-indexed successfully.",
      syncedAt: dynamicKnowledgeRegistry.lastSyncedAt,
    });
  } catch (error) {
    next(error);
  }
};
