import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "../createMcpServer.js";
import { authenticateApiKey } from "../auth/mcpAuth.js";

// In-memory store for active SSE client sessions
const activeSessions = new Map();

/**
 * Clean up stale sessions (older than 24 hours)
 */
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.createdAt.getTime() > 24 * 60 * 60 * 1000) {
      try {
        session.transport.close();
      } catch (_) {}
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

/**
 * Handle incoming SSE connection request (GET /api/v1/mcp/sse)
 */
export const handleSseConnection = async (req, res, next) => {
  try {
    const rawKey =
      req.query.apiKey ||
      req.headers["x-api-key"] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API Key. Provide ?apiKey=snap_... query param or x-api-key header.",
      });
    }

    const { user } = await authenticateApiKey(rawKey);

    // Create a new MCP Gateway instance bound to this user context
    const mcpServer = await createMcpServer(user, "sse");

    // Instantiate SSE transport pointing incoming POSTs to /api/v1/mcp/messages
    const transport = new SSEServerTransport("/api/v1/mcp/messages", res);

    const sessionId = transport.sessionId;
    activeSessions.set(sessionId, {
      transport,
      mcpServer,
      user,
      createdAt: new Date(),
    });

    transport.onclose = () => {
      activeSessions.delete(sessionId);
    };

    req.on("close", () => {
      activeSessions.delete(sessionId);
    });

    // Connect transport to the server (starts the stream & sends endpoint event)
    await mcpServer.connect(transport);
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
      });
    }
  }
};

/**
 * Handle incoming JSON-RPC POST messages from client (POST /api/v1/mcp/messages)
 */
export const handlePostMessage = async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Missing sessionId parameter in query string (?sessionId=...)",
      });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Active MCP session '${sessionId}' not found or has expired. Please reconnect.`,
      });
    }

    // Pass parsed body directly to prevent stream re-reading issues
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
};

/**
 * Discover MCP server capabilities & specs (GET /api/v1/mcp/info)
 */
export const getMcpServerInfo = (req, res) => {
  res.status(200).json({
    name: "PBUrls-AI-Gateway",
    version: "2.0.0",
    protocol: "mcp-2024-11-05",
    description: "Enterprise Model Context Protocol (MCP) AI Gateway & Assistant for PBUrls URL Shortener, Telemetry & Knowledge Engine.",
    endpoints: {
      sse: "/api/v1/mcp/sse",
      messages: "/api/v1/mcp/messages",
      info: "/api/v1/mcp/info",
    },
    tools: [
      { name: "search_knowledge_base", description: "Search official documentation, system architecture, UTM tracking, bot filtering, and FAQs", category: "Knowledge (RAG)" },
      { name: "create_short_link", description: "Shorten a long destination URL with custom alias, expiry, and password", category: "URL Actions" },
      { name: "get_url_details", description: "Fetch URL metadata, target destination, and health status", category: "URL Actions" },
      { name: "get_link_analytics", description: "Detailed click telemetry: total/unique/bot clicks, geo, devices, referrers", category: "Analytics" },
      { name: "list_links", description: "List short links created by the user with search & pagination", category: "URL Actions" },
      { name: "generate_qr_code", description: "Generate dynamic QR code for short link with scan tracking", category: "QR Codes" },
      { name: "update_link_status", description: "Update target URL, custom alias, or expiration", category: "URL Actions" },
      { name: "deactivate_link", description: "Deactivate (soft-delete) a short link", category: "URL Actions" },
      { name: "check_link_health", description: "Check target destination uptime and alive status", category: "URL Actions" },
      { name: "get_top_performing_links", description: "Rank top links in account by click volume", category: "Analytics" },
      { name: "export_link_csv_data", description: "Stream raw individual click telemetry in CSV format", category: "Analytics" },
      { name: "audit_campaign_performance", description: "High-level workflow: Multi-metric traffic analysis, bot detection, and AI recommendations", category: "Workflows" },
      { name: "audit_link_hygiene", description: "High-level workflow: Scan workspace for failing URLs and upcoming expirations", category: "Workflows" },
    ],
    resources: [
      { uriTemplate: "pburls://knowledge/docs/{docId}", description: "Direct access to PBUrls architectural documentation and guides" },
      { uriTemplate: "pburls://links/{shortCode}", description: "Link metadata and live configuration" },
      { uriTemplate: "pburls://analytics/{shortCode}", description: "Aggregated 7-day click overview telemetry" },
    ],
    prompts: [
      { name: "campaign-performance-audit", description: "Audit campaign traffic, geographic breakdown, and bot ratio" },
      { name: "link-hygiene-report", description: "Scan account links for dead targets and expiring codes" },
    ],
  });
};
