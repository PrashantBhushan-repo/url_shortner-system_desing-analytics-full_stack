#!/usr/bin/env node

// 1. In stdio mode, stdout is strictly reserved for JSON-RPC messages.
// Intercept stdout.write to filter out any third-party banners (like dotenvx '◇ injected env')
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function (chunk, encoding, callback) {
  const str = typeof chunk === "string" ? chunk : (chunk ? chunk.toString() : "");
  if (str.includes("injected env") || str.startsWith("◇") || str.includes("dotenv")) {
    return process.stderr.write(chunk, encoding, callback);
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

// 2. Redirect all console.log/info to stderr so they don't corrupt stdout
console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);

process.env.DOTENV_CONFIG_QUIET = "true";
process.env.DOTENVX_QUIET = "true";
process.env.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "pburls-mcp-stdio";

// 3. Dynamically import OpenTelemetry SDK and CLI module after stdout filters are in place
await import("../otel.js");
const { runCli } = await import("./cli.js");
await runCli();
