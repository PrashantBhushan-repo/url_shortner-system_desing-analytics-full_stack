import { z } from "zod";
import {
  getUrlOverview,
  getUrlTimeseries,
  getUrlGeo,
  getUrlDevices,
  getUrlReferrers,
  getUserTopLinks,
  exportClicksToCsv,
} from "../../services/analytics.service.js";
import { findByShortCodeForUser } from "../../repositories/url.repository.js";
import { formatMcpError } from "../server/errors.js";
import { validateToolPermission } from "../server/permissions.js";
import { mcpLogger } from "../observability/mcpLogger.js";

/**
 * Register Enterprise Analytics tools on the McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../server/context.js').UserContext} userContext
 */
export const registerAnalyticsTools = (server, userContext) => {
  // 1. Comprehensive Link Analytics (READ)
  server.tool(
    "get_link_analytics",
    "Fetches detailed analytics telemetry for a specific short link, including total/unique/bot clicks, growth, top countries, top cities, devices, browsers, platforms, and referrers.",
    {
      shortCode: z.string().min(1).describe("The short code of the link to inspect (e.g. 'summer-sale')"),
      range: z.enum(["24h", "7d", "30d"]).optional().default("7d").describe("Time range window ('24h', '7d', or '30d')"),
      includeTimeseries: z.boolean().optional().default(false).describe("Set to true to also receive bucketed hourly/daily click time-series points"),
    },
    async ({ shortCode, range = "7d", includeTimeseries = false }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "get_link_analytics";

      try {
        const url = await findByShortCodeForUser(shortCode.trim(), userContext.userId);
        if (!url) {
          throw new Error(`Link '${shortCode}' not found in your workspace.`);
        }

        const urlId = url.id;

        // Fetch overview, geo, devices, and referrers concurrently
        const [overview, geo, devices, referrers, timeseries] = await Promise.all([
          getUrlOverview(urlId, range),
          getUrlGeo(urlId, range),
          getUrlDevices(urlId, range),
          getUrlReferrers(urlId, range),
          includeTimeseries ? getUrlTimeseries(urlId, range) : Promise.resolve(null),
        ]);

        const analyticsResult = {
          shortCode,
          timeRange: range,
          summary: overview,
          demographics: {
            topCountries: geo.countries || [],
            topCities: geo.cities || [],
          },
          technology: {
            devices: devices.devices || [],
            browsers: devices.browsers || [],
            operatingSystems: devices.operatingSystems || [],
          },
          referrers: referrers.referrers || [],
          ...(includeTimeseries && { timeseries }),
        };

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, range },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, analytics: analyticsResult }, null, 2),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { shortCode, range });
      }
    }
  );

  // 2. Get Top Performing Links (READ)
  server.tool(
    "get_top_performing_links",
    "Returns your workspace's top performing short links ranked by total click traffic within a specified time range.",
    {
      range: z.enum(["24h", "7d", "30d"]).optional().default("7d").describe("Time window for ranking ('24h', '7d', '30d')"),
      limit: z.number().min(1).max(20).optional().default(5).describe("Number of top links to return (default: 5)"),
    },
    async ({ range = "7d", limit = 5 }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "get_top_performing_links";

      try {
        const topLinks = await getUserTopLinks(userContext.userId, range, limit);
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { range, returnedCount: topLinks.length },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  timeRange: range,
                  totalReturned: topLinks.length,
                  topLinks,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { range });
      }
    }
  );

  // 3. Export Link Click Data as CSV (READ)
  server.tool(
    "export_link_csv_data",
    "Exports raw individual click event logs for a short link in CSV format for offline reporting and deep data analysis.",
    {
      shortCode: z.string().describe("The short code to export logs for"),
      range: z.enum(["24h", "7d", "30d"]).optional().default("30d").describe("Time window for export"),
    },
    async ({ shortCode, range = "30d" }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "export_link_csv_data";

      try {
        const perm = await validateToolPermission(userContext, toolName);
        if (!perm.allowed) throw new Error(perm.reason);

        const url = await findByShortCodeForUser(shortCode.trim(), userContext.userId);
        if (!url) {
          throw new Error(`Link '${shortCode}' not found in your workspace.`);
        }

        const csvContent = await exportClicksToCsv(url.id, range);
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, range },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  shortCode,
                  range,
                  format: "csv",
                  csvData: csvContent,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { shortCode, range });
      }
    }
  );
};
