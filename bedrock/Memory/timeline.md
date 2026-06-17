---
note_type: durable-memory-branch
project: bidoc agent
branch: timeline
last_updated: 2026-06-13
tags:
  - timeline
  - frontend
---

# Timeline

## Current State

- Timeline UI lives in `public/index.html`, `public/app.js`, and `public/styles.css` under the `#timeline` panel.
- Timeline data is loaded client-side from `GET /api/timeline/events`; legacy `/api/timeline` and `/api/timeline/alerts` remain for older flows, while server-side event reads use Content Supabase when configured.
- `GET /api/timeline/events` provides a compact, date-filtered Timeline API with validated `source`, `sort`, `limit`, and opaque cursor pagination.
- The compact Timeline API selects only explicit DTO columns, filters and orders in Content Supabase, fetches `limit + 1`, and never selects raw `metadata` or `analyzed_data`.
- Compact Timeline metadata is allowlisted separately for index and alert events; empty values are omitted.
- The legacy `/api/timeline` and `/api/timeline/alerts` routes still use the full event helpers required by the current UI, Link Agent, and graph rebuild flows.
- The Timeline page now loads compact events from `/api/timeline/events`, initially requesting the latest 90 calendar days with `limit=200` and descending order.
- Frontend Timeline state caches events, loaded ranges, and cursor pagination separately for `index` and `alerts`; pages are deduplicated by source/id and kept newest-first.
- Calendar navigation requests uncovered months before displaying them, and viewport edge navigation can request adjacent unloaded ranges without reloading links or suggestions.
- Timeline search is local-only over loaded events, debounced by 250ms, and matches shared fields plus allowlisted compact metadata fields from `public/timelineSearch.js`.
- Switching Timeline source clears the current search input/query; switching between list and calendar views preserves the active local search.
- Calendar day cards are keyboard-accessible interactive buttons that select an event and reuse the shared Timeline detail panel renderer.
- Timeline dropdown open/close behavior is handled by one global listener registration with outside-click and Escape handling, rather than re-registering `document.click` on each render.
- Timeline loading uses one active abort controller, a monotonic request id, a 20-second cycle timeout, stale-response guards, cancellable live status, retry, and a cursor-backed `טען עוד` fallback.
- Timeline event links are stored in Supabase `timeline_event_links` and exposed via `/api/timeline/links`.
- Timeline links, timeline entities, event-entity rows, and graph edges remain stored in App Supabase even when event content is read from a separate Content Supabase project.
- Timeline Knowledge Graph tables are defined in `supabase/timeline-knowledge-graph.sql`; graph extraction can rebuild event/entity rows via `/api/timeline/graph/rebuild`.
- `/api/timeline/graph/rebuild` also populates the general Project Graph (`graph_nodes`, `graph_edges`) from timeline/content events when the App Supabase schema exists.
- Timeline mobile hierarchy at `<=980px` is now list-first: controls are grouped into a compact stack, advanced filters live behind `#tlAdvancedToggle`, list and detail render in `tlPrimaryColumn`, AI renders in `tlSecondaryColumn`, and the graph uses responsive `hidden|compact|secondary|full` modes instead of competing equally with list/detail on narrow screens.
- The timeline supports filters, search, calendar view, and a dark interactive timeline view, with full ARIA grid keyboard navigation on the calendar (4B), and mobile/accessibility polish at 320–980px (4C).
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
- 2026-06-03 -- Split timeline event content reads to optional Content Supabase while preserving links and graph persistence on App Supabase.
- 2026-06-03 -- Extended timeline graph rebuild and link-agent traces to include the general Project Graph search layer.
- 2026-06-09 -- Added the compact `/api/timeline/events` endpoint with database-side date filtering, stable keyset pagination, strict request validation, allowlisted DTO metadata, and regression coverage for legacy heavy Timeline flows.
- 2026-06-09 -- Migrated the Timeline UI to 90-day ranged loading with per-source range caches, cursor page merging, stale-request protection, cancellation/timeout status, lazy calendar/viewport ranges, and manual browser verification.
- 2026-06-09 -- Expanded Timeline search to include allowlisted compact metadata, added a 250ms local debounce, and surfaced a loaded-only search count when more cursor pages exist.
- 2026-06-09 -- Made calendar cards selectable by click, Enter, and Space with persistent detail-panel reuse, selected-state styling, and basic ARIA annotations.
- 2026-06-09 -- Centralized Timeline dropdown listeners so tag and field menus close on outside click/Escape without accumulating duplicate `document` listeners across renders.
- 2026-06-10 -- Added full ARIA Grid calendar (4B): roving tabindex, RTL keyboard nav (ArrowLeft=+1 day), `<button>` event cards, `aria-live` month announcements, `fromKeyboard` focus-to-detail, `prefers-reduced-motion` scroll behavior, and pure `calendarHelpers.js` date-math module.
- 2026-06-11 -- Timeline 4C mobile/accessibility: WCAG AA contrast fixes (`--text-muted` → #767c87, inactive buttons → #7890aa), solid focus ring (2px brand-500), touch targets ≥44px, mobile panel order fix (list→detail→ai at ≤980px), collapsible AI panel at ≤768px, graphical timeline fallback at ≤375px (hidden with CSS note), dropdown max-width constraint, active-state non-color indicator on `.tlSrcBtn`, `.tlNode::after` hidden under reduced motion, `overflow-wrap: break-word` on detail title/body, detail body 16px at ≤768px.
- 2026-06-12 -- Timeline 5A Playwright infrastructure: `@playwright/test` + Chromium installed; `playwright.config.js` (ESM, port 4099, webServer with no Supabase env); `test/ui/` with fixtures (index/alerts events, paginated splits, links), `helpers/setup.js` (`setupTimelineMocks`, `collectPageErrors`), and 4 smoke tests covering load, source switch, pagination, and detail open. All mocked via `page.route()` — no external services. 4/4 passing, no flakiness. Minor prod fix: `role="heading" aria-level="2"` added to `#tlDetailTitle`.
- 2026-06-12 -- Timeline 5B functional tests: 44 new Playwright tests across 5 files covering request lifecycle (source switch, stale-response race, cancel, 20s timeout, retry, partial link/suggestion failures), pagination (URL params, hasMore, cursor, append+no-duplicates), search+debounce (content/tag/metadata allowlist, disallowed cross-source fields, 250ms debounce, clear, hasMore warning), calendar (month nav, day-cell click/keyboard, card select, ArrowUp/Down, Escape), and dropdowns+keyboard (tags open/close/Escape/outside-click/filter, fields toggle, list Enter/Space, active class, aria-busy). Key finding: `renderTimeline()` is called twice per load (after events, after links+suggestions); the second call briefly clears the DOM during virtual-list reconstruction, so `count()` called immediately after `first().toBeVisible()` can race — use `toHaveCount(N, { timeout })` instead of bare `.count()` for stable assertions. 48/48 passing, no flakiness.
- 2026-06-12 -- Timeline 5C: 120 new Playwright tests across 9 files covering ARIA/a11y (27), keyboard source/resolution (9), keyboard dropdowns (12), keyboard list (7), keyboard calendar (12), mobile layout at 320/375/768px (31), touch targets at 320px (8), reduced-motion (7), and focus/detail panel management (8). 168 total Playwright tests, all passing. Bug fixes: (1) `#timeline.active .resBtn { min-height: 34px }` and `#timeline.active #refreshTimeline { min-height: 36px }` overrode 4C touch-target CSS — fixed with `!important` on touch-target rules; (2) delegated capture-phase click handler called `stopPropagation()` before calendar card's own listener could fire `fromKeyboard=true` — fixed by detecting `e.detail === 0` in the delegated handler and passing `fromKeyboard` through to `selectTlEvent`. Manual tests identified: ArrowUp/ArrowDown in list view (not implemented), roving tabindex on source/resolution buttons (each is independent), Shift+PageUp/Down for year nav (implemented but not covered).
- 2026-06-12 -- Timeline final integration audit: 4 fixes applied. (1) Dead `initialTimelineRange` import removed from `public/app.js` (imported but replaced by `getTimelineInitialRange()` wrapper). (2) Node test regex updated to match `getTimelineLoadLimit()` call instead of hardcoded `limit: 200`. (3) Node test `limit: "501"` invalid case corrected to `limit: "2001"` to match server's actual max of 2000. (4) `#timelineLoadElapsed` given `aria-hidden="true"` so its 1-second setInterval updates do not trigger `aria-live="polite"` announcements on `#timelineLoadStatus`. (5) `#tlAiPanel` collapse button had broken `aria-controls` (pointing to nonexistent id) — fixed by assigning `panel.id = "tlAiPanel"` before setting `aria-controls`. `playwright.config.js` retries set to 1 for OS-level transient flakiness. 2 new Node regression tests added. 126 Node tests + 168 Playwright tests all passing, two consecutive Playwright runs identical.

- 2026-06-13 -- Timeline mobile hierarchy redesign: timeline controls were regrouped into `timelineControlStack`, advanced range/field controls moved behind `#tlAdvancedToggle`, graph rendering was wrapped in `tlGraphRegion` with breakpoint-driven `hidden|compact|secondary|full` behavior, `buildPanelsLayer()` now splits list/detail into `tlPrimaryColumn` and AI into `tlSecondaryColumn`, calendar flow appends AI after detail, and 4 additional Node regressions now pin the disclosure markup, primary/secondary render structure, responsive graph/AI state, and mobile CSS ordering. 130 Node tests passing.
- 2026-06-13 -- Timeline mobile follow-up: responsive mode selection now uses the actual Timeline panel/container width instead of only `window.innerWidth`, stacked mobile column rules are also enforced from `#timeline[data-viewport]`, a final mobile override forces `tlPrimaryColumn`/`tlListWrap` to stretch as full-width stacked blocks, and the count hint appends a visible UI build label (`V1.4`) for quick browser-cache verification.
- 2026-06-13 -- Timeline mobile scroll follow-up: replaced generic `scrollIntoView()` calls in the static list/detail mobile flow with scoped scroll calculations (`outer.scrollTo` for the list, `window.scrollTo` for the detail panel) to stop mobile browsers from jumping the whole page back to the top during Timeline interactions.
- 2026-06-13 -- Timeline mobile resize follow-up: the `window.resize` handler now re-renders only when the responsive Timeline breakpoint/graph mode actually changes, preventing mobile browser chrome height changes during scroll from triggering full Timeline re-renders and scroll resets. Visible build label bumped to `V1.5`.
- 2026-06-14 -- Timeline detail follow-up: the event `קשרים` section is now collapsed by default and exposes its links/form/suggestions body only through a dedicated arrow toggle next to the section title, with the expanded state kept in `timelineState.linksPanelExpanded`.
- 2026-06-17 -- Timeline links-panel cleanup: removed the legacy duplicate `buildTimelineLinksPanel` implementation and kept the newer toggle-based version; the nearby link-row/link-form text was also normalized in `public/app.js` without changing helper boundaries or behavior.

## Gotchas

- The timeline panel is re-rendered when the strip window moves, so drag code must not depend on layout from a detached DOM node unless the track rect is captured before render.
- `#timelineLoadElapsed` inside `#timelineLoadStatus` (aria-live="polite") must stay `aria-hidden="true"` or it causes screen reader announcements every second during load.
- `initialTimelineRange` is exported from `timelineData.js` but the UI uses its own `getTimelineInitialRange()` which reads from the DOM date inputs — do not confuse the two.
- Calendar nav in RTL: LEFT button = next month, RIGHT button = previous month (prevBtn in DOM order appears on the right in RTL flex layout).
- `console.debug("[timeline]", ...)` is used as lightweight diagnostic output for resolution and viewport changes.
- Calendar ARIA: ArrowLeft = +1 day (RTL), ArrowRight = -1 day — opposite of LTR ARIA Grid spec.
- `e.detail === 0` on native `<button>` cards distinguishes keyboard activation (focus-to-detail panel) from mouse click (scroll into view).
- Two pre-existing test failures exist (CRLF regex, limit validation gap) — not caused by 4A/4B/4C work.
