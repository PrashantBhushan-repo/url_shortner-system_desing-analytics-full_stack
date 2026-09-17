import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const getTracer = () => trace.getTracer("pburls-mcp");

/**
 * Wraps an MCP Tool call in an OpenTelemetry span (`mcp.tool_call`).
 *
 * @param {string} toolName - Name of the MCP tool (e.g. "shorten_url", "get_analytics")
 * @param {Object} userContext - Context object containing user information
 * @param {Function} fn - Async handler function for the tool
 * @returns {Promise<any>}
 */
export const traceMcpTool = async (toolName, userContext, fn) => {
  return getTracer().startActiveSpan(
    `mcp.tool_call ${toolName}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        "mcp.system": "modelcontextprotocol",
        "mcp.tool.name": String(toolName),
        "mcp.client.type": userContext?.clientType || "stdio",
        "user.id": String(userContext?.user?.id || "anonymous"),
        "user.role": String(userContext?.user?.role || "GUEST"),
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message || `MCP tool ${toolName} failed`,
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
};

/**
 * Wraps an MCP Resource read in an OpenTelemetry span (`mcp.resource_read`).
 *
 * @param {string} resourceUri - URI of the requested MCP resource
 * @param {Object} userContext - Context object
 * @param {Function} fn
 */
export const traceMcpResource = async (resourceUri, userContext, fn) => {
  return getTracer().startActiveSpan(
    `mcp.resource_read ${resourceUri}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        "mcp.system": "modelcontextprotocol",
        "mcp.resource.uri": String(resourceUri),
        "mcp.client.type": userContext?.clientType || "stdio",
        "user.id": String(userContext?.user?.id || "anonymous"),
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message || `MCP resource ${resourceUri} read failed`,
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
};

/**
 * Wraps an MCP Prompt request in an OpenTelemetry span (`mcp.prompt_get`).
 *
 * @param {string} promptName - Name of the MCP prompt
 * @param {Function} fn
 */
export const traceMcpPrompt = async (promptName, fn) => {
  return getTracer().startActiveSpan(
    `mcp.prompt_get ${promptName}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        "mcp.system": "modelcontextprotocol",
        "mcp.prompt.name": String(promptName),
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message || `MCP prompt ${promptName} evaluation failed`,
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
};
