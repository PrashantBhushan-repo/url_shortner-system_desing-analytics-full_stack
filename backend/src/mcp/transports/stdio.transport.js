import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../createMcpServer.js";
import { authenticateApiKey } from "../auth/mcpAuth.js";

/**
 * Starts the MCP server communicating over standard I/O (stdin/stdout) for Claude Desktop, Cursor, etc.
 * @param {string} rawApiKey - The API key provided via environment or CLI arg
 */
export const startStdioServer = async (rawApiKey) => {
  if (!rawApiKey) {
    console.error(
      "[PBUrls MCP] Error: No API Key provided. Set PBURLS_API_KEY environment variable or pass --api-key <key>"
    );
    process.exit(1);
  }

  try {
    const { user, label } = await authenticateApiKey(rawApiKey);
    console.error(`[PBUrls MCP] Authenticated successfully as ${user.email} (${label || "Default Key"})`);

    const server = await createMcpServer(user, "stdio");
    const transport = new StdioServerTransport();

    await server.connect(transport);
    console.error("[PBUrls MCP] Stdio transport connected and ready for JSON-RPC messages.");
  } catch (error) {
    console.error(`[PBUrls MCP] Initialization error: ${error.message}`);
    process.exit(1);
  }
};
