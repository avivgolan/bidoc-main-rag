---
note_type: durable-memory-branch
project: bidoc agent
branch: chat
last_updated: 2026-05-09
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

## Recent Changes

- 2026-05-09 -- Main chat now builds a structured alert-agent request with `dateFilter`, `dateFrom`, and `dateTo`.

## Related

- See [subagents](subagents.md) for Alert agent behavior.
- See [stack](stack.md) for runtime and test commands.
