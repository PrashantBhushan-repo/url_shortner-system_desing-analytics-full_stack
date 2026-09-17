import prisma from "../../config/prismaClient.js";

/**
 * Enterprise Structured Logger and Metrics Tracer for MCP Gateway
 */
class McpLogger {
  /**
   * Log an MCP tool or knowledge invocation with performance metrics
   * @param {Object} entry
   * @param {string} entry.requestId
   * @param {string} entry.userId
   * @param {string} entry.clientType
   * @param {string} entry.toolName
   * @param {"READ"|"WRITE"|"DESTRUCTIVE"} entry.riskLevel
   * @param {number} entry.latencyMs
   * @param {"SUCCESS"|"ERROR"|"RATE_LIMITED"} entry.status
   * @param {string} [entry.error]
   * @param {Object} [entry.metadata]
   */
  logInvocation({
    requestId,
    userId,
    clientType = "stdio",
    toolName,
    riskLevel = "READ",
    latencyMs,
    status,
    error,
    metadata = {},
  }) {
    const logPayload = {
      timestamp: new Date().toISOString(),
      type: "MCP_INVOCATION",
      requestId,
      userId,
      clientType,
      toolName,
      riskLevel,
      latencyMs: Math.round(latencyMs * 100) / 100,
      status,
      ...(error && { error }),
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };

    // Stdio transports output logs to stderr to maintain JSON-RPC purity on stdout
    console.error(`[MCP Trace] ${JSON.stringify(logPayload)}`);
  }

  /**
   * Record high-risk or administrative operations in the database audit log
   * @param {string} userId
   * @param {string} action
   * @param {string} targetType
   * @param {string} targetId
   * @param {Object} [metadata]
   */
  async logAudit(userId, action, targetType, targetId, metadata = {}) {
    try {
      await prisma.adminAuditLog.create({
        data: {
          admin_id: userId,
          action: `mcp.${action}`,
          target_type: targetType,
          target_id: String(targetId),
          metadata,
          ip: "127.0.0.1 (MCP Gateway)",
        },
      });
    } catch (err) {
      console.error("[MCP Audit] Failed to record audit entry:", err.message);
    }
  }
}

export const mcpLogger = new McpLogger();
