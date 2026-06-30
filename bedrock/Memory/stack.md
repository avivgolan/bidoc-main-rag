---
note_type: durable-memory-branch
project: bidoc agent
branch: stack
last_updated: 2026-06-04
tags:
  - stack
  - runtime
---

# Stack

## Current State

- The app is a Node.js >=20 ESM project with no npm dependencies.
- `package.json` exposes `dev`, `start`, and `test`; all run Node directly.
- The HTTP server is implemented with `node:http` in `src/server.js`.
- The frontend is still primarily a plain HTML/CSS/JS single-page app in `public/`, with a progressive React island bridge for staged screen migration.
- React 19, ReactDOM, Vite, and `@vitejs/plugin-react` are installed; `npm run react:build` builds the React bridge into `public/react/bidoc-react.js`.
- `public/index.html` loads a tiny `public/react-loader.js` module that imports the React bridge only when `[data-react-island]` elements exist, so current screens do not pay the React bundle cost until migrated.
- Deployment routes all requests through `src/server.js` using `vercel.json`.
- Persistent mutable state is expected to live in Supabase, not local data files.
- Runtime config separates App Supabase from optional Content Supabase: App DB stores settings, chat history, QA, timeline links, and graph tables; Content DB serves RAG, timeline event, and alert retrieval.
- App Supabase now also owns the general Project Graph tables (`graph_nodes`, `graph_edges`) defined by `supabase/project-graph.sql`.
- The Project Graph viewer is exposed through `GET /api/graph` and the `#graph` SPA tab, rendering App Supabase graph data with Cytoscape.
- Project Graph extraction now maps real Content `data_index` fields into semantic graph kinds: hashtags, vendors, people, submitters, categories, transaction types, statuses, source tables, documents, emails, attachments, mentioned dates, risks, quotes, and invoices.
- Main RAG synthesis receives a dedicated `project_graph_findings` payload and switches to `ranked_entity_list` mode for who/what/which/more style investigation questions.
- Agent prompts now distinguish true project delays from incidental lateness, avoid invented broad delay hashtags for retrieval, and rerank delay/blocker questions by project impact rather than keyword overlap alone.
- Content Supabase can be configured with separate URL/key plus custom hybrid RPC, index table, alerts table, and alerts RPC; when omitted, content retrieval falls back to App Supabase and legacy table/RPC names.
- The current Content `data_index` schema uses `primary_date` for timeline dates and `index_text`/`summary`/`title` for content text, plus `source_url`, `source_table`, `source_id`, `project_id`, `mail_id`, `attachment_id`, and `mentioned_dates` for provenance.
- The current Content `alerts` schema uses `data_date` for timeline dates and `summary`/`alert_description`/`content`/`answer` for alert text, plus `alert_type`, `severity_level`, `data_link`, and `item_status`.
- `.env` and `.env.local` are resolved from the repository root based on `src/config.js`, not from the process working directory.
- Settings UI displays masked secrets only as placeholders; password fields stay empty so masked values are not submitted as real keys.
- Settings UI can export/import a local JSON settings file; export includes full unmasked API keys and connection fields, so the file must be handled as a secret.
- Settings export/import controls are wired during Settings initialization; downloads defer object-URL cleanup and imports validate JSON before saving and refreshing the form.
- Settings saves and imports now report success only after the shared App Supabase write succeeds; failed persistence leaves the prior runtime cache unchanged.
- Settings import is draft-only again: `POST /api/settings/import` previews wrapped/raw JSON into the UI form, reapplies raw secret fields locally, and requires the main Save flow to persist anything to Supabase.
- Settings now follows an explicit persisted-versus-draft lifecycle: initial page load always reads App Supabase, file import and secondary settings buttons only update the browser draft, and only the main Save flow writes the complete form back to `agent_settings`.
- Settings now exposes a presets card at the top of the page: users can load built-in tuning presets into the draft form and save custom presets back into `agent_settings` without storing a separate table.
- Vercel settings saves no longer perform an immediate follow-up GET that can hit a stale serverless instance and reset the form; the UI uses the successful PUT response instead.
- Imported App Supabase credentials can bootstrap a write on a running server, while stateless deployments still require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the server environment for fresh instances and cross-browser consistency.
- `agent_settings` writes are now guarded in `writeLocalSettings`: callers must declare the approved source `settings_save`, so unrelated routes and background flows cannot silently persist stale cache state.
- Settings UI has a dedicated Chat section that owns chat-affecting models, prompts, hybrid search tuning, knowledge vocabulary, timezone, and Content Supabase settings.
- Settings UI model fields are OpenRouter-backed dropdowns that show context tokens and input/output pricing when available.
- Settings UI exposes balanced advanced AI controls for model temperature/max tokens/timeouts, RAG context budget, graph context, Knowledge Base limits, and tool runtime toggles.
- Settings groups the embedding model with a visible retrieval funnel: Hybrid rows per query, Planner rows per query, Alert rows, Reranker results, and final Main context records. Planner and Alert row limits are persisted and used by their actual retrieval calls.
- The Agents page is read-only monitoring/status UI; prompt and model edits are saved through `/api/settings`, and `/api/agents` rejects writes.
- Runtime config ignores masked secret values such as `sk-o...abcd` or `********` and falls back to environment variables.
- Supabase requests use `apikey` for `sb_secret_...` keys and add `Authorization: Bearer ...` only for legacy JWT keys that start with `eyJ`.
- `start-bidoc.bat` starts the local Node.js server, waits for port 4000 to respond, and opens the application in the default browser.
- The Tools diagnostics dashboard groups core services, data sources, AI agents, and N8N tools, with both full-suite and per-component checks.
- QA reports follow the user's language and do not treat skipped optional n8n tools as root causes without run evidence that those tools were required.

