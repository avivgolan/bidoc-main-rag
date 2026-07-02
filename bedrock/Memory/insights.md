---
note_type: durable-memory-branch
project: bidoc agent
branch: insights
last_updated: 2026-07-02
tags:
  - insights
  - ai-agent
  - frontend
---

# Insights

## Current State

- The intended product direction for `#insights` is AI project insights over indexed project data, not a contractor delay-claim or legal case workflow.
- The replacement roadmap lives in `docs/ai-project-insights-roadmap.md`.
- Stage 1 is an index-first AI insights MVP:
  - optional focus query
  - optional date range
  - source limit
  - Content Index scan
  - hybrid search when focus query exists
  - AI synthesis with OpenRouter when configured
  - deterministic fallback when AI is unavailable
- The analysis endpoint is `POST /api/insights/analyze`.
- The analysis module is `src/subagents/projectInsights.js`.
- The endpoint does not create new Supabase tables and does not write claim/case data.
- Project insights now reuses the same project-tool layer as chat where applicable: Hybrid/Search index records, Project Graph Search, Alert Agent, configured n8n tools, Source Quality, and Conflict Detection.
- Successful insight runs are recorded as `kind: project_insights_analysis` and the UI refreshes Workflow run history after the report finishes.
- Insight cards include title, category, severity, confidence, finding, why it matters, recommended action, local human status, and evidence from index records.
- The old delay-claim workspace still exists in code but is hidden from the `#insights` page while the product direction is corrected.
- Project insights workflow nodes are `index_scan`, `focus_retrieval`, `graph_search`, `alert_agent`, `n8n_tools`, `source_quality`, `conflict_detection`, `signal_detection`, `ai_synthesis`, `insight_ranking`, and `insights_output`.
- Project insight evidence extraction tolerates missing or non-array term input, including accidental `Array.map` index arguments.
- AI synthesis requests OpenRouter structured JSON output and can parse fenced JSON arrays before falling back to deterministic insights.
- The Insights UI supports cumulative expansion: after an initial run, "הרחב תשובה" sends previously scanned source keys as exclusions and appends new insight cards to the existing results.
- Cumulative expansion depends on timeline pagination cursors; `fetchTimelineEventPage` now decodes encoded cursor strings before building Supabase filters.
- The default Insights date range is 2024-02-01 through 2026-01-01.
- Project insight runs persist to the KAPAIM content Supabase table `project_insight_runs`; saved rows include workflow log, run events, insight cards, scanned source keys, excluded source keys, summary, tool context, and parent run id for expansions.
- The Insights UI includes a history panel backed by `GET /api/insights/runs`; selecting a saved run restores its cards, workflow, dates, source limit, scanned keys, and enables continuing with "הרחב תשובה" from that point.
- Expansion runs with a parent run are saved as cumulative snapshots, so selecting an expanded run later shows the parent insights plus newly found cards.
- Optional focus query affects local signal ranking through token/stem overlap, not only exact phrase matching, so paraphrased Hebrew focus text can boost related evidence cards.
- Project Insights now uses a two-layer result model: `findings` are evidence-backed observations from the index/tools, while `insights` are synthesized AI/project-level conclusions with `supporting_finding_ids`.
- The `#insights` UI renders synthesized insights first, shows each insight's supporting findings inside the card, and keeps unmatched findings in a separate section.
- Persisted Project Insight runs continue using `project_insight_runs`; `insights` remain in the existing column and `findings` are stored inside `metadata.findings`.
- Historical runs without `findings` are loaded with a fallback that treats old insight cards as legacy findings, so old reports remain viewable.
- The Insights page now includes an Alert/Index hashtag analytics chart above the Project Insights agent.
- `GET /api/insights/hashtags` counts hashtags from the KAPAIM content Supabase project and accepts `date_from`, `date_to`, and `source`.
- The hashtag chart uses the same Insights date range inputs, auto-refreshes after date changes, and can switch between `alerts` and `index` sources.
- The hashtag chart now also acts as an input control for Project Insights: clicking a chart bar toggles a selected hashtag chip, and selected hashtags are sent to `POST /api/insights/analyze` as `selectedHashtags` with `hashtagMode: "boost"`.
- Project Insights now has a `hashtag_analysis` workflow node. It computes selected, top, and active hashtags, sends active hashtags into focus `hybridSearch`, boosts local record/evidence ranking by hashtag overlap, and includes hashtag context in the AI synthesis payload.
- Insight findings/evidence/records now carry normalized `hashtags`, and the project-insights system prompt instructs the model to use hashtags as grouping context only when supported by evidence.
- For KAPAIM content data, Alerts must come from `public.alerts` and Index must come from `public.data_index`; do not use the old default embeddings table name for this chart.
- Local env now pins `CONTENT_INDEX_TABLE=data_index`; Content Supabase URL is resolved from settings/secret configuration and should point at project id `smxibuaowzuxkznuouwj`.
- `trimSlash` in `src/config.js` trims surrounding whitespace before removing trailing slashes so pasted Supabase URLs with leading spaces do not leak into runtime config.
- The Insights UI was redesigned with a dark SaaS/OLED visual system, improved chart controls, skeleton loading, welcome empty state, status pills, keyboard shortcuts, collapsible evidence, and auto-scroll after analysis.
- The `project_insights` agent prompt is now editable in Settings -> "סוכני AI" like other agents: it is defined in `AGENT_DEFINITIONS` (`src/prompts.js`), read at runtime by `src/subagents/projectInsights.js` via `config.prompts.project_insights` (hardcoded fallback retained), and rendered as an agent card by the React settings island (`public/react/bidoc-react.js`).
- Read-only insights endpoints (`/api/insights/runs`, `/api/insights/hashtags`) AND `POST /api/insights/analyze` use `checkBidocSecretForRead`: same-origin UI requests (no `x-content-supabase-url` header) skip the `BIDOC_API_SECRET` check, while cross-tenant/proxy requests still require it. This is why the analyze button worked locally (no secret set) and via direct API (secret sent) but 401'd on Vercel (secret set, UI sends no secret header) until fixed.
- `applySettingsToForm()` in `public/app.js` must guard every write to a Settings-tab field with `if ($("..."))`, because those fields live in the React settings island and only exist in the DOM once that tab has mounted.

