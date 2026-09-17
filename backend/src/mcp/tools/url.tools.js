import { z } from "zod";
import {
  shortenUrl,
  getUrlStats,
  listUserUrls,
  updateShortUrl,
  deactivateShortUrl,
  getUrlHealthStatus,
} from "../../services/url.service.js";
import { findByShortCodeForUser } from "../../repositories/url.repository.js";
import { formatMcpError } from "../server/errors.js";
import { validateToolPermission } from "../server/permissions.js";
import { checkIdempotency, saveIdempotency } from "../server/idempotency.js";
import { mcpLogger } from "../observability/mcpLogger.js";

/**
 * Register Enterprise URL tools on the McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../server/context.js').UserContext} userContext
 */
export const registerUrlTools = (server, userContext) => {
  // 1. Create Short Link (WRITE)
  server.tool(
    "create_short_link",
    "Shortens a long destination URL into a trackable PBUrls short link with optional custom alias (up to 64 chars), expiration date, and password protection.",
    {
      longUrl: z.string().url().describe("The destination URL to shorten (e.g. 'https://example.com/blog/my-post')"),
      customSlug: z.string().min(3).max(64).optional().describe("Optional custom alias/slug (e.g. 'summer-sale-2026')"),
      expiresAt: z.string().optional().describe("Optional expiration ISO 8601 timestamp (e.g. '2026-12-31T23:59:59.000Z')"),
      password: z.string().optional().describe("Optional password required for visitors to access the link"),
      customDomainId: z.string().optional().describe("Optional custom domain ID registered in workspace"),
    },
    async ({ longUrl, customSlug, expiresAt, password, customDomainId }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "create_short_link";

      try {
        // 1. Validate permissions
        const perm = await validateToolPermission(userContext, toolName);
        if (!perm.allowed) {
          throw new Error(perm.reason);
        }

        // 2. Idempotency Check (prevents duplicate creations on LLM retry)
        const payload = { longUrl, customSlug, expiresAt, customDomainId };
        const cachedResult = await checkIdempotency(userContext.userId, toolName, payload);
        if (cachedResult) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    idempotent: true,
                    message: "Returned existing link from idempotent request cache.",
                    link: cachedResult,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 3. Execute business logic
        const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
        const result = await shortenUrl(
          longUrl,
          customSlug || null,
          parsedExpiresAt,
          { id: userContext.userId, email: userContext.email, role: userContext.role },
          password || null,
          customDomainId || null
        );

        // 4. Cache idempotency result for 60 seconds
        await saveIdempotency(userContext.userId, toolName, payload, result, 60);

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: perm.riskLevel,
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode: result.shortCode, longUrl },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Short link created successfully",
                  link: result,
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
          riskLevel: "WRITE",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { longUrl, customSlug });
      }
    }
  );

  // 2. Get URL Details (READ)
  server.tool(
    "get_url_details",
    "Retrieves full metadata, health state, click counter, and configuration for a short link.",
    {
      shortCode: z.string().describe("The short code identifier (e.g. 'summer-sale-2026')"),
    },
    async ({ shortCode }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "get_url_details";

      try {
        const stats = await getUrlStats(shortCode.trim(), userContext.userId);
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, link: stats }, null, 2),
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

        return formatMcpError(toolName, error, { shortCode });
      }
    }
  );

  // 3. List Links (READ)
  server.tool(
    "list_links",
    "Lists short links created by your account with pagination, search query, and sorting.",
    {
      page: z.number().min(1).default(1).optional().describe("Page number (default: 1)"),
      limit: z.number().min(1).max(50).default(10).optional().describe("Results per page (default: 10, max: 50)"),
      search: z.string().optional().describe("Optional search keyword matching shortCode or longUrl"),
    },
    async ({ page = 1, limit = 10, search = "" }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "list_links";

      try {
        const result = await listUserUrls(userContext.userId, { page, limit, search: search.trim() });
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { count: result.urls?.length || 0, page },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  totalCount: result.total,
                  returnedCount: result.urls?.length || 0,
                  page: result.page,
                  totalPages: result.totalPages,
                  links: result.urls,
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

        return formatMcpError(toolName, error);
      }
    }
  );

  // 4. Update Link Status (WRITE)
  server.tool(
    "update_link_status",
    "Updates an existing short link's target destination URL, custom slug, expiration date, or password.",
    {
      shortCode: z.string().describe("The current short code to update"),
      longUrl: z.string().url().optional().describe("New destination URL"),
      customSlug: z.string().min(3).max(64).optional().describe("New custom slug"),
      expiresAt: z.string().nullable().optional().describe("New expiration ISO string or null to remove expiry"),
      password: z.string().nullable().optional().describe("New password or null to remove password protection"),
    },
    async ({ shortCode, longUrl, customSlug, expiresAt, password }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "update_link_status";

      try {
        const perm = await validateToolPermission(userContext, toolName);
        if (!perm.allowed) throw new Error(perm.reason);

        const updateData = {};
        if (longUrl !== undefined) updateData.longUrl = longUrl;
        if (customSlug !== undefined) updateData.customAlias = customSlug;
        if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
        if (password !== undefined) updateData.password = password;

        const updated = await updateShortUrl(
          shortCode.trim(),
          updateData,
          { id: userContext.userId, role: userContext.role }
        );

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "WRITE",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, updatedSlug: customSlug },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Short link updated successfully",
                  link: updated,
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
          riskLevel: "WRITE",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { shortCode });
      }
    }
  );

  // 5. Deactivate Link (DESTRUCTIVE)
  server.tool(
    "deactivate_link",
    "Deactivates or soft-deletes an active short link, preventing visitors from redirecting.",
    {
      shortCode: z.string().describe("The short code to deactivate"),
      reason: z.string().optional().describe("Optional reason for deactivation"),
    },
    async ({ shortCode, reason }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "deactivate_link";

      try {
        const perm = await validateToolPermission(userContext, toolName);
        if (!perm.allowed) throw new Error(perm.reason);

        const url = await findByShortCodeForUser(shortCode.trim(), userContext.userId);
        if (!url) {
          throw new Error(`Link '${shortCode}' not found in your workspace.`);
        }

        await deactivateShortUrl(url.id, userContext.userId);

        // Record high-risk action in audit log
        await mcpLogger.logAudit(userContext.userId, "link.deactivate", "Url", url.id, {
          shortCode,
          reason,
        });

        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "DESTRUCTIVE",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, urlId: url.id },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Short link '${shortCode}' deactivated successfully.`,
                  shortCode,
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
          riskLevel: "DESTRUCTIVE",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError(toolName, error, { shortCode });
      }
    }
  );

  // 6. Check Link Health (READ)
  server.tool(
    "check_link_health",
    "Inspects target URL uptime, HTTP status code response, and background health check status.",
    {
      shortCode: z.string().describe("The short code to inspect"),
    },
    async ({ shortCode }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "check_link_health";

      try {
        const health = await getUrlHealthStatus(shortCode.trim(), userContext.userId);
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode, isAlive: health.isAlive },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, health }, null, 2),
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

        return formatMcpError(toolName, error, { shortCode });
      }
    }
  );
};
