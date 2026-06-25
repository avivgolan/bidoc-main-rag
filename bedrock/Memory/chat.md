---
note_type: durable-memory-branch
project: bidoc agent
branch: chat
last_updated: 2026-06-26
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
- Quantitative RAG questions can trigger the internal `data_query` project tool; it runs through `callProjectTool`, not through an n8n webhook.
- Workflow logs include a dedicated `data_query` database node when the Data Query Agent is called.
- Data Query Agent planner OpenRouter telemetry is recorded under the `data_query` workflow node when the LLM planner is used.
- The chat page is a project workspace with a welcome state, suggested prompts, searchable recent-conversation drawer, hidden technical session ID, and a responsive floating composer.
- Mobile chat now includes an app-level navigation drawer for the main sidebar, a compact mobile shell header, and a denser composer layout that keeps chat tools visible without horizontal overflow.
- The chat workspace visual language now uses a darker editorial control-room style with layered glass surfaces, stronger display typography, upgraded sidebar hierarchy, and richer prompt/composer cards.
- The current chat shell visual direction is now a lighter contemporary workspace with warm paper tones, soft glass cards, green accents, and a cleaner mobile hierarchy instead of a dark control-room look.
- Mobile chat now favors an app-like layout over a marketing-style hero: the top shell is shorter, chat actions are compact, the welcome section is tighter, prompt suggestions scroll horizontally as compact cards, and the composer is denser and visually lighter.
- The `שיחה חדשה` action now lives inside the conversations drawer, and on mobile the secondary composer tools are hidden behind a compact `+` toggle instead of always occupying composer width.
- The mobile composer now uses a softer light capsule treatment with a minimal circular `+`, a smaller round send button, and pill-style secondary actions so the input row feels closer to a native messaging UI.
- The chat pending response is a stable progress card updated from live run events, with an optional human-readable step timeline and client-side stop control.
- Assistant responses render safe Markdown including headings, lists, quotes, code, tables, and links; structured source cards are rendered separately from inline citations.
- Completed responses expose copy, regenerate, like, and dislike actions; user messages can be returned to the composer for editing.
- The composer supports Enter-to-send, Shift+Enter for a newline, local draft persistence, auto-resize, project-source routing, user-requested deep research, and up to three plain-text/Markdown/CSV/JSON context attachments.
- `/api/chat` remains backward compatible while returning `status`, structured `sources`, `followUps`, and completed progress stages.
- Chat API calls from the browser use a two-minute timeout so a stalled request releases the send button and shows a clear error.
- `docs/chat-system-flow.md` documents the chat system flow with a Mermaid diagram covering UI, pipeline agents, OpenRouter models, App Supabase, Content Supabase, graph search, N8N tools, Workflow UI, and AI Report.
- The QA page lists recent completed chat runs by default and can filter to disliked responses; each card runs QA against that message's own workflow log.
- QA list loading uses one compact request for messages and existing reports, excluding large workflow logs from the list payload and guarding against overlapping refresh requests.
- The chat pipeline uses `src/cache.js` for provider-independent embedding, hybrid search, graph search, reranker, and final-answer caches. Development defaults to bounded memory; production can use Redis without changing pipeline code.
- Workflow logs persist cache hits, misses, hit rate, saved call counts, and estimated cost savings for each run.
- A successful chat answer is preserved even if the Workflow visualization fails to render; UI refresh errors are logged separately instead of replacing the answer.
- Chat progress state is cleared as soon as the API answer arrives, and local client/terminal run events cannot overwrite the completed answer with a progress message.
- Assistant links accept HTTP(S) only, open with `noopener noreferrer`, and hide raw URLs behind safe labels or structured source cards.
- Main RAG answers attach each source link directly to the factual bullet it supports and prohibit a consolidated sources footer; retrieval context includes each record's own `source_url` to enable correct claim-to-source matching.
- Workflow rendering falls back from the optional CDN-provided Dagre layout to Cytoscape's built-in breadth-first layout when Dagre is unavailable.

## Recent Changes

- 2026-05-09 -- Main chat now builds a structured alert-agent request with `dateFilter`, `dateFrom`, and `dateTo`.
- 2026-05-10 -- Workflow logs now show Alert as its own `Alert Agent` node instead of hiding it inside safety/tool steps.
- 2026-05-10 -- Chat pending state now shows live Hebrew progress text such as project search, Alert, meetings, and source-quality checks.
- 2026-05-12 -- Added a browser-side timeout for chat submissions and preserved the visible error text when a request fails.
- 2026-06-04 -- Added a standalone chat-system flow document showing all major model, agent, data-source, graph, workflow, and QA report connections.
- 2026-06-07 -- Changed the QA inbox from disliked-only messages to recent completed chat runs, with an optional disliked-only filter.
- 2026-06-07 -- Reduced QA page loading from a large message payload plus per-card report requests to one compact endpoint response with a client timeout.
- 2026-06-07 -- Added multi-layer chat caching with memory and Redis providers, TTL-based keys, request coalescing, fail-open behavior, and Workflow cache metrics.
- 2026-06-08 -- Prevented Workflow rendering errors from replacing successful chat answers and added a built-in layout fallback when the optional Dagre plugin is unavailable.
- 2026-06-08 -- Fixed a completion race where a post-answer Workflow UI error changed the completed chat bubble back to `ממשיך לבדוק...`.
- 2026-06-08 -- Replaced full document URLs in new and historical assistant messages with safe blue underlined `למסמך לחץ כאן` links.
- 2026-06-08 -- Changed grounded answer citations from a bottom source list to inline per-finding links, including multi-source bullets and source-aware fallback answers.
- 2026-06-09 -- Rebuilt the chat page as a responsive AI project workspace with welcome prompts, conversation drawer, richer Markdown, source cards, response actions, stop/retry states, accessible progress, local drafts, source routing, and deep-research routing.
- 2026-06-09 -- Decoupled recent-conversation loading from settings/model startup and reduced the sessions payload to compact metadata so the chat drawer populates immediately.
- 2026-06-20 -- Added a mobile main-navigation drawer, tightened the chat header/composer layout for small screens, and added Playwright coverage for the mobile shell and chat drawer behaviors.
- 2026-06-20 -- Restyled the main shell and chat workspace into a more modern editorial command-deck aesthetic without changing chat behavior or test expectations.
- 2026-06-20 -- Reworked the visual direction again into a brighter, more current light-theme mobile workspace and refreshed asset versioning so clients fetch the new CSS immediately.
- 2026-06-20 -- Refined the mobile chat UX again to reduce wasted vertical space: compact header actions, smaller welcome hierarchy, horizontal quick prompts, and a denser floating composer better suited to narrow screens.
- 2026-06-20 -- Moved `שיחה חדשה` into the chat drawer and collapsed mobile composer tools behind a `+` menu so the main input row stays smaller on narrow screens.
- 2026-06-20 -- Restyled the mobile composer toward a lighter native-chat feel with a softer capsule shell, subtler `+` affordance, rounder send action, and pill-shaped tool chips inspired by modern messaging apps.
- 2026-06-20 -- Removed a legacy wide `.composer button` treatment from the mobile composer controls so the `+` action stays transparent and proportionate instead of expanding into a large green button.
- 2026-06-26 -- Added internal `data_query` routing for count/breakdown/trend/KPI-style questions and surfaced Data Query Agent runs in chat workflow logs.
- 2026-06-26 -- Connected Data Query Agent LLM planner telemetry to the chat workflow log while keeping execution behind server-side validation.

## Related

- See [subagents](subagents.md) for Alert and Data Query agent behavior.
- See [stack](stack.md) for runtime and test commands.
