/**
 * Enterprise Standardized Error Codes for MCP Gateway
 */
export const McpErrorCodes = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  ALIAS_ALREADY_EXISTS: "ALIAS_ALREADY_EXISTS",
  INVALID_PARAMETERS: "INVALID_PARAMETERS",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DESTRUCTIVE_CONFIRMATION_REQUIRED: "DESTRUCTIVE_CONFIRMATION_REQUIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

/**
 * Formats a standardized JSON error response with actionable recovery instructions for LLMs
 * @param {string} action - The tool name or capability being executed
 * @param {Error|string} error - The caught error
 * @param {Object} [context] - Additional context fields
 * @returns {{ isError: boolean, content: Array<{ type: string, text: string }> }}
 */
export const formatMcpError = (action, error, context = {}) => {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  let code = McpErrorCodes.INTERNAL_ERROR;
  let suggestion = "Review the provided parameters and try again.";
  let retryable = false;

  const lower = message.toLowerCase();

  if (lower.includes("already taken") || lower.includes("collision") || lower.includes("unique constraint")) {
    code = McpErrorCodes.ALIAS_ALREADY_EXISTS;
    suggestion = "This custom slug/alias is already taken. Try appending a relevant number, date, or choosing a different slug (e.g. 'my-slug-2').";
    retryable = true;
  } else if (lower.includes("not found") || lower.includes("404")) {
    code = McpErrorCodes.RESOURCE_NOT_FOUND;
    suggestion = "The requested resource or short link was not found in your workspace. Use 'list_links' to check your existing links.";
    retryable = false;
  } else if (lower.includes("plan") || lower.includes("quota") || lower.includes("limit") || lower.includes("upgrade")) {
    code = McpErrorCodes.PLAN_LIMIT_EXCEEDED;
    suggestion = "This feature or quota limit requires a higher subscription tier. Check 'search_knowledge_base' with topic 'pricing' for quota limits.";
    retryable = false;
  } else if (lower.includes("rate limit") || lower.includes("too many requests")) {
    code = McpErrorCodes.RATE_LIMITED;
    suggestion = "API rate limit threshold exceeded. Please wait a moment before sending additional requests.";
    retryable = true;
  } else if (lower.includes("invalid") || lower.includes("validation") || lower.includes("must be")) {
    code = McpErrorCodes.INVALID_PARAMETERS;
    suggestion = "One or more input parameters failed validation. Please check the schema constraints and retry with valid values.";
    retryable = true;
  } else if (lower.includes("unauthorized") || lower.includes("access denied") || lower.includes("forbidden")) {
    code = McpErrorCodes.PERMISSION_DENIED;
    suggestion = "You do not have sufficient permissions to perform this action on this resource.";
    retryable = false;
  }

  const errorPayload = {
    success: false,
    action,
    code,
    errorMessage: message,
    suggestion,
    retryable,
    ...context,
  };

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(errorPayload, null, 2),
      },
    ],
  };
};
