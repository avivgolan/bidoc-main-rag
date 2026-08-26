import { McpServer } from "@modelcontextprotocol/server";
import { QaHarnessService } from "../qa/qaHarnessService.js";
import { createLocalMcpContext } from "./context.js";
import { registerQaTools } from "./tools/qaTools.js";

export function buildQaMcpServer({
  service = new QaHarnessService(),
  contextProvider = () => createLocalMcpContext()
} = {}) {
  const server = new McpServer(
    { name: "bidoc-qa-tuning", version: "1.0.0" },
    {
      instructions: "Use QA tools only within the authenticated organization/project scope. Phase 1 runs production-effective configuration in isolated read-only mode and never writes normal chat history. Use qa_get_run after qa_run_test_suite."
    }
  );
  registerQaTools(server, { service, contextProvider });
  return server;
}
