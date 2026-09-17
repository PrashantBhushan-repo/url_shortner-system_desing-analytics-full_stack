# 🤖 PBUrls Model Context Protocol (MCP) Server

PBUrls features a full **Industrial-Grade MCP (Model Context Protocol) Server** implementation, enabling AI assistants (such as **Claude Desktop**, **Cursor IDE**, **Zed**, and autonomous AI agents) to manage short links, query telemetry rollups, generate QR codes, and conduct traffic audits natively via natural language.

---

## 🏗️ Architecture & Supported Transports

The PBUrls MCP implementation supports **dual transports**:

1. **Local Stdio Transport (`stdio`)**: Runs locally as a child process for desktop AI assistants (**Claude Desktop**, **Cursor IDE**).
2. **Remote Server-Sent Events Transport (`SSE`)**: Hosted on the Express API cluster at `/api/v1/mcp/sse` and `/api/v1/mcp/messages` for remote cloud agents, web copilots, and webhook automations.

```
AI Clients (Claude / Cursor / Cloud Agents)
                  │
                  ▼
        MCP Protocol (JSON-RPC 2.0)
                  │
    ┌─────────────┴─────────────┐
    ▼                           ▼
Stdio Transport            SSE Transport (/api/v1/mcp/sse)
(Local CLI)                (Express API Gateway)
    │                           │
    └─────────────┬─────────────┘
                  ▼
       PBUrls API Key Auth & Plan Gating
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
URL Tools   Analytics Tools  QR Tools
     │            │            │
     └────────────┼────────────┘
                  ▼
    PostgreSQL & Redis (PBUrls Core)
```

---

## 🛠️ Available MCP Tools

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `create_short_link` | `longUrl` (req), `customSlug`, `expiresAt`, `password`, `customDomainId` | Shortens a URL with optional custom alias, expiry date, and password protection. |
| `get_url_details` | `shortCode` (req) | Fetches destination URL, click count, alive status, and expiration metadata. |
| `get_link_analytics` | `shortCode` (req), `range` ("24h" \| "7d" \| "30d"), `includeTimeseries` | Detailed telemetry: total/unique/bot clicks, growth %, top countries, devices, and referrers. |
| `get_top_performing_links`| `limit` (default: 5) | Ranks the highest-traffic short links in the user account over the last 30 days. |
| `list_links` | `limit` (default: 20) | Lists user-owned short links with status and target URLs. |
| `generate_qr_code` | `shortCode` (req) | Generates dynamic QR code PNG (Base64 Data URL) with scan-tracking parameters. |
| `update_link_status` | `shortCode` (req), `longUrl`, `customAlias`, `expiresAt`, `password` | Updates link destination, custom alias, or expiration timestamp. |
| `deactivate_link` | `shortCode` (req) | Deactivates (soft-deletes) a short link (returns 410 Gone). |
| `check_link_health` | `shortCode` (req) | Checks destination uptime, alive flag, and health-check failure count. |
| `export_link_csv_data` | `shortCode` (req), `range` | Streams raw individual click telemetry logs formatted as CSV. |

---

## 📦 Resources & Prompts

### Resources
- `pburls://links/{shortCode}` — Link metadata and current live configuration.
- `pburls://analytics/{shortCode}` — 7-day aggregated click overview telemetry.

### Prompts
- **`campaign-performance-audit`**: Pre-engineered prompt guiding the AI to audit unique vs. bot clicks, geographic distribution, and provide conversion recommendations.
- **`link-hygiene-report`**: Scans user links for dead targets, failed health-checks, or upcoming expirations.

---

## 🚀 Setup & Configuration

### 1. Claude Desktop Setup

Add the following to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pburls": {
      "command": "node",
      "args": ["<PATH_TO_PROJECT>/backend/bin/pburls-mcp.js"],
      "env": {
        "PBURLS_API_KEY": "snap_your_api_key_here"
      }
    }
  }
}
```

### 2. Cursor IDE Setup

In Cursor settings under **Features > MCP Servers > Add New MCP Server**:
- **Name**: `pburls`
- **Type**: `command`
- **Command**: `node <PATH_TO_PROJECT>/backend/bin/pburls-mcp.js`
- **Environment**: Set `PBURLS_API_KEY=snap_your_api_key_here`

### 3. Remote SSE Agent Connection

Connect any MCP client over SSE:
```http
GET /api/v1/mcp/sse?apiKey=snap_your_api_key_here
Host: localhost:5000
Accept: text/event-stream
```

Post JSON-RPC messages to the returned session endpoint:
```http
POST /api/v1/mcp/messages?sessionId=<SESSION_ID>
Host: localhost:5000
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_short_link",
    "arguments": {
      "longUrl": "https://example.com/products/release-v2",
      "customSlug": "v2-launch"
    }
  }
}
```

---

## 🔒 Security & Plan Quotas

- **Authentication**: Authenticates using SHA-256 hashed API Keys generated in the dashboard.
- **Plan Limits**: Tied to `planLimitService.js` to ensure AI agents respect plan quotas (`api_access`, custom domains, max links).
- **Data Redaction**: Sensitive fields (`password_hash`, internal IPs) are automatically omitted from AI context.
