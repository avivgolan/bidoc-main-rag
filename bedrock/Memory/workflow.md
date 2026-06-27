---
note_type: durable-memory-branch
project: bidoc agent
branch: workflow
last_updated: 2026-06-23
tags:
  - workflow
  - frontend
  - qa
---

# Workflow

## Current State

- Workflow UI lives in `public/index.html`, `public/app.js`, and `public/styles.css` under the `#workflow` panel.
- Run selection is handled by the run history strip from `/api/run-history`; selecting a run sets `state.lastWorkflow` and re-renders the workflow canvas.
- The workflow canvas uses Cytoscape in `renderWorkflow()`, with dagre layout when available and breadthfirst fallback if dagre is unavailable.
- Workflow MVP node cards render directly in the canvas as larger Cytoscape round-rectangle cards sized for readable inspection.
- Each node-card label includes node kind, label, id, status, Duration, Input preview, Output preview, Tokens, Cost, Calls, and an inline error line when available.
- Duration, Tokens, and Cost are derived from per-node `openrouter` telemetry when present; unavailable values are shown as `—` rather than inferred.
- `workflowCardsExpanded` controls expanded/collapsed node-card display, exposed through the `#toggleWorkflowCards` button.
- `#fitWorkflow` calls `fitWorkflowToScreen()` to center and fit the current workflow.
- Initial workflow render uses `focusWorkflowStart()` instead of full-run fit so long workflows do not open as unreadable thumbnails.
- `fitWorkflowToScreen()` enforces a readable minimum zoom before focusing the start of the workflow.
- Stage 2 QA Inspector controls live in `#workflowToolbar`: text search, status filter, Errors, Slow, Cost, Fit, Collapse, and Reset.
- Workflow filters dim non-matching nodes/edges rather than deleting them, preserving route context while highlighting matches.
- Clicking an edge opens an edge inspector showing source output, target input, mapping summary, and raw edge JSON.
- The node inspector now includes metrics, node-specific logs, source rendering when source-like objects are present, and masked Raw JSON.
- Fallback visualization detects fallback from trace/run events and structured payloads, colors fallback nodes/edges orange, adds a Fallback toolbar filter, and shows an inspector notice.
- Stage 3 compare basics are available from the run history strip: each saved run has Base and Compare selectors, a Compare summary banner, Clear Compare control, and graph-level Added/Changed/Same node markers.
- Compare mode fingerprints node status, input, output, and OpenRouter call metadata; route differences are counted from workflow edge keys and new compare edges are highlighted.
- The node inspector shows a Compare notice with status, duration, and token deltas when a compared node is selected.
- Stage 3 payload diff now appears in the node inspector during Compare mode, showing Input and Output changed fields plus Base/Compare payload panels.
- Stage 3 route diff now tracks added and removed workflow edges, summarizes route changes in the Compare banner, styles added/removed routes on the graph when both endpoints are visible, and shows route details in the Edge inspector.
- Stage 3 performance diff now compares duration, token totals, and known cost between Base and Compare at the run summary level and in each comparable node inspector.
- Stage 3 regression indicators flag new errors, new fallback usage, slower/costlier/token-heavy nodes, removed nodes, removed routes, and run-level slowdown; regressions can be filtered from the toolbar and are surfaced in the Compare banner and node inspector.
- Workflow node cards now label Input/Output payload provenance as captured, details, or not captured; nodeDetails are used when a workflow node lacks direct input/output fields.
- Preview text masks obvious sensitive keys, bearer tokens, secrets, passwords, and authorization values before rendering.
- The side inspector still shows full Input/Output details and per-node OpenRouter call details for the selected node.

## Recent Changes

