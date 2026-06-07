---
note_type: durable-memory-branch
project: bidoc agent
branch: chat
last_updated: 2026-06-04
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
- `docs/chat-system-flow.md` documents the chat system flow with a Mermaid diagram covering UI, pipeline agents, OpenRouter models, App Supabase, Content Supabase, graph search, N8N tools, Workflow UI, and AI Report.
- The QA page lists recent completed chat runs by default and can filter to disliked responses; each card runs QA against that message's own workflow log.
- QA list loading uses one compact request for messages and existing reports, excluding large workflow logs from the list payload and guarding against overlapping refresh requests.
- The chat pipeline uses `src/cache.js` for provider-independent embedding, hybrid search, graph search, reranker, and final-answer caches. Development defaults to bounded memory; production can use Redis without changing pipeline code.
- Workflow logs persist cache hits, misses, hit rate, saved call counts, and estimated cost savings for each run.

## Recent Changes

- 2026-05-09 -- Main chat now builds a structured alert-agent request with `dateFilter`, `dateFrom`, and `dateTo`.
- 2026-05-10 -- Workflow logs now show Alert as its own `Alert Agent` node instead of hiding it inside safety/tool steps.
- 2026-05-10 -- Chat pending state now shows live Hebrew progress text such as project search, Alert, meetings, and source-quality checks.
- 2026-05-12 -- Added a browser-side timeout for chat submissions and preserved the visible error text when a request fails.
- 2026-06-04 -- Added a standalone chat-system flow document showing all major model, agent, data-source, graph, workflow, and QA report connections.
- 2026-06-07 -- Changed the QA inbox from disliked-only messages to recent completed chat runs, with an optional disliked-only filter.
- 2026-06-07 -- Reduced QA page loading from a large message payload plus per-card report requests to one compact endpoint response with a client timeout.
- 2026-06-07 -- Added multi-layer chat caching with memory and Redis providers, TTL-based keys, request coalescing, fail-open behavior, and Workflow cache metrics.

## Related

- See [subagents](subagents.md) for Alert agent behavior.
- See [stack](stack.md) for runtime and test commands.
