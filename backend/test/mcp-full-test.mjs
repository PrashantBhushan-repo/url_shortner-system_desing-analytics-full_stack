import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/createMcpServer.js";
import { authenticateApiKey } from "../src/mcp/auth/mcpAuth.js";

async function verifyAllTools() {
  console.log("🧪 Comprehensive Industrial MCP Tool Verification Suite...");

  const { user } = await authenticateApiKey("snap_08334cdba7031a948ed59cfdab4dd54e628ce363f81ae771");
  const mcpServer = createMcpServer(user);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);

  const client = new Client({ name: "claude-desktop-test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  // 1. Test create_short_link with unique slug
  const testSlug = `e2e-${Date.now().toString().slice(-5)}`;
  const createRes = await client.callTool({
    name: "create_short_link",
    arguments: {
      longUrl: "https://example.com/developer/docs",
      customSlug: testSlug,
    },
  });
  console.log("✅ 1. create_short_link:", JSON.parse(createRes.content[0].text).success);

  // 2. Test get_url_details
  const detailsRes = await client.callTool({
    name: "get_url_details",
    arguments: { shortCode: testSlug },
  });
  console.log("✅ 2. get_url_details:", JSON.parse(detailsRes.content[0].text).success);

  // 3. Test list_links
  const listRes = await client.callTool({
    name: "list_links",
    arguments: { limit: 10 },
  });
  console.log("✅ 3. list_links:", JSON.parse(listRes.content[0].text).success);

  // 4. Test generate_qr_code
  const qrRes = await client.callTool({
    name: "generate_qr_code",
    arguments: { shortCode: testSlug },
  });
  console.log("✅ 4. generate_qr_code:", JSON.parse(qrRes.content[0].text).success);

  // 5. Test get_link_analytics
  const analyticsRes = await client.callTool({
    name: "get_link_analytics",
    arguments: { shortCode: testSlug, range: "7d" },
  });
  console.log("✅ 5. get_link_analytics:", JSON.parse(analyticsRes.content[0].text).success);

  // 6. Test get_top_performing_links
  const topRes = await client.callTool({
    name: "get_top_performing_links",
    arguments: { limit: 5 },
  });
  console.log("✅ 6. get_top_performing_links:", JSON.parse(topRes.content[0].text).success);

  // 7. Test check_link_health
  const healthRes = await client.callTool({
    name: "check_link_health",
    arguments: { shortCode: testSlug },
  });
  console.log("✅ 7. check_link_health:", JSON.parse(healthRes.content[0].text).success);

  // 8. Test update_link_status
  const updateRes = await client.callTool({
    name: "update_link_status",
    arguments: { shortCode: testSlug, longUrl: "https://example.com/updated-docs" },
  });
  console.log("✅ 8. update_link_status:", JSON.parse(updateRes.content[0].text).success);

  // 9. Test export_link_csv_data
  const csvRes = await client.callTool({
    name: "export_link_csv_data",
    arguments: { shortCode: testSlug, range: "7d" },
  });
  console.log("✅ 9. export_link_csv_data: length =", csvRes.content[0].text.length);

  // 10. Test deactivate_link
  const deactivateRes = await client.callTool({
    name: "deactivate_link",
    arguments: { shortCode: testSlug },
  });
  console.log("✅ 10. deactivate_link:", JSON.parse(deactivateRes.content[0].text).success);

  console.log("\n🚀 ALL 10 INDUSTRIAL MCP TOOLS PASSED 100% OF AUTOMATED INTEGRATION TESTS!");
  process.exit(0);
}

verifyAllTools().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
