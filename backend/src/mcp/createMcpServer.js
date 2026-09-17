import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UserContext, buildUserContext } from "./server/context.js";
import { registerKnowledgeLayer } from "./knowledge/index.js";
import { registerUrlTools } from "./tools/url.tools.js";
import { registerAnalyticsTools } from "./tools/analytics.tools.js";
import { registerQrTools } from "./tools/qr.tools.js";
import { registerWorkflowTools } from "./tools/workflows.tools.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { traceMcpTool, traceMcpResource, traceMcpPrompt } from "../telemetry/mcpTelemetry.js";

/**
 * Creates and configures the Enterprise PBUrls AI & MCP Gateway
 * @param {UserContext|Object} userOrContext
 * @param {"stdio"|"sse"} [clientType="stdio"]
 * @returns {Promise<McpServer>}
 */
export const createMcpServer = async (userOrContext, clientType = "stdio") => {
  // Ensure we have a valid immutable UserContext
  const userContext =
    userOrContext instanceof UserContext
      ? userOrContext
      : await buildUserContext(userOrContext, clientType);

  const server = new McpServer({
    name: "PBUrls-AI-Gateway",
    version: "2.0.0",
    description: "Enterprise SaaS URL Shortener, Telemetry & AI Gateway",
  });

  // Instrument server.tool with OpenTelemetry
  const originalTool = server.tool.bind(server);
  server.tool = (name, ...args) => {
    const handlerIdx = args.length - 1;
    const originalHandler = args[handlerIdx];
    if (typeof originalHandler === "function") {
      args[handlerIdx] = async (params, extra) => {
        return traceMcpTool(name, userContext, async () => {
          return originalHandler(params, extra);
        });
      };
    }
    return originalTool(name, ...args);
  };

  // Instrument server.resource with OpenTelemetry
  const originalResource = server.resource.bind(server);
  server.resource = (name, uri, ...args) => {
    const handlerIdx = args.length - 1;
    const originalHandler = args[handlerIdx];
    if (typeof originalHandler === "function") {
      args[handlerIdx] = async (uriMatch, extra) => {
        return traceMcpResource(typeof uri === "string" ? uri : name, userContext, async () => {
          return originalHandler(uriMatch, extra);
        });
      };
    }
    return originalResource(name, uri, ...args);
  };

  // Instrument server.prompt with OpenTelemetry
  const originalPrompt = server.prompt.bind(server);
  server.prompt = (name, ...args) => {
    const handlerIdx = args.length - 1;
    const originalHandler = args[handlerIdx];
    if (typeof originalHandler === "function") {
      args[handlerIdx] = async (params, extra) => {
        return traceMcpPrompt(name, async () => {
          return originalHandler(params, extra);
        });
      };
    }
    return originalPrompt(name, ...args);
  };

  // 1. Register Knowledge Layer (RAG & Documentation)
  registerKnowledgeLayer(server, userContext);

  // 2. Register Domain Action Tools
  registerUrlTools(server, userContext);
  registerAnalyticsTools(server, userContext);
  registerQrTools(server, userContext);

  // 3. Register High-Level Workflow Capabilities
  registerWorkflowTools(server, userContext);

  // 4. Register Resources & Prompts
  registerResources(server, userContext);
  registerPrompts(server);

  return server;
};