## Recent Changes

- 2026-06-24 -- Added the AI Project Insights roadmap and re-centered the `#insights` UI on project insight cards instead of delay-claim case management.
- 2026-06-24 -- Updated `projectInsights` to use AI synthesis when OpenRouter is configured, with deterministic fallback and evidence-backed output.
- 2026-06-24 -- Connected Project Insights to existing chat tools/agents and refreshed Workflow run history after analysis runs.
- 2026-06-24 -- Fixed Project Insights evidence extraction so runs do not fail with `terms.find is not a function`; bumped frontend asset version to force the browser to load the fix.
- 2026-06-24 -- Hardened AI insight synthesis JSON parsing and added OpenRouter `response_format` support for structured insight output.
- 2026-06-24 -- Added cumulative Project Insights expansion runs that skip previously scanned index sources and merge new cards into the visible report.
- 2026-06-24 -- Fixed expansion pagination failure where an encoded cursor was reused as an object and sent `undefined` as a timestamp filter to Supabase.
- 2026-06-24 -- Set the Project Insights default date range to 2024-02-01 through 2026-01-01 in HTML and initialization code.
- 2026-06-24 -- Added persisted Project Insights run history, selectable historical reports, and cumulative expansion continuation from selected runs.
- 2026-06-24 -- Fixed Project Insights focus-query scoring so non-exact phrasing still boosts related local signal matches.
- 2026-06-25 -- Split Project Insights output into findings and synthesized insights, updated UI/history expansion handling, and persisted findings in `project_insight_runs.metadata`.
- 2026-07-02 -- Added date-aware hashtag analytics to the Insights page, including Alerts/Index source toggle backed by KAPAIM `alerts` and `data_index` tables.
- 2026-07-02 -- Redesigned the Insights page UI/UX with chart controls, loading/empty states, keyboard shortcuts, collapsible evidence, and modern dark dashboard styling.
- 2026-07-02 -- Fixed content-source configuration gotchas by pinning `CONTENT_INDEX_TABLE=data_index` and trimming Supabase URL whitespace.
- 2026-07-02 -- Connected hashtag analytics into the Project Insights workflow with selected hashtag chips, automatic top-hashtag context, hybrid-search hashtag boosting, local evidence ranking boost, and AI payload/prompt support.
- 2026-07-02 -- Exposed the `project_insights` agent prompt for editing in Settings -> "סוכני AI" (added to `AGENT_DEFINITIONS`, read from config in the subagent, rendered as an agent card in the React settings island).
- 2026-07-02 -- Fixed the deployed "נתח את הפרויקט" button returning 401 on Vercel by routing `POST /api/insights/analyze` through `checkBidocSecretForRead` so same-origin UI requests skip the `BIDOC_API_SECRET` check.
- 2026-07-02 -- Fixed the hashtag chart not rendering (and date-change auto-refresh not firing) on a fresh load of `#insights`: `applySettingsToForm()` crashed on unguarded writes to Settings-only React-island fields, which aborted `init()` before the tab's own data loader ran. Guarded the writes.

## Gotchas

- Do not treat `docs/contractor-delay-claim-agents-roadmap.md` as the product direction for the Insights page. It is too claim-file oriented for the current requirement.
- Do not add more Supabase tables for Stage 1 insights unless explicitly requested; current persistence uses only `project_insight_runs`.
- Keep insight wording as observations and recommendations; avoid legal, entitlement, cost, or critical-path conclusions.
- Hashtag analytics must use the KAPAIM content Supabase project `smxibuaowzuxkznuouwj`, not the app Supabase project and not old `*_embeddings_gf_dor_agent` defaults.
- If the chart counts look wrong, first check `/api/settings` for `contentSource.supabaseUrl`, `contentSource.alertsTable`, and `contentSource.indexTable`.
- Hashtag influence is boost-only by default, not a hard filter; records still need textual signal matches before becoming findings.
- Any function that runs during `init()` (before a tab is opened) must not assume Settings-tab / React-island DOM elements exist. Landing directly on `#insights` via URL hash or hard reload will crash and silently abort the rest of `init()` if a settings field is written unguarded.
- Insights features can appear to "work locally but fail on Vercel" purely because `BIDOC_API_SECRET` is set on Vercel but not locally; check the secret gating before assuming a data/logic bug.
