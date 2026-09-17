import { z } from "zod";
import prisma from "../../config/prismaClient.js";
import {
  getUrlOverview,
  getUrlGeo,
  getUrlDevices,
  getUrlReferrers,
} from "../../services/analytics.service.js";
import { formatMcpError } from "../server/errors.js";
import { mcpLogger } from "../observability/mcpLogger.js";

/**
 * Registers High-Level Workflow Capabilities (Composite Actions & AI Intelligence)
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {import("../server/context.js").UserContext} userContext
 */
export const registerWorkflowTools = (server, userContext) => {
  // 1. Tool: audit_campaign_performance
  server.tool(
    "audit_campaign_performance",
    "High-level workflow: Performs an in-depth audit on a marketing link/campaign, assessing human vs bot traffic, geographic conversion, device split, and providing optimization recommendations.",
    {
      shortCode: z.string().describe("The short code of the campaign link to audit"),
      timeframeDays: z.number().min(1).max(90).default(7).optional().describe("Number of days to analyze (default: 7 days)"),
    },
    async ({ shortCode, timeframeDays = 7 }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;

      try {
        const urlRecord = await prisma.url.findFirst({
          where: {
            short_code: shortCode.trim(),
            user_id: userContext.userId,
          },
        });

        if (!urlRecord) {
          throw new Error(`Link with short code '${shortCode}' was not found in your workspace.`);
        }

        const range = `${timeframeDays}d`;
        const [overview, geo, devices, referrers] = await Promise.all([
          getUrlOverview(urlRecord.id, range),
          getUrlGeo(urlRecord.id, range),
          getUrlDevices(urlRecord.id, range),
          getUrlReferrers(urlRecord.id, range),
        ]);

        const totalClicks = overview?.totalClicks || 0;
        const uniqueClicks = overview?.uniqueClicks || 0;
        const botClicks = overview?.botClicks || 0;
        const humanClicks = Math.max(0, totalClicks - botClicks);

        const botRatioPct = totalClicks > 0 ? Math.round((botClicks / totalClicks) * 100) : 0;
        const uniqueRatioPct = totalClicks > 0 ? Math.round((uniqueClicks / totalClicks) * 100) : 0;

        // Extract top dimensions
        const topCountries = (geo?.countries || []).slice(0, 3);
        const topDevices = (devices?.devices || []).slice(0, 3);
        const topReferrers = (referrers?.referrers || []).slice(0, 3);

        // Generate intelligent optimization recommendations
        const recommendations = [];

        if (totalClicks === 0) {
          recommendations.push("This link has received 0 clicks so far. Consider generating a QR code or distributing via multi-channel social media.");
        } else {
          if (botRatioPct > 20) {
            recommendations.push(`High bot activity detected (${botRatioPct}%). If promoting on Twitter or Slack, note that link preview scrapers inflate clicks.`);
          }
          if (uniqueRatioPct < 40 && totalClicks > 10) {
            recommendations.push(`High repeat click rate (Unique ratio is ${uniqueRatioPct}%). Your existing audience is returning frequently.`);
          }
          const mobileDevice = topDevices.find((d) => d.name?.toLowerCase().includes("mobile"));
          if (mobileDevice && mobileDevice.count / totalClicks > 0.6) {
            recommendations.push("Over 60% of clicks originate from Mobile devices. Ensure destination page has mobile-first responsive layout.");
          }
          if (topReferrers.length === 0 || topReferrers.every((r) => r.name === "Direct")) {
            recommendations.push("Most clicks are marked as 'Direct'. Use UTM parameters (e.g. utm_source=newsletter) to pinpoint exact traffic sources.");
          }
        }

        const auditReport = {
          success: true,
          shortCode: urlRecord.short_code,
          longUrl: urlRecord.long_url,
          timeframe: `Last ${timeframeDays} days`,
          healthStatus: urlRecord.is_alive ? "HEALTHY" : "DOWN / FAILING",
          trafficSummary: {
            totalClicks,
            humanClicks,
            botClicks,
            uniqueVisitors: uniqueClicks,
            botPercentage: `${botRatioPct}%`,
            repeatEngagementRatio: `${uniqueRatioPct}%`,
          },
          demographics: {
            topCountries,
            topDevices,
            topReferrers,
          },
          actionableRecommendations: recommendations,
        };

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "audit_campaign_performance",
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, totalClicks },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(auditReport, null, 2),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "audit_campaign_performance",
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError("audit_campaign_performance", error, { shortCode });
      }
    }
  );

  // 2. Tool: audit_link_hygiene
  server.tool(
    "audit_link_hygiene",
    "High-level workflow: Scans all workspace short links to detect broken destination URLs, dead health checks, upcoming expirations, and inactive links.",
    {
      limit: z.number().min(1).max(50).default(20).optional().describe("Maximum number of links to scan (default 20)"),
    },
    async ({ limit = 20 }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;

      try {
        const links = await prisma.url.findMany({
          where: { user_id: userContext.userId },
          orderBy: { created_at: "desc" },
          take: limit,
        });

        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const failingLinks = [];
        const expiringSoonLinks = [];
        const inactiveLinks = [];
        let healthyCount = 0;

        for (const link of links) {
          if (!link.is_active) {
            inactiveLinks.push({ shortCode: link.short_code, longUrl: link.long_url });
          } else if (!link.is_alive || link.health_check_failures > 0) {
            failingLinks.push({
              shortCode: link.short_code,
              longUrl: link.long_url,
              failures: link.health_check_failures,
              lastChecked: link.last_checked_at,
            });
          } else {
            healthyCount++;
          }

          if (link.expires_at && new Date(link.expires_at) <= sevenDaysFromNow && new Date(link.expires_at) > now) {
            expiringSoonLinks.push({
              shortCode: link.short_code,
              expiresAt: link.expires_at,
            });
          }
        }

        const hygieneReport = {
          success: true,
          totalScanned: links.length,
          overview: {
            healthyLinks: healthyCount,
            failingLinksCount: failingLinks.length,
            expiringSoonCount: expiringSoonLinks.length,
            inactiveCount: inactiveLinks.length,
          },
          issuesDetected: {
            failingOrBroken: failingLinks,
            expiringWithin7Days: expiringSoonLinks,
            deactivated: inactiveLinks,
          },
          suggestedActions: [
            ...(failingLinks.length > 0
              ? ["Update broken links using 'update_link_status' with a valid working destination URL."]
              : []),
            ...(expiringSoonLinks.length > 0
              ? ["Extend expiration dates on critical links before they stop redirecting."]
              : []),
            ...(healthyCount === links.length
              ? ["All scanned links are operational and healthy!"]
              : []),
          ],
        };

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "audit_link_hygiene",
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { totalScanned: links.length, healthyCount },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(hygieneReport, null, 2),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "audit_link_hygiene",
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError("audit_link_hygiene", error);
      }
    }
  );
};