- 2026-06-25 -- Captured QA Agent Phase 0 baseline in `docs/qa-agent-full-run-audit-plan.md` using disliked message `1255`; current QA report identifies incomplete Main output but lacks full per-agent audit, telemetry use, and pipeline timeline.
- 2026-06-25 -- Approved QA Agent Phase 1 report contract: keep compact QA fields, add `agent_audit`, `pipeline_timeline`, retrieval/grounding/cost reviews, bounded evidence, internal-only telemetry, and per-agent decision quality.
- 2026-06-25 -- Implemented QA Agent Phase 2 deterministic `qa_run_summary` builder in `src/qaSummary.js`, wired it into `runQaAgent()`, and added tests for node coverage, metrics, retrieval evidence, truncation, missing logs, and secret masking.
- 2026-06-25 -- Tightened QA Agent phase-gate rule: every remaining phase must record explicit tests or measurements, pass/fail results, known unrelated failures, and a proceed/repeat/fix decision before moving on.
- 2026-06-25 -- Completed QA Agent Phase 3 prompt/runtime update: full-audit prompt now uses `qa_run_summary`, compact step summaries avoid raw JSON copying, QA full-audit output enforces a 6000-token floor, and live message `1255` returned valid JSON with 17 `agent_audit` and 17 timeline entries.
- 2026-06-25 -- Added early QA UI rendering slice: QA cards now use `qaReportHtmlFull()` to show compact fields plus `Full QA Audit`, `Agent Audit`, `Pipeline Timeline`, retrieval/grounding/cost reviews, and bounded `Raw QA JSON` when those fields exist.
- 2026-06-27 -- Hardened Professional Knowledge Planner JSON behavior after Gemini 2.5 Pro returned non-JSON on a methodology test: Planner OpenRouter calls now request `response_format: json_object`, retry one schema-only repair before fallback, and mark recovered plans with `planner_json_repaired`.
- 2026-06-27 -- Closed the Planner calibration gate with four UI routing checks: professional delay, blocker methodology, normal greeting, and invoice/status. Added the next reranker validation gate to `docs/qa-agent-full-run-audit-plan.md`.
- 2026-06-27 -- Added boss-facing calibration progress log to `docs/rag-model-calibration-plan.md`, covering QA as calibration tooling, Planner model/runtime calibration, downstream Main/Reranker cost findings, and the next reranker test gate.
- 2026-06-23 -- Implemented Workflow QA MVP node-card canvas display with Input/Output previews, OpenRouter-derived metrics, error preview, fit-to-screen, collapse/expand control, and a focused Node regression test.
- 2026-06-23 -- Adjusted Workflow MVP canvas readability after browser review: larger cards/text, start-of-run focus on render, and minimum readable zoom for Fit.
- 2026-06-23 -- Added Stage 2 QA Inspector basics: toolbar search/status/errors/slow/cost filters, edge payload inspector, node logs, source rendering, masked Raw JSON, and regression coverage.
- 2026-06-23 -- Completed Stage 2 fallback visualization with fallback detection, toolbar filtering, orange node/edge styling, card marker text, inspector notice, and regression coverage.
- 2026-06-23 -- Added Stage 3 compare-run basics: Base/Compare history selectors, compare summary banner, node/edge diff styling, inspector compare notice, and regression coverage.
- 2026-06-23 -- Added Stage 3 payload diff inside the node inspector with changed/added/removed field rows and side-by-side Base/Compare payload previews.
- 2026-06-23 -- Added Stage 3 route diff with added/removed edge tracking, Compare banner route snippets, graph styling for changed routes, and Edge inspector route diff details.
- 2026-06-23 -- Added Stage 3 performance diff with run-level duration/tokens/cost deltas and per-node Base-to-Compare metric details.
- 2026-06-23 -- Completed Stage 3 regression indicators with regression counting, toolbar filtering, graph highlighting, Compare banner chips, and node inspector explanations.
- 2026-06-24 -- Fixed Workflow Input/Output display provenance: removed misleading fallback payloads, hydrate missing node payloads from nodeDetails/run events, and show whether payloads are captured/details/not captured.

## Gotchas

- Non-AI nodes generally do not have per-node duration telemetry yet; the UI intentionally displays `Duration —` for those nodes.
- Workflow Input/Output is a QA log payload, not always a full automatic runtime capture; if a node lacks direct input/output, the UI now shows nodeDetails-derived data or `not captured`.
- The local dev server starts with empty in-memory run history unless a chat/link-agent run has happened in that server session or persisted rows are available.
- Existing full Node test runs currently fail on unrelated Timeline mobile assertions that expect `wireTimelineGraphTouch`, `wireTimelineDetailSwipe`, and phone-narrow compact graph behavior; the Workflow MVP regression itself passes before those failures.
