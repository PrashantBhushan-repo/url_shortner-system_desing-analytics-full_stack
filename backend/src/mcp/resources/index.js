import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUrlStats } from "../../services/url.service.js";
import { getUrlOverview } from "../../services/analytics.service.js";
import { findByShortCodeForUser } from "../../repositories/url.repository.js";

/**
 * Register MCP Resources for PBUrls
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../server/context.js').UserContext} userContext
 */
export const registerResources = (server, userContext) => {
  // 1. Link Metadata Resource
  server.resource(
    "link_metadata",
    new ResourceTemplate("pburls://links/{shortCode}", { list: undefined }),
    async (uri, { shortCode }) => {
      try {
        const stats = await getUrlStats(shortCode, userContext.userId);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error loading link metadata: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // 2. Link Analytics Resource
  server.resource(
    "link_analytics_summary",
    new ResourceTemplate("pburls://analytics/{shortCode}", { list: undefined }),
    async (uri, { shortCode }) => {
      try {
        const urlRecord = await findByShortCodeForUser(shortCode, userContext.userId, userContext.role);
        if (!urlRecord) {
          throw new Error("Link not found");
        }
        const overview = await getUrlOverview(urlRecord.id.toString(), "7d");
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  shortCode,
                  longUrl: urlRecord.long_url,
                  window: "7d",
                  overview,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error loading link analytics: ${err.message}`,
            },
          ],
        };
      }
    }
  );
};
