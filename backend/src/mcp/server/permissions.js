/**
 * Risk classification for all MCP tools
 */
export const RiskLevel = {
  READ: "READ",
  WRITE: "WRITE",
  DESTRUCTIVE: "DESTRUCTIVE",
};

/**
 * Metadata and permission policies for each capability
 */
export const ToolPolicies = {
  // Knowledge & Docs
  search_knowledge_base: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },

  // URL Capabilities
  create_short_link: {
    risk: RiskLevel.WRITE,
    requiredFeature: "api_access",
  },
  get_url_details: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
  list_links: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
  update_link_status: {
    risk: RiskLevel.WRITE,
    requiredFeature: "api_access",
  },
  deactivate_link: {
    risk: RiskLevel.DESTRUCTIVE,
    requiredFeature: "api_access",
  },
  check_link_health: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },

  // Analytics Capabilities
  get_link_analytics: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
  get_top_performing_links: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
  export_link_csv_data: {
    risk: RiskLevel.READ,
    requiredFeature: "analytics_export",
  },

  // QR Capabilities
  generate_qr_code: {
    risk: RiskLevel.WRITE,
    requiredFeature: "qr_code_allowed",
  },

  // High-Level Workflow Capabilities
  audit_campaign_performance: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
  audit_link_hygiene: {
    risk: RiskLevel.READ,
    requiredFeature: null,
  },
};

/**
 * Validates whether the user in context is authorized to invoke the specified tool
 * @param {import("./context.js").UserContext} context
 * @param {string} toolName
 * @returns {Promise<{ allowed: boolean, reason?: string, riskLevel: string }>}
 */
export const validateToolPermission = async (context, toolName) => {
  const policy = ToolPolicies[toolName];
  if (!policy) {
    return { allowed: true, riskLevel: RiskLevel.READ };
  }

  // Admins bypass feature flags
  if (context.role === "ADMIN") {
    return { allowed: true, riskLevel: policy.risk };
  }

  // Check required feature flag
  if (policy.requiredFeature) {
    const hasFeature = await context.checkFeature(policy.requiredFeature);
    if (!hasFeature) {
      return {
        allowed: false,
        reason: `Your current subscription plan (${context.plan.key}) does not include '${policy.requiredFeature}'. Upgrade to use this capability.`,
        riskLevel: policy.risk,
      };
    }
  }

  return { allowed: true, riskLevel: policy.risk };
};