## Recent Changes

- 2026-05-09 -- Onboarded stack facts from `package.json`, `CLAUDE.md`, and repo layout.
- 2026-05-11 -- Fixed secret handling so masked OpenRouter/Supabase keys are never treated as saved credentials.
- 2026-05-12 -- Updated Supabase headers for new `sb_secret_...` service keys across settings, diagnostics, main Supabase calls, and Alert subagent search.
- 2026-05-12 -- Made env loading independent of the shell's current working directory and improved diagnostics for network-level fetch failures.
- 2026-06-03 -- Added a separate Content Supabase configuration for RAG/timeline/alerts while keeping application state on App Supabase.
- 2026-06-03 -- Mapped timeline/RAG previews to the new `data_index` schema fields (`primary_date`, `index_text`, `summary`, `title`, `source_url`, `mail_id`, `attachment_id`, `mentioned_dates`).
- 2026-06-03 -- Mapped alert timeline events to the new `alerts` schema fields (`data_date`, `alert_description`, `alert_type`, `severity_level`, `data_link`).
- 2026-06-03 -- Added local JSON settings export/import from the Settings page, including full secret values.
- 2026-06-03 -- Changed Settings model fields from free text to OpenRouter model dropdowns with context/pricing labels.
- 2026-06-03 -- Added a general Supabase Project Graph layer with `graph_nodes`, `graph_edges`, and `graph_search` support for chat/timeline context.
- 2026-06-04 -- Fixed timeline/project graph rebuild upserts to dedupe payload rows and use explicit `on_conflict` constraints for non-primary-key unique indexes.
- 2026-06-04 -- Batched Project Graph upserts and compacted graph node metadata so alert graph rebuild avoids Supabase statement timeouts.
- 2026-06-04 -- Added the `#graph` UI tab and `/api/graph` endpoint for browsing Project Graph nodes and relationships.
- 2026-06-04 -- Improved Project Graph browsing so filters use semantic entity/relation kinds from project data (`hashtag`, `vendor`, `document`, `has_vendor`, etc.) and hide noisy raw URL source nodes by default.
- 2026-06-04 -- Strengthened Main Agent graph instructions so graph context is used actively for ranked multi-candidate answers instead of only as supporting evidence.
- 2026-06-04 -- Updated Agents prompts for delay investigations: classifier avoids broad fake delay hashtags, reranker demotes meeting lateness without project impact, and stale stored prompt overrides are cleared selectively.
- 2026-06-04 -- Consolidated chat configuration under Settings and made Agents a read-only monitoring view.
- 2026-06-04 -- Reorganized Settings chat configuration so each editable chat agent shows its model selector next to its prompt textarea.
- 2026-06-04 -- Strengthened Settings visual hierarchy with clearer subsection dividers and a framed chat agent model/prompt area.
- 2026-06-04 -- Moved the N8N Base URL field from the model area to the webhook tools section with inline guidance.
- 2026-06-04 -- Added balanced advanced AI settings for per-agent generation parameters, RAG/graph context limits, Knowledge Base chunking, and tool runtime controls.
- 2026-06-04 -- Improved advanced AI settings UX by keeping model controls collapsed by default and adding common OpenRouter sampling controls (`top_p`, penalties, seed).
- 2026-06-04 -- Added inline Hebrew info buttons for advanced AI, RAG, graph, knowledge, and tool runtime settings.
- 2026-06-04 -- Added Workflow "AI Report" runs that invoke the QA agent on a selected run, save the result in QA reports, and attach it to run history workflow logs.
- 2026-06-07 -- Added a Windows launcher that starts the local server and opens the application after it is ready.
- 2026-06-07 -- Expanded connection diagnostics to cover graph/alert RPCs, Knowledge Base, every configured AI agent, and all N8N tools with individual rerun controls.
- 2026-06-07 -- Fixed Settings JSON export/import buttons that were unreachable after a timeline helper return, and verified a full export/import round trip.
- 2026-06-08 -- Made settings import/save fail clearly when App Supabase persistence fails, prevented false-success cache updates, and documented deployment environment requirements for shared settings.
- 2026-06-08 -- Improved QA report diagnosis so Hebrew runs produce Hebrew reports, optional skipped n8n tools are not blamed automatically, and retrieval failures are separated from answer-generation failures.
- 2026-06-08 -- Reworked Settings persistence so initial loads are fresh from Supabase, imports remain unsaved drafts, saves preserve hidden settings and secrets, and serverless stale-cache responses cannot reset the form.
- 2026-06-08 -- Added bounded, configurable retrieval row limits beside the Embedding model for primary Hybrid Search, Knowledge Planner queries, Alert retrieval, reranking, and Main Agent context.
- 2026-06-17 -- Added top-of-page Settings presets with 3 built-in calibration profiles (Conservative, Balanced, Cheap Test) plus persisted custom presets saved inside the shared `agent_settings` record.
- 2026-06-20 -- Locked `agent_settings` persistence to the main Settings save route only; import, subagent saves, link-agent saves, preset saves, and startup prompt migration are all draft-only or non-persistent.
- 2026-06-26 -- Added a progressive React/Vite frontend bridge with lazy island loading so individual screens can migrate from vanilla JS without replacing the existing SPA shell.

## Recent Changes (continued)

- 2026-06-12 -- Added `@playwright/test` devDependency and Chromium; `npm run test:ui` runs Playwright smoke tests from `test/ui/`; config at `playwright.config.js`; artifacts go to `test-results/` and `playwright-report/` (both gitignored).
- 2026-06-12 -- `playwright.config.js` retries set to 1 (was 0) to tolerate OS-level transient failures without masking real bugs.

## Gotchas

- On this Windows machine, `npm.ps1` may be blocked by PowerShell execution policy; `node .\test\run-tests.js` runs the test suite directly.
- Playwright tests use port 4099 (not 4000) and pass empty `SUPABASE_URL` to the webServer to prevent real Supabase traffic during smoke runs.
- Two events in index fixtures share date 2026-04-20 (`idx-001`, `idx-002`); use `.filter({ hasText })` or `[data-event-id]` selectors instead of `.first()` / `.last()` to avoid sort-order brittleness.
- If Supabase already contains a masked key from an older save, the next settings save will clear that stored masked value; re-enter the real key if there is no env fallback.
- Content Supabase diagnostics expose the decoded key role; `anon` keys can return zero content rows under RLS even when the table exists, so timeline/RAG content should use a service-role key or matching read policies.
