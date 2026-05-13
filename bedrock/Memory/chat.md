---
note_type: durable-memory-branch
project: bidoc agent
branch: chat
last_updated: 2026-05-12
tags:
  - chat
  - rag
  - classifier
---

# Chat

## Current State

- `src/agent.js` owns the main chat pipeline: sanitize, save message, classify, load memory, route to Lite Agent or Main RAG Agent, then update the saved message.
- `src/classifier.js` normalizes model output into `type`, `complexity`, `tool_hint`, `urgency`, `date_from`, `date_to`, hashtags, professional mode, and investigation mode.
- Main RAG uses `hybridSearch` with `classification.date_from` and `classification.date_to`.
- Tool ordering comes from `buildToolOrder` in `src/tools.js`; high urgency forces `safety_report` then `alert`.
- Main RAG calls project tools through `callProjectTool` in `src/agent.js`.
- Workflow logs include a dedicated `alert_agent` node when the Alert subagent is called.
- The chat pending assistant bubble is updated from live run events instead of showing a static `חושב...` message.
- Chat API calls from the browser use a two-minute timeout so a stalled request releases the send button and shows a clear error.

## Recent Changes

- 2026-05-09 -- Main chat now builds a structured alert-agent request with `dateFilter`, `dateFrom`, and `dateTo`.
- 2026-05-10 -- Workflow logs now show Alert as its own `Alert Agent` node instead of hiding it inside safety/tool steps.
- 2026-05-10 -- Chat pending state now shows live Hebrew progress text such as project search, Alert, meetings, and source-quality checks.
- 2026-05-12 -- Added a browser-side timeout for chat submissions and preserved the visible error text when a request fails.

## Related

- See [subagents](subagents.md) for Alert agent behavior.
- See [stack](stack.md) for runtime and test commands.
