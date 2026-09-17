import { z } from "zod";

/**
 * Register MCP Prompt Templates for PBUrls
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export const registerPrompts = (server) => {
  // 1. Campaign Performance Audit Prompt
  server.prompt(
    "campaign-performance-audit",
    "Audit traffic performance, country distributions, bot activity, and top referrers for a campaign shortlink.",
    {
      shortCode: z.string().describe("The short code of the link to audit"),
      goal: z.string().optional().describe("Optional campaign goal or context (e.g. 'Drive US developer signups')"),
    },
    ({ shortCode, goal }) => {
      const goalText = goal ? `\nCampaign Context / Goal: ${goal}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please conduct a comprehensive traffic and conversion audit for PBUrls short link: '${shortCode}'.${goalText}

Steps to follow:
1. Use the 'get_link_analytics' tool with range '30d' and '7d' for this short code.
2. Evaluate unique vs total clicks and check for bot/spam anomalies.
3. Identify top geographic markets (countries/cities) and primary referrers/UTM sources.
4. Provide 3 actionable recommendations to improve conversion and campaign reach.`,
            },
          },
        ],
      };
    }
  );

  // 2. Link Hygiene & Uptime Audit Prompt
  server.prompt(
    "link-hygiene-report",
    "Scan user links for dead targets, upcoming expirations, or failing health checks.",
    {
      limit: z.string().optional().describe("Number of links to inspect (e.g. '10')"),
    },
    ({ limit = "10" }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please run a link hygiene and health inspection across my PBUrls links (up to ${limit} links).

Steps:
1. Call 'list_links' with limit ${limit}.
2. Check the alive status and expiration dates for each link.
3. Highlight any expired links, inactive URLs, or links with health-check failures.
4. Recommend which links need updates or cleanup.`,
            },
          },
        ],
      };
    }
  );
};
