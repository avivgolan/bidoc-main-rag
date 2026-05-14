---
note_type: durable-memory-branch
project: bidoc agent
branch: timeline
last_updated: 2026-05-13
tags:
  - timeline
  - frontend
---

# Timeline

## Current State

- Timeline UI lives in `public/index.html`, `public/app.js`, and `public/styles.css` under the `#timeline` panel.
- Timeline data is loaded client-side from `GET /api/timeline`.
- Timeline event links are stored in Supabase `timeline_event_links` and exposed via `/api/timeline/links`.
- Timeline Knowledge Graph tables are defined in `supabase/timeline-knowledge-graph.sql`; graph extraction can rebuild event/entity rows via `/api/timeline/graph/rebuild`.
- The timeline supports filters, search, calendar view, and a dark interactive timeline view.
- Event details include a links panel for saving manual links, deleting links, and accepting quote-to-approval suggestions.
- Events with link suggestions are marked in the timeline node and list item, and the AI side panel shows the total suggestion count.
- Quote-to-approval suggestions use lightweight entity extraction and graph scoring in addition to text/date rules.
- Smart timeline suggestions can request semantic search plus LLM review; the review prompt includes Knowledge Graph shared entities/scores as evidence.
- Event-specific smart suggestions use the selected timeline event id and include fallback related-event suggestions from meaningful shared tags/entities.
- `#linkAgent` is a settings page for the timeline link agent, including model, prompt, semantic/graph toggles, limits, confidence threshold, ignored generic terms, and a quick event-id test.
- Smart link-agent runs accept a `runId`, stream live run events through `/api/runs/:id/events`, return a `workflowLog`, and the UI renders the trace in the Workflow tab.
- Link-agent runs are recorded in local run history and merged into `/api/run-history` alongside persisted chat workflow rows.
- `public/app.js` uses `timelineState.resolution` for day/week/month bucket sizing and `timelineState.viewportStart` for the lower strip viewport.
- The lower strip window is draggable/clickable and updates the visible time range; it also supports keyboard movement with Arrow/Home/End keys.

## Recent Changes

- 2026-05-08 -- Fixed timeline day/week/month controls so they change bucket granularity and reset the visible range.
- 2026-05-08 -- Added viewport logic and pointer/keyboard handlers for the lower timeline strip window.
- 2026-05-13 -- Added persistent timeline event links and quote-to-approval suggestions.
- 2026-05-13 -- Added Timeline Knowledge Graph extraction, Supabase schema SQL, and graph-aware suggestion scoring.
- 2026-05-13 -- Added visible markers for timeline events that have link suggestions.
- 2026-05-13 -- Added smart timeline suggestion review that combines hybrid search, Knowledge Graph evidence, and an OpenRouter model.
- 2026-05-13 -- Made smart suggestions event-focused and added related-event fallback scoring so selected events are not limited by the global top suggestions.
- 2026-05-13 -- Added the Link Agent settings page and persisted `timelineLinks` settings used by smart timeline suggestions.
- 2026-05-14 -- Added Workflow visibility for link-agent runs, including event loading, saved links, graph data, rules, semantic search, model review, filtering, and final suggestions.
- 2026-05-14 -- Link-agent smart suggestion requests now start a live run id and stream each link-agent step into the existing live run log.
- 2026-05-14 -- Merged non-chat link-agent runs into the Workflow history strip so they appear next to chat runs during the current server session.

## Gotchas

- The timeline panel is re-rendered when the strip window moves, so drag code must not depend on layout from a detached DOM node unless the track rect is captured before render.
- `console.debug("[timeline]", ...)` is used as lightweight diagnostic output for resolution and viewport changes.
