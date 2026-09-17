import { z } from "zod";
import { generateUrlQrCode } from "../../services/url.service.js";
import { findByShortCodeForUser } from "../../repositories/url.repository.js";
import { config } from "../../config/config.js";
import { formatMcpError } from "../server/errors.js";
import { validateToolPermission } from "../server/permissions.js";
import { mcpLogger } from "../observability/mcpLogger.js";

/**
 * Register Enterprise QR Code tools on the McpServer instance
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../server/context.js').UserContext} userContext
 */
export const registerQrTools = (server, userContext) => {
  server.tool(
    "generate_qr_code",
    "Generates a scannable QR code PNG (returned as a base64 Data URL) for a short link with built-in scan tracking.",
    {
      shortCode: z.string().min(1).describe("The short code identifier of the link"),
    },
    async ({ shortCode }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;
      const toolName = "generate_qr_code";

      try {
        const perm = await validateToolPermission(userContext, toolName);
        if (!perm.allowed) throw new Error(perm.reason);

        const urlRecord = await findByShortCodeForUser(shortCode.trim(), userContext.userId, userContext.role);
        if (!urlRecord) {
          throw new Error(`Link '${shortCode}' was not found in your workspace.`);
        }

        const qrDataUrl = await generateUrlQrCode(shortCode.trim(), {
          id: userContext.userId,
          email: userContext.email,
          role: userContext.role,
        });

        const targetUrl = `${config.baseUrl}/r/${shortCode}?qr=true`;
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName,
          riskLevel: "WRITE",
          latencyMs,
          status: "SUCCESS",
          metadata: { shortCode },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  shortCode,
                  targetUrl,
                  dataUrl: qrDataUrl,
                  instruction: "You can embed or display this image using the dataUrl provided.",
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
};
