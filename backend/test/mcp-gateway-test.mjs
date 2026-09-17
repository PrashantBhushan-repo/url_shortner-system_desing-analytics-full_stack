import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/createMcpServer.js";
import { authenticateApiKey } from "../src/mcp/auth/mcpAuth.js";
import { knowledgeSearchEngine } from "../src/mcp/knowledge/searchEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const TEST_API_KEY = "snap_08334cdba7031a948ed59cfdab4dd54e628ce363f81ae771";

async function runMcpGatewayTests() {
  console.log("==================================================================");
  console.log("   🧪 PBUrls Enterprise AI Gateway & MCP Test Suite");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, extra = "") => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName} ${extra ? `(${extra})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extra ? `(${extra})` : ""}`);
      failed++;
    }
  };

  // 1. Authenticate & Build Context
  console.log("1. Authenticating API Key & Context Building...");
  const { user } = await authenticateApiKey(TEST_API_KEY);
  assert(user && user.email === "prashant.coding.org@gmail.com", "API Key SHA-256 Authentication");

  // 2. Test Knowledge Search Engine directly across deep system designs
  console.log("\n2. Testing Knowledge Engine (RAG) Direct Retrieval...");
  const botDocs = knowledgeSearchEngine.search("how does bot detection work?");
  assert(botDocs.length > 0 && botDocs[0].id.startsWith("bot-detection"), "RAG: Bot Detection search match", `Score: ${botDocs[0]?.relevanceScore}`);

  const pricingDocs = knowledgeSearchEngine.search("pricing plans and limits");
  assert(pricingDocs.length > 0 && pricingDocs[0].id === "pricing-and-limits", "RAG: Pricing Plans search match");

  const domainDocs = knowledgeSearchEngine.search("custom domain dns cname setup", "domains");
  assert(domainDocs.length > 0 && domainDocs[0].id.startsWith("custom-domains"), "RAG: Custom Domains topic search match");

  const dsaDocs = knowledgeSearchEngine.search("Base62 encoding algorithm complexity");
  assert(dsaDocs.length > 0 && (dsaDocs[0].id.includes("base62") || dsaDocs[0].id.includes("dsa")), "RAG: Base62 DSA search match", `Found: ${dsaDocs[0]?.title}`);

  const queueDocs = knowledgeSearchEngine.search("BullMQ Redis queue worker telemetry");
  assert(queueDocs.length > 0 && queueDocs[0].id.includes("analytics-pipeline"), "RAG: BullMQ Queue pipeline match", `Found: ${queueDocs[0]?.title}`);

  // 3. Connect in-memory MCP Gateway Client
  console.log("\n3. Booting Enterprise MCP Gateway & Connecting In-Memory Transport...");
  const mcpServer = await createMcpServer(user, "stdio");

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    mcpServer.connect(serverTransport),
    new Promise(async (resolve) => {
      const client = new Client({ name: "test-client", version: "2.0.0" }, { capabilities: {} });
      await client.connect(clientTransport);
      resolve(client);
    }).then(async (client) => {
      // 4. List Registered Tools
      console.log("\n4. Verifying Gateway Tool Registry...");
      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      console.log("  Registered Tools:", toolNames.join(", "));

      assert(toolNames.includes("search_knowledge_base"), "Tool registered: search_knowledge_base");
      assert(toolNames.includes("audit_campaign_performance"), "Tool registered: audit_campaign_performance");
      assert(toolNames.includes("audit_link_hygiene"), "Tool registered: audit_link_hygiene");
      assert(toolNames.includes("create_short_link"), "Tool registered: create_short_link");
      assert(toolNames.includes("get_link_analytics"), "Tool registered: get_link_analytics");
      assert(toolNames.includes("generate_qr_code"), "Tool registered: generate_qr_code");

      // 5. Tool Call: search_knowledge_base
      console.log("\n5. Invoking Tool: search_knowledge_base (RAG)...");
      const ragRes = await client.callTool({
        name: "search_knowledge_base",
        arguments: { query: "How does Base62 encoding work in PBUrls?" },
      });
      const ragData = JSON.parse(ragRes.content[0].text);
      assert(ragData.success === true && ragData.found === true && ragData.articles.length > 0, "Tool: search_knowledge_base executed", `Found: ${ragData.count} docs`);

      // 6. Tool Call: create_short_link with Idempotency
      console.log("\n6. Invoking Tool: create_short_link (with Idempotency Guard)...");
      const testSlug = `gate-${Date.now().toString().slice(-4)}`;
      const createRes1 = await client.callTool({
        name: "create_short_link",
        arguments: {
          longUrl: "https://stripe.com/docs/api",
          customSlug: testSlug,
        },
      });
      const createData1 = JSON.parse(createRes1.content[0].text);
      assert(createData1.success === true && createData1.link?.shortCode === testSlug, "First link creation succeeded");

      // Test Idempotent Retry with identical payload
      const createRes2 = await client.callTool({
        name: "create_short_link",
        arguments: {
          longUrl: "https://stripe.com/docs/api",
          customSlug: testSlug,
        },
      });
      const createData2 = JSON.parse(createRes2.content[0].text);
      assert(createData2.success === true && createData2.idempotent === true, "Idempotency Guard returned cached result without collision error");

      // 7. Tool Call: audit_campaign_performance
      console.log("\n7. Invoking High-Level Workflow: audit_campaign_performance...");
      const auditRes = await client.callTool({
        name: "audit_campaign_performance",
        arguments: { shortCode: testSlug, timeframeDays: 7 },
      });
      const auditData = JSON.parse(auditRes.content[0].text);
      assert(auditData.success === true && auditData.shortCode === testSlug, "Workflow: audit_campaign_performance completed", `Recommendations: ${auditData.actionableRecommendations?.length}`);

      // 8. Tool Call: audit_link_hygiene
      console.log("\n8. Invoking High-Level Workflow: audit_link_hygiene...");
      const hygieneRes = await client.callTool({
        name: "audit_link_hygiene",
        arguments: { limit: 10 },
      });
      const hygieneData = JSON.parse(hygieneRes.content[0].text);
      assert(hygieneData.success === true && typeof hygieneData.totalScanned === "number", "Workflow: audit_link_hygiene completed", `Scanned: ${hygieneData.totalScanned}`);

      // 9. Tool Call: get_link_analytics
      console.log("\n9. Invoking Tool: get_link_analytics...");
      const analyticsRes = await client.callTool({
        name: "get_link_analytics",
        arguments: { shortCode: testSlug, range: "7d" },
      });
      const analyticsData = JSON.parse(analyticsRes.content[0].text);
      assert(analyticsData.success === true && analyticsData.analytics?.shortCode === testSlug, "Tool: get_link_analytics completed");

      // 10. Tool Call: generate_qr_code
      console.log("\n10. Invoking Tool: generate_qr_code...");
      const qrRes = await client.callTool({
        name: "generate_qr_code",
        arguments: { shortCode: testSlug },
      });
      const qrData = JSON.parse(qrRes.content[0].text);
      assert(qrData.success === true && qrData.dataUrl?.startsWith("data:image/png"), "Tool: generate_qr_code completed");

      console.log("\n==================================================================");
      console.log(`   🏁 Results: ${passed} PASSED | ${failed} FAILED`);
      console.log("==================================================================\n");

      if (failed > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    }),
  ]);
}

runMcpGatewayTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
