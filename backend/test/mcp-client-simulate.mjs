import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/createMcpServer.js";
import { authenticateApiKey } from "../src/mcp/auth/mcpAuth.js";

async function simulateClaudeDesktop() {
  console.log("🤖 Simulating Claude Desktop connecting to PBUrls MCP Server...");

  const { user } = await authenticateApiKey("snap_08334cdba7031a948ed59cfdab4dd54e628ce363f81ae771");
  const mcpServer = createMcpServer(user);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await mcpServer.connect(serverTransport);

  const client = new Client({ name: "claude-desktop-simulator", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  console.log("✅ Client connected to MCP server successfully");

  // 1. Test tools/list
  console.log("\n📋 Listing tools from client perspective...");
  const toolsResult = await client.listTools();
  console.log(`Found ${toolsResult.tools.length} tools:`, toolsResult.tools.map(t => t.name));

  // 2. Test tools/call create_short_link
  console.log("\n✂️ Calling create_short_link...");
  const createResult = await client.callTool({
    name: "create_short_link",
    arguments: {
      longUrl: "https://mail.google.com/mail/u/1/#search/viswatej/FMfcgzQgKvFlLCXndmJCBTDvNgJhrVjv",
      customSlug: `sim-${Date.now().toString().slice(-6)}`,
    },
  });
  console.log("Create tool response:", JSON.stringify(createResult, null, 2));

  // 3. Test tools/call list_links
  console.log("\n📑 Calling list_links...");
  const listResult = await client.callTool({
    name: "list_links",
    arguments: { limit: 5 },
  });
  console.log("List tool response:", JSON.stringify(listResult, null, 2));

  // 4. Test tools/call get_link_analytics
  console.log("\n📊 Calling get_link_analytics for 'visva'...");
  const analyticsResult = await client.callTool({
    name: "get_link_analytics",
    arguments: { shortCode: "visva", range: "7d" },
  });
  console.log("Analytics tool response:", JSON.stringify(analyticsResult, null, 2));

  console.log("\n🎉 ALL SIMULATED CLAUDE CALLS COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

simulateClaudeDesktop().catch((err) => {
  console.error("❌ Simulation failed:", err);
  process.exit(1);
});
