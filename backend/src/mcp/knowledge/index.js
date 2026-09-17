import { z } from "zod";
import { knowledgeSearchEngine } from "./searchEngine.js";
import { dynamicKnowledgeRegistry } from "./dynamicRegistry.js";
import { formatMcpError } from "../server/errors.js";
import { mcpLogger } from "../observability/mcpLogger.js";

/**
 * Triggers a manual background sync of the Knowledge Layer
 */
export const syncKnowledgeBase = async () => {
  await dynamicKnowledgeRegistry.sync();
};

/**
 * Registers Knowledge Layer (RAG) Tools and Resources on MCP Server
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {import("../server/context.js").UserContext} userContext
 */
export const registerKnowledgeLayer = (server, userContext) => {
  // 1. Tool: search_knowledge_base
  server.tool(
    "search_knowledge_base",
    "Search official PBUrls documentation, live system telemetry, system architecture, DSA algorithms, CNAME domain setup, bot filtering, pricing plans, and FAQs to answer product or technical questions.",
    {
      query: z.string().min(2, "Query must be at least 2 characters").describe("The question or topic to search for (e.g. 'custom domain setup', 'base62 algorithm', 'bot detection', 'pricing quotas')"),
      topic: z.enum(["general", "analytics", "domains", "campaigns", "pricing", "mcp", "links", "dsa", "redirection", "bot"]).optional().describe("Optional topic filter"),
      limit: z.number().min(1).max(5).default(3).optional().describe("Maximum number of relevant documentation sections to return (default 3)"),
    },
    async ({ query, topic, limit = 3 }) => {
      const startTime = performance.now();
      const requestId = userContext.requestId;

      try {
        const results = knowledgeSearchEngine.search(query, topic, limit);
        const latencyMs = performance.now() - startTime;

        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "search_knowledge_base",
          riskLevel: "READ",
          latencyMs,
          status: "SUCCESS",
          metadata: { query, topic, resultsCount: results.length },
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  query,
                  found: false,
                  message: `No specific documentation articles matched '${query}'. You can explore core features using 'list_links', 'get_link_analytics', or asking about general URL shortening.`,
                  availableTopics: ["general", "analytics", "domains", "campaigns", "pricing", "mcp", "links", "dsa", "redirection", "bot"],
                }, null, 2),
              },
            ],
          };
        }

        const formattedArticles = results.map((doc) => ({
          title: doc.title,
          topic: doc.topic,
          summary: doc.summary,
          content: doc.content.trim(),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                query,
                found: true,
                count: formattedArticles.length,
                articles: formattedArticles,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        const latencyMs = performance.now() - startTime;
        mcpLogger.logInvocation({
          requestId,
          userId: userContext.userId,
          clientType: userContext.clientType,
          toolName: "search_knowledge_base",
          riskLevel: "READ",
          latencyMs,
          status: "ERROR",
          error: error.message,
        });

        return formatMcpError("search_knowledge_base", error, { query });
      }
    }
  );

  // 2. Resource: Direct documentation reader
  server.resource(
    "knowledge-doc",
    "pburls://knowledge/docs/{docId}",
    async (uri, { docId }) => {
      const allDocs = dynamicKnowledgeRegistry.getAllDocs();
      const doc = allDocs.find((d) => d.id === docId);
      if (!doc) {
        throw new Error(`Documentation article with ID '${docId}' not found.`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: `# ${doc.title}\n\n**Topic:** ${doc.topic}\n**Summary:** ${doc.summary}\n\n${doc.content}`,
            mimeType: "text/markdown",
          },
        ],
      };
    }
  );
};
