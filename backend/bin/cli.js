import '../src/config/config.js';
import { startStdioServer } from "../src/mcp/transports/stdio.transport.js";

export const runCli = async () => {

  const args = process.argv.slice(2);
  let apiKey = process.env.PBURLS_API_KEY;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-key" || args[i] === "-k") {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.error(`
PBUrls MCP Server (Model Context Protocol CLI)

Usage:
  npx pburls-mcp [options]
  node bin/pburls-mcp.js [options]

Options:
  -k, --api-key <key>    PBUrls API Key (snap_...) or set PBURLS_API_KEY env var
  -h, --help             Display this help message
`);
      process.exit(0);
    }
  }

  if (!apiKey) {
    console.error("[PBUrls MCP] Error: Missing API Key.");
    console.error("Please provide your API key via PBURLS_API_KEY env variable or --api-key <key> flag.");
    process.exit(1);
  }

  await startStdioServer(apiKey);
};
