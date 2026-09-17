import { createMcpServer } from "../src/mcp/createMcpServer.js";

async function testMcpServer() {
  console.log("==========================================");
  console.log("🧪 Testing PBUrls Industrial MCP Server");
  console.log("==========================================");

  const mockUser = {
    id: "user-test-uuid",
    email: "enterprise-user@pburls.com",
    role: "USER",
    name: "Enterprise Dev",
  };

  const server = await createMcpServer(mockUser);
  if (!server) {
    throw new Error("Failed to create MCP server instance");
  }

  const tools = Object.keys(server._registeredTools);
  const resources = Object.keys(server._registeredResourceTemplates);
  const prompts = Object.keys(server._registeredPrompts);

  console.log(`\n🛠️  Registered Tools (${tools.length}):`);
  tools.forEach((tool, idx) => {
    console.log(`   ${idx + 1}. ${tool}`);
  });

  console.log(`\n📦 Registered Resource Templates (${resources.length}):`);
  resources.forEach((res, idx) => {
    console.log(`   ${idx + 1}. ${res}`);
  });

  console.log(`\n💬 Registered Prompts (${prompts.length}):`);
  prompts.forEach((prompt, idx) => {
    console.log(`   ${idx + 1}. ${prompt}`);
  });

  if (tools.length !== 13) {
    throw new Error(`Expected 13 tools, found ${tools.length}`);
  }
  if (resources.length !== 2) {
    throw new Error(`Expected 2 resources, found ${resources.length}`);
  }
  if (prompts.length !== 2) {
    throw new Error(`Expected 2 prompts, found ${prompts.length}`);
  }

  console.log("\n==========================================");
  console.log("🎉 All MCP Server component validations PASSED!");
  console.log("==========================================");
}

testMcpServer().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
