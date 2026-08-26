import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { initSettings, loadEnv } from "../config.js";
import { buildQaMcpServer } from "./serverFactory.js";

// stdout is reserved for MCP JSON-RPC. Existing BiDoc pipeline diagnostics use
// console.log, so route them to stderr inside this dedicated child process.
console.log = (...args) => console.error(...args);

loadEnv();
await initSettings().catch((error) => console.error(`[bidoc-qa-mcp] settings init degraded: ${error.message}`));

serveStdio(() => buildQaMcpServer());
console.error("BiDoc QA & Tuning MCP Phase 1 listening on stdio");
