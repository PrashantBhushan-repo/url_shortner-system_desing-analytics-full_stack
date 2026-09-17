import express from "express";
import {
  handleSseConnection,
  handlePostMessage,
  getMcpServerInfo,
} from "../mcp/transports/sse.transport.js";

const router = express.Router();

/**
 * @route   GET /api/v1/mcp/info
 * @desc    Get MCP Server manifest and tool capabilities
 * @access  Public
 */
router.get("/info", getMcpServerInfo);

/**
 * @route   GET /api/v1/mcp/sse
 * @desc    Establish Server-Sent Events (SSE) stream for MCP clients
 * @access  Protected (API Key required)
 */
router.get("/sse", handleSseConnection);

/**
 * @route   POST /api/v1/mcp/messages
 * @desc    Post JSON-RPC messages to an established MCP session
 * @access  Protected (Session-based)
 */
router.post("/messages", handlePostMessage);

export default router;
