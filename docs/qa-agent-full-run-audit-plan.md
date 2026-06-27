# QA Agent Full Run Audit Plan

Date: 2026-06-24

Status: planning document only. Do not change runtime code, prompts, models, or settings until a phase is approved.

## Goal

Improve the QA Agent from a short failure-summary tool into an internal full-run auditor.

The improved QA Agent should explain what happened in the system for every relevant agent and pipeline step:

- What input each step received.
- What output each step produced.
- Which model and settings were used.
- Whether the decision/output was good, questionable, or wrong.
- What evidence supports the diagnosis.
- What cost, token, latency, or context-size signals were visible.
- What exact fix is recommended when a step behaved poorly.

This is an administrator/debug feature. It must not expose internal prompts, model names, routing, telemetry, or workflow architecture in customer-facing chat answers.

## Current Baseline

Current QA behavior:

- `runQaAgent()` receives `user_message`, `ai_response`, full `workflow_log`, and optional `user_feedback`.
- The QA report is constrained to `summary`, `root_cause_steps`, `step_issues`, `recommendations`, `answer_quality`, and `confidence`.
- The workflow log already includes nodes, edges, active prompts, traces, and normal chat OpenRouter telemetry.
- The QA Agent does not yet receive a normalized agent-by-agent audit sheet.
- The QA Agent does not capture telemetry for its own OpenRouter call.
- The UI renders only a compact QA summary, not a full per-agent audit.

Reference map:

- `docs/qa-agent-calibration-map.md`

## Working Rules

1. Work one phase at a time.
2. Do not combine phases.
3. After each phase:
   - implement only that phase,
   - run targeted tests,
   - run one manual QA report when relevant,
   - document what changed,
   - stop for review before the next phase.
4. Keep all QA details internal/admin-only.
5. Prefer deterministic backend summaries over asking the model to infer everything from raw logs.
6. Do not change the QA model until the structured QA inputs and outputs are stable.
7. Every phase must end with explicit tests or measurements. Do not move to the next phase until the phase-exit checks are recorded with pass/fail status and any known unrelated failures are separated from phase failures.

## Phase Exit Evidence Standard

Every phase result section must include:

- Commands or manual actions run.
- Exact pass/fail result.
- The measured values when relevant.
- Screenshots or UI observations when the phase touches UI.
- Known unrelated failures, clearly separated.
- A short decision: proceed, repeat, or fix before continuing.

---

# Phase 0: Baseline Capture

## Goal

Capture what the QA Agent can do today before changing it.

## Steps

1. Pick one recent completed RAG message with `workflow_log`.
2. If possible, use a message that was disliked or manually add a QA feedback note.
3. Run the current QA report from the QA tab or `/api/qa/:messageId/run`.
4. Save the baseline observations in this document under `Phase 0 Results`.
5. Record:
   - message id,
   - user question,
   - final answer summary,
   - QA model,
   - QA prompt source,
   - QA max tokens / temperature / timeout,
   - workflow log character size,
   - whether `workflowLog.openRouterUsage` exists,
   - whether the QA report identified concrete steps,
   - whether recommendations were specific or generic,
   - whether the report missed any visible pipeline behavior.

## Tests

- No automated code test required.
- Manual check: current QA report renders in the QA UI.
- Measurement: record workflow log size, node count, available OpenRouter totals, QA model/settings, and whether the report names concrete steps.
- Pass criteria:
  - A real message with `workflow_log` is selected.
  - Current QA runs successfully.
  - The baseline report is saved or copied into this plan.
  - At least three missing QA capabilities are identified from the real example.

## Gate

Proceed only after we agree on the current shortcomings from a real example.

---

# Phase 1: Define The Full QA Report Contract

## Goal

Expand the QA output schema so it can describe every agent, not only root causes.

## Proposed Output Shape

Add these fields while keeping the existing fields for compatibility:

```json
{
  "summary": "string",
  "root_cause_steps": ["step_id"],
  "overall_severity": "high | medium | low",
  "answer_quality": "irrelevant | hallucinated | incomplete | wrong_sources | acceptable",
  "confidence": "high | medium | low",
  "agent_audit": [
    {
      "step": "step_id",
      "label": "string",
      "status": "done | skipped | error",
      "mission": "string",
      "what_happened": "string",
      "input_summary": "string",
      "output_summary": "string",
      "decision_quality": "good | questionable | bad | not_applicable",
      "evidence": ["string"],
      "metrics": {
        "model": "string or null",
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cost": 0,
        "duration_ms": 0
      },
      "issue": "string or null",
      "recommended_fix": "string or null"
    }
  ],
  "pipeline_timeline": [
    {
      "step": "step_id",
      "status": "done | skipped | error",
      "short_result": "string"
    }
  ],
  "retrieval_review": {
    "coverage": "good | partial | poor | not_applicable",
    "top_evidence": ["string"],
    "missing_evidence": ["string"],
    "reranker_observations": ["string"]
  },
  "grounding_review": {
    "supported_claims": ["string"],
    "unsupported_or_weak_claims": ["string"],
    "citation_issues": ["string"],
    "missing_answer_parts": ["string"]
  },
  "cost_review": {
    "total_tokens": 0,
    "total_cost": 0,
    "expensive_steps": ["step_id"],
    "notes": ["string"]
  },
  "step_issues": [
    {
      "step": "step_id",
      "label": "string",
      "issue": "string",
      "severity": "high | medium | low"
    }
  ],
  "recommendations": ["string"]
}
```

## Steps

1. Decide which fields are required and which are optional.
2. Decide whether `agent_audit` should include skipped steps.
3. Decide how much prompt text the QA Agent may inspect.
4. Decide how much evidence text each audit item may include.
5. Update only the plan after review; no runtime code yet.

## Tests

- Schema review only.
- Pass criteria:
  - Required top-level fields are listed.
  - Required `agent_audit` fields are listed.
  - Enums are listed.
  - Skipped-step policy is defined.
  - Prompt/evidence visibility limits are defined.
  - Internal-only telemetry rule is defined.

## Gate

Proceed only after the output contract is approved.

## Phase 1 Results

Completed: 2026-06-25.

Phase 1 defines the target report contract. No runtime code, prompt, model, or settings changes were made.

### Contract Decisions

| Decision | Approved policy |
| --- | --- |
| Backward compatibility | Keep the existing compact QA fields so old UI/report consumers continue to work. |
| New core field | Add `agent_audit` as the primary full-run audit list. |
| Skipped steps | Include skipped steps when they are part of the workflow route or explain why something did not happen. Use `decision_quality: "not_applicable"` unless the skip itself is suspicious. |
| Prompt visibility | The QA Agent may receive prompt names, hashes, short excerpts, or specific relevant lines. It should not receive full prompts by default. |
| Evidence visibility | The QA Agent may receive bounded evidence snippets, source titles, URLs, ranks, scores, and rerank reasons. It should not receive full raw retrieval rows by default. |
| Cost visibility | Include run-level and per-agent token/cost/latency metrics when available. Keep this internal/admin-only. |
| Customer visibility | Full QA reports remain internal. Do not expose `agent_audit`, prompts, model names, tokens, cost, or routing details in customer chat. |
| Language | Human-readable strings should use the original user's language. Technical step IDs and field names remain unchanged. |

### Required Top-Level Fields

These fields must exist in every normalized QA report:

- `summary`
- `root_cause_steps`
- `overall_severity`
- `answer_quality`
- `confidence`
- `agent_audit`
- `pipeline_timeline`
- `retrieval_review`
- `grounding_review`
- `cost_review`
- `step_issues`
- `recommendations`

Existing compact reports that do not have the new fields will be normalized later in Phase 4 by filling defaults.

### Required Agent Audit Fields

Each `agent_audit` item must contain:

- `step`
- `label`
- `status`
- `mission`
- `what_happened`
- `input_summary`
- `output_summary`
- `decision_quality`
- `evidence`
- `metrics`
- `issue`
- `recommended_fix`

### Enums

Use only these values:

| Field | Values |
| --- | --- |
| `overall_severity` | `high`, `medium`, `low` |
| `answer_quality` | `irrelevant`, `hallucinated`, `incomplete`, `wrong_sources`, `acceptable` |
| `confidence` | `high`, `medium`, `low` |
| `agent_audit[].status` | `done`, `skipped`, `error` |
| `agent_audit[].decision_quality` | `good`, `questionable`, `bad`, `not_applicable` |
| `retrieval_review.coverage` | `good`, `partial`, `poor`, `not_applicable` |

### Evidence And Text Bounds

These limits should guide Phase 2 and Phase 4 implementation:

| Field | Limit |
| --- | ---: |
| `summary` | 1200 characters |
| `agent_audit[].what_happened` | 1200 characters |
| `agent_audit[].input_summary` | 1000 characters |
| `agent_audit[].output_summary` | 1200 characters |
| `agent_audit[].evidence[]` | 500 characters per item, max 6 items |
| `agent_audit[].issue` | 1000 characters |
| `agent_audit[].recommended_fix` | 1000 characters |
| `pipeline_timeline[]` | max 30 items |
| `retrieval_review.top_evidence[]` | 700 characters per item, max 10 items |
| `grounding_review.supported_claims[]` | 700 characters per item, max 10 items |
| `recommendations[]` | 700 characters per item, target 3-8 items |

### Metrics Object

Each `agent_audit[].metrics` object should use this shape:

```json
{
  "model": "string or null",
  "prompt_tokens": 0,
  "completion_tokens": 0,
  "total_tokens": 0,
  "cost": 0,
  "duration_ms": 0,
  "generation_id": "string or null"
}
```

Missing numeric metrics should normalize to `null`, not `0`, when zero would be misleading.

### Agent Audit Coverage

When present in the workflow log, these steps should normally appear in `agent_audit`:

- `classifier`
- `knowledge_vocabulary`
- `memory`
- `switch`
- `lite_agent`
- `investigation`
- `knowledge_planner`
- `hybrid_search`
- `graph_search`
- `reranker`
- `alert_agent`
- `n8n_tools`
- `source_quality`
- `conflict_detection`
- `main_agent`
- `update_message`

Low-level technical nodes such as `chat_input`, `sanitize`, and `save_message` may be included in `pipeline_timeline`, but only need `agent_audit` entries when they caused or explain a failure.

### Phase 1 Gate Result

Approved to proceed to Phase 2: build the deterministic `qa_run_summary` input object.

---

# Phase 2: Build Deterministic QA Run Summary

## Goal

Create a backend `qa_run_summary` object before calling the QA model.

The model should receive a clear per-agent audit input instead of having to infer everything from raw `workflow_log`.

## Steps

1. Add a helper, likely in `src/qaAgent.js` or a new `src/qaSummary.js`.
2. Input:
   - `userMessage`,
   - `aiResponse`,
   - `workflowLog`,
   - `userFeedback`.
3. Output:
   - `run_overview`,
   - `agent_steps`,
   - `retrieval_evidence`,
   - `grounding_inputs`,
   - `openrouter_usage`,
   - `errors_and_fallbacks`,
   - `source_and_citation_signals`.
4. Normalize these steps when present:
   - `classifier`,
   - `knowledge_vocabulary`,
   - `lite_agent`,
   - `knowledge_planner`,
   - `hybrid_search`,
   - `graph_search`,
   - `reranker`,
   - `alert_agent`,
   - `n8n_tools`,
   - `source_quality`,
   - `conflict_detection`,
   - `main_agent`,
   - `update_message`.
5. Preserve useful evidence:
   - top reranked chunks,
   - source URLs,
   - rerank reasons,
   - classifier flags,
   - planner queries,
   - answer mode,
   - tool statuses,
   - conflicts,
   - token/cost/latency summaries.
6. Bound large fields:
   - no full prompt dumps by default,
   - no full retrieval rows,
   - no unbounded trace,
   - no large raw tool results.

## Tests

Add unit tests for:

- summary includes every workflow node,
- OpenRouter usage is attached to the matching step,
- top reranker chunks are preserved,
- oversized text is truncated,
- missing nodes do not crash the summary builder,
- customer secrets/API keys are not included.

Required phase-exit checks:

- Run targeted QA summary check with synthetic workflow input.
- Run `npm.cmd test` and record whether the new QA summary tests pass.
- Pass criteria:
  - `qa_run_summary.agent_steps` includes every workflow node in the synthetic case.
  - Per-node OpenRouter metrics attach to the correct steps.
  - Reranker top chunks, source URLs, and rerank reasons are preserved.
  - Long evidence is truncated.
  - Missing workflow logs return empty safe defaults.
  - API keys, bearer tokens, service-role keys, and secret-like values do not appear in serialized summary output.

## Gate

Proceed only after the summary object gives enough per-agent detail without becoming huge.

## Phase 2 Results

Completed: 2026-06-25.

### Implemented

- Added `src/qaSummary.js`.
- Added `buildQaRunSummary({ userMessage, aiResponse, workflowLog, userFeedback })`.
- Wired `runQaAgent()` to include `qa_run_summary` in the model payload while preserving the existing `workflow_log` field for backward compatibility.
- Added focused unit coverage in `test/run-tests.js`.

### Summary Object Shape

The deterministic summary now includes:

- `run_overview`
- `agent_steps`
- `retrieval_evidence`
- `grounding_inputs`
- `openrouter_usage`
- `errors_and_fallbacks`
- `source_and_citation_signals`
- `prompt_inventory`

### Preserved Signals

The summary preserves:

- every workflow node as a normalized `agent_steps` entry,
- node status, kind, label, mission, input summary, output summary,
- per-node OpenRouter model, tokens, cost, latency, and generation id when present,
- reranker top chunks, ranks, scores, reasons, URLs, and bounded text,
- Hybrid Search sample records,
- Graph Search sample relationships,
- Main answer mode, retrieval counts, source count, answer preview, and citations,
- errors and fallback signals from nodes and trace,
- active prompt keys, prompt character counts, hashes, and short previews.

### Bounds And Safety

- Long text is truncated before entering the summary.
- Prompt inventory uses hashes and short previews, not full prompt bodies.
- Retrieval/tool evidence is represented as bounded snippets and samples.
- Sensitive keys and values such as API keys, service-role keys, bearer tokens, secrets, passwords, and authorization values are redacted.

### Tests

Targeted check:

```text
qa summary targeted check passed
```

Full suite:

```text
npm.cmd test
```

Result:

- New QA summary tests passed:
  - `QA run summary includes nodes metrics retrieval evidence and masks secrets`
  - `QA run summary handles missing workflow nodes`
- The full suite later failed on unrelated existing UI/source assertions:
  - `workflow UI exposes OpenRouter usage totals and per-node call details`
  - timeline mobile touch/swipe assertions expecting `wireTimelineGraphTouch` and `wireTimelineDetailSwipe`

These failures are outside the Phase 2 QA summary change.

### Phase 2 Gate Result

Approved to proceed to Phase 3: update the QA prompt to use the structured summary and request the full audit report contract.

---

# Phase 3: Update QA Prompt To Use The Structured Summary

## Goal

Change the QA prompt so the model produces a full run audit, not only a failure report.

## Steps

1. Update `QA_SYSTEM_PROMPT` or the configured default QA prompt.
2. Tell the model:
   - analyze every `agent_steps` item,
   - explain what happened,
   - distinguish good behavior from questionable behavior,
   - identify visible root causes only,
   - use concrete step IDs, fields, chunks, counts, and model telemetry,
   - avoid inventing missing documents or tools,
   - avoid recommending stronger models unless evidence supports it.
3. Keep existing QA fields for backward UI compatibility.
4. Add the new `agent_audit`, `pipeline_timeline`, `retrieval_review`, `grounding_review`, and `cost_review` fields.
5. Use the user's language for human-readable values.

## Tests

- Unit test that the prompt contains the required schema keys.
- Manual QA run on the Phase 0 baseline message.
- Verify the model returns valid JSON with `agent_audit`.
- Measure:
  - `agent_audit.length`,
  - number of workflow steps represented,
  - whether `cost_review.total_tokens` matches or references workflow telemetry,
  - whether retrieval, grounding, and cost reviews are present.
- Pass criteria:
  - Existing compact fields still exist.
  - New fields are present.
  - At least `classifier`, `hybrid_search`, `reranker`, and `main_agent` appear in `agent_audit` for a RAG run.
  - The QA report mentions the expensive baseline token/cost signal when visible.
  - The report does not invent steps that are absent from the workflow log.

## Gate

Proceed only after one real QA report gives useful per-agent detail.

## Phase 3 Results

### Implemented

- Updated the default QA prompt in `src/prompts.js`.
- Updated the QA fallback prompt in `src/qaAgent.js`.
- The prompt now explicitly uses `qa_run_summary` as the primary audit input and keeps `workflow_log` as backup detail.
- The prompt preserves the existing compact QA fields and requires the new full audit fields:
  - `agent_audit`
  - `pipeline_timeline`
  - `retrieval_review`
  - `grounding_review`
  - `cost_review`
- Added prompt rules for skipped optional tools, visible-data-only diagnosis, internal/admin-only reporting, and user-language human-readable values.
- Tightened `qa_run_summary.agent_steps[*].input_summary` and `output_summary` so they no longer serialize raw JSON-like object strings into the QA model input.
- Added `QA_FULL_AUDIT_MIN_TOKENS = 6000` in `src/qaAgent.js` and enforce it at runtime for full audit reports.
- Raised the default QA max token budget to `6000` in `src/config.js` and aligned the built-in presets.

### Why The Token Floor Was Needed

The first live Phase 3 attempts used the persisted QA setting:

```text
qa.maxTokens = 3000
```

Those runs failed because the model response was truncated before valid JSON completed:

```text
SyntaxError: Unterminated string in JSON
SyntaxError: Expected ',' or ']' after array element in JSON
```

After compacting step summaries and using a 6000-token output budget, the same baseline run returned valid full-audit JSON.

### Tests And Measurements

Targeted local check:

```text
qa phase 3 targeted checks passed
```

This verified:

- both QA prompts include `qa_run_summary`,
- both QA prompts include all new report sections,
- both QA prompts include the raw-JSON-copy prevention rule,
- compact step summaries no longer start as serialized JSON,
- `QA_FULL_AUDIT_MIN_TOKENS` is `6000`.

Full test command:

```text
npm.cmd test
```

Phase 3 tests passed:

- `QA prompts require Hebrew reports and evidence-based optional tool diagnosis`
- `QA prompts require structured full-run audit contract`
- `QA agent uses a full-audit output token floor`
- `QA run summary includes nodes metrics retrieval evidence and masks secrets`
- `QA run summary handles missing workflow nodes`

Known unrelated failures remain:

- `workflow UI exposes OpenRouter usage totals and per-node call details`
- `timeline mobile graph supports pan pinch and long-press card scrubbing without detail jumps`
- `timeline mobile detail supports horizontal swipe navigation`

These are the same unrelated UI/source assertions seen before Phase 3.

### Live Baseline QA Run

Baseline message:

```text
1255
```

Runtime:

```text
qaModel: openai/gpt-4o
persistedQaMaxTokens: 3000
runtimeMinTokens: 6000
```

Result:

```json
{
  "missingRequiredFields": [],
  "agentAuditLength": 17,
  "timelineLength": 17,
  "retrievalCoverage": "partial",
  "groundingFaithfulness": "partial",
  "totalTokens": 185967,
  "totalCostUsd": 0.25167648,
  "answerQuality": "incomplete",
  "confidence": "medium",
  "rootCauseSteps": ["knowledge_planner"]
}
```

Agent steps represented:

```text
chat_input, sanitize, save_message, classifier, knowledge_vocabulary, memory, switch, investigation, knowledge_planner, hybrid_search, graph_search, reranker, n8n_tools, source_quality, conflict_detection, main_agent, update_message
```

The report was saved back to the QA report field for message `1255`.

### Phase 3 Gate Result

Approved to proceed to Phase 4: validate and normalize QA output.

Important Phase 4 note: even though Phase 3 now returns valid JSON on the baseline run, Phase 4 should still replace broad regex parsing with a safer JSON extraction/normalization layer because live model output can still occasionally be malformed or missing optional fields.

---

# Phase 4: Validate And Normalize QA Output

## Goal

Make QA output robust before showing richer reports in the UI.

## Steps

1. Replace broad regex parsing with `extractJsonObject()` from `src/openrouter.js`.
2. Add `normalizeQaReport()`:
   - fill missing arrays,
   - clamp invalid enum values,
   - normalize `agent_audit`,
   - preserve existing fields,
   - limit very long strings,
   - reject unrecoverable reports with a clear error.
3. Save normalized reports, not raw model JSON.

## Tests

Add unit tests for:

- valid full report passes,
- old compact report still passes,
- invalid severity is normalized,
- missing `agent_audit` becomes `[]`,
- malformed JSON throws a clear error.

Required phase-exit checks:

- Run old compact QA fixture through normalization.
- Run full audit QA fixture through normalization.
- Run malformed output fixture.
- Pass criteria:
  - Old compact reports still render/save.
  - Full audit reports keep all new sections.
  - Invalid enum values are clamped or normalized.
  - Unrecoverable JSON fails with a clear error message.

## Gate

Proceed only after old and new QA reports are both supported.

---

# Phase 5: Capture QA Agent Telemetry

## Goal

Record the QA Agent's own model usage internally.

## Steps

1. Add telemetry support to `runQaAgent()`.
2. Add telemetry support to `runQaTrendAnalysis()`.
3. Persist telemetry with saved QA reports as admin/debug metadata.
4. Include:
   - requested model,
   - actual model,
   - generation id,
   - prompt tokens,
   - completion tokens,
   - total tokens,
   - cost when available,
   - latency,
   - finish reason.
5. Do not add this telemetry to customer-facing chat responses.

## Tests

- Unit test telemetry object shape with mocked `chatCompletion`.
- Manual QA run verifies telemetry is saved or returned internally.
- Measure:
  - QA model,
  - prompt tokens,
  - completion tokens,
  - total tokens,
  - cost,
  - duration,
  - generation id.
- Pass criteria:
  - QA report includes internal telemetry when OpenRouter returns usage.
  - Telemetry is not added to customer-facing chat responses.
  - QA Trend telemetry is captured or a documented reason exists if deferred.

## Gate

Proceed only after QA cost can be inspected internally.

---

# Phase 6: Render Full QA Report In The UI

## Goal

Make the richer QA output usable.

## Steps

1. Update QA report rendering in `public/app.js`.
2. Preserve existing compact summary display.
3. Add sections:
   - Pipeline timeline,
   - Agent audit,
   - Retrieval review,
   - Grounding/citation review,
   - Cost review,
   - Recommendations.
4. Use collapsible sections for long agent details.
5. Keep the copied report text useful and complete.
6. Avoid exposing these sections in customer chat.

## Tests

- Unit/source tests for expected render functions or HTML markers.
- Manual browser check:
   - old compact reports still render,
   - new full reports render,
   - long evidence does not break layout,
   - copy report includes full audit.
- Measure:
  - all full-report sections are visible or collapsible,
  - copy text includes `agent_audit`, retrieval review, grounding review, and cost review,
  - old report fixture has no blank/error sections.
- Pass criteria:
  - Old compact report UI still works.
  - New full report UI shows per-agent audit.
  - Long text is bounded and does not overflow.
  - No internal QA report appears in customer chat.

## Gate

Proceed only after the UI makes the new report easy to inspect.

## Early UI Slice Results

This UI slice was moved earlier because manual validation showed that the QA card still exposed only the old compact report fields.

### Implemented

- Updated `public/app.js` so `renderQaReport()` now uses `qaReportHtmlFull()`.
- Updated the Workflow tab AI Report panel so `renderWorkflowAiReport()` also uses `qaReportHtmlFull()`.
- Preserved the existing compact QA fields in the same card:
  - summary,
  - severity,
  - answer quality,
  - confidence,
  - root cause steps,
  - step findings,
  - recommendations.
- Added visible full-audit sections when the saved report contains them:
  - `Full QA Audit`,
  - `Agent Audit`,
  - `Pipeline Timeline`,
  - `Retrieval Review`,
  - `Grounding Review`,
  - `Cost Review`,
  - `Raw QA JSON`.
- Added styling in `public/styles.css` for audit stats, per-agent cards, timeline rows, review grids, and bounded raw JSON.

### Tests And Measurements

Targeted syntax check:

```text
node --check public\app.js
```

Result: pass.

Targeted source check:

```text
qa full audit ui source check passed
```

Local server check:

```text
served app.js contains full QA audit UI markers
```

Full test command:

```text
npm.cmd test
```

New QA UI test passed:

```text
QA UI renders full audit fields alongside compact report
```

Known unrelated failures remain:

- `workflow UI exposes OpenRouter usage totals and per-node call details`
- `timeline mobile graph supports pan pinch and long-press card scrubbing without detail jumps`
- `timeline mobile detail supports horizontal swipe navigation`

### User UI Check

Refresh `localhost:4000`, open or rerun a QA report generated after Phase 3, and verify the QA card now includes:

- `Full QA Audit`
- `Agent Audit`
- `Pipeline Timeline`
- `Retrieval Review`
- `Grounding Review`
- `Cost Review`
- `Raw QA JSON`

Old compact reports that do not contain the new fields should still render without empty full-audit sections.

---

# Phase 7: Add Main Payload Diagnostics For QA

## Goal

Help QA diagnose context bloat and duplicated evidence.

## Steps

1. Add internal Main payload metrics to the workflow log:
   - estimated total payload characters,
   - section character sizes,
   - retrieval record count,
   - graph relationship count,
   - tool result count,
   - skipped tool count,
   - answer mode,
   - whether fallback was used.
2. Do not log secrets or unbounded customer evidence.
3. Feed these metrics into `qa_run_summary`.

## Tests

- Main payload metrics exist on RAG runs.
- Metrics do not include API keys or service-role keys.
- QA Agent can mention context-size risks when visible.
- Measure:
  - total Main payload characters,
  - per-section character sizes,
  - retrieval record count,
  - graph relationship count,
  - tool result count,
  - answer mode,
  - fallback flag.
- Pass criteria:
  - Metrics appear in workflow log for RAG runs.
  - Metrics are included in `qa_run_summary`.
  - Oversized payloads are visible to QA without full raw evidence duplication.
  - No secrets appear in metrics.

## Gate

Proceed only after QA can identify oversized Main payloads from internal metrics.

---

# Phase 8: QA Trend Upgrade

## Goal

Make trend analysis useful after individual reports become richer.

## Steps

1. Update trend input to include normalized fields from saved QA reports.
2. Update trend prompt to analyze:
   - recurring failing steps,
   - recurring questionable-but-not-failing steps,
   - cost hotspots,
   - retrieval issues,
   - grounding/citation issues,
   - model/prompt/settings/code recommendations.
3. Make trend call respect `config.ai.qa` settings or add separate `ai.qaTrend` settings if needed.

## Tests

- Trend works with old compact reports.
- Trend works with new full reports.
- Trend does not overcount acceptable reports as failures.
- Measure:
  - total reports analyzed,
  - recurring steps count,
  - answer-quality breakdown,
  - top cost hotspots if available.
- Pass criteria:
  - Trend accepts mixed old/new report formats.
  - Trend separates systemic failures from isolated findings.
  - Trend recommendations name concrete steps/settings/prompts/code areas.
  - Acceptable reports are not counted as failures unless they include real issues.

## Gate

Proceed only after trend reports identify systemic issues clearly.

---

# Phase 9: Model Comparison

## Goal

Choose the cheapest QA model that still produces useful full-run audits.

Do this only after structured input/output and UI rendering are stable.

## Test Models

1. Current QA model, likely `openai/gpt-4o`.
2. Cheaper model, likely `openai/gpt-4o-mini`.
3. Optional stronger model only for hard cases.

## Test Set

Use at least three real runs:

1. A normal RAG answer that was acceptable.
2. A professional/Knowledge Planner run.
3. A bad or incomplete answer with visible retrieval/Main/citation issue.

## Metrics

For each model:

- valid JSON rate,
- per-agent audit completeness,
- correctness of root cause,
- specificity of recommendations,
- cost,
- latency,
- whether it invents issues.

Required phase-exit checks:

- Run the same report set with each tested QA model.
- Compare reports side by side.
- Pass criteria:
  - Selected default model returns valid JSON on all test cases.
  - Per-agent audit completeness is not materially worse than the stronger model.
  - Root-cause accuracy is acceptable on the known bad baseline.
  - Cost/latency improvement is documented.
  - Any hard-case escalation rule is explicit.

## Gate

Select the default QA model only after side-by-side report comparison.

---

# Phase 10: Documentation And Final Operating Policy

## Goal

Document how to use QA as an internal calibration tool.

## Steps

1. Update docs with:
   - how to run QA on a message,
   - how to read the agent audit,
   - how to interpret cost review,
   - when to trust or ignore a recommendation,
   - when to escalate to model/prompt/settings/code changes.
2. Document final QA model policy:
   - default model,
   - escalation model,
   - max tokens,
   - expected cost range.
3. Document privacy/internal-only rule.

## Gate

QA Agent improvement is complete when the user can inspect a run and understand what every agent did and why.

## Tests

- Open the final QA documentation and follow it against one real run.
- Run one old compact report and one new full report through the UI.
- Verify final model/settings are documented.
- Pass criteria:
  - A user can run QA from the UI or endpoint.
  - The report explains every relevant agent step.
  - The report includes retrieval, grounding, citation, and cost reviews.
  - The operating policy explains when to trust QA and when to manually inspect logs.
  - Internal-only data remains out of customer-facing chat.

---

# Implementation Order Summary

1. Phase 0: Baseline capture.
2. Phase 1: Full QA report contract.
3. Phase 2: Deterministic QA run summary.
4. Phase 3: QA prompt for full audit.
5. Phase 4: QA output normalization.
6. Phase 5: QA telemetry.
7. Phase 6: QA UI rendering.
8. Phase 7: Main payload diagnostics.
9. Phase 8: QA trend upgrade.
10. Phase 9: QA model comparison.
11. Phase 10: documentation and operating policy.

## First Phase To Implement

Start with Phase 0.

Reason: we need one real current QA output as the baseline. Without that, we cannot prove whether later changes improved the agent or only made the report longer.

## Phase 0 Results

Completed: 2026-06-25.

### Baseline Run

| Field | Value |
| --- | --- |
| Message id | `1255` |
| Created at | `2026-06-23T17:49:16.045376+00:00` |
| Annotation | `X` / disliked |
| User question | `תכתוב לי בתור הקבלן ומנהל הפרויקט מטעמו מסמך רשמי עבור מזמין העבודה עם הצגת העיכובים בצורה מפורטת...` |
| Final answer summary | The answer started with a "what I checked" section but appeared incomplete/truncated before producing the requested formal document. |
| QA model | `openai/gpt-4o` |
| QA temperature | `0.1` |
| QA max tokens | `3000` |
| QA timeout | `90000` ms |
| QA feedback used | `Baseline Phase 0 QA capture: the answer appears incomplete or truncated. Analyze the current run and identify what the existing QA Agent can and cannot explain.` |
| Workflow log size | `52658` serialized characters |
| Workflow node count | `17` |
| `workflowLog.openRouterUsage` exists | Yes |
| Chat-run OpenRouter totals | `4` calls, `181032` prompt tokens, `4935` completion tokens, `185967` total tokens, cost `$0.25167648`, duration `65143` ms |

### Workflow Nodes Present

| Step | Status | Kind | OpenRouter telemetry attached |
| --- | --- | --- | --- |
| `chat_input` | done | trigger | no |
| `sanitize` | done | code | no |
| `save_message` | done | database | no |
| `classifier` | done | ai | yes |
| `knowledge_vocabulary` | done | router | no |
| `memory` | done | memory | no |
| `switch` | done | router | no |
| `investigation` | done | router | no |
| `knowledge_planner` | skipped | ai | no |
| `hybrid_search` | done | vector | yes |
| `graph_search` | done | database | no |
| `reranker` | done | ai | yes |
| `n8n_tools` | done | tool | no |
| `source_quality` | done | router | no |
| `conflict_detection` | done | router | no |
| `main_agent` | done | ai | yes |
| `update_message` | done | database | no |

### Current QA Report Output

```json
{
  "summary": "התשובה שסופקה אינה מספקת את המידע המפורט שנדרש על ידי המשתמש. התשובה כוללת רק תיאור כללי של מה שנבדק, אך אינה כוללת את הפרטים המפורטים על העיכובים, התאריכים והדרישות כפי שהתבקש.",
  "root_cause_steps": [
    "knowledge_planner",
    "main_agent"
  ],
  "overall_severity": "high",
  "step_issues": [
    {
      "step": "knowledge_planner",
      "label": "Professional Knowledge Agent",
      "issue": "השלב הזה דולג בגלל בעיה טכנית (ENOENT: no such file or directory), מה שגרם לחוסר במידע מקצועי שיכול היה להנחות את הסוכן הראשי.",
      "severity": "high"
    },
    {
      "step": "main_agent",
      "label": "Main RAG Agent",
      "issue": "התשובה שסופקה אינה כוללת את הפרטים המפורטים שנדרשו על ידי המשתמש, כמו נושאים, עיכובים, תאריכים ודרישות.",
      "severity": "high"
    }
  ],
  "recommendations": [
    "לתקן את הבעיה הטכנית ב-knowledge_planner כדי להבטיח שהמידע המקצועי יהיה זמין לסוכן הראשי.",
    "לשפר את הסוכן הראשי כך שיכלול פרטים מפורטים יותר בתשובותיו, במיוחד כאשר המשתמש מבקש מידע ספציפי ומפורט.",
    "לבדוק את תהליך החיפוש והדירוג כדי לוודא שהמידע הרלוונטי ביותר נשלף ומוצג בתשובה."
  ],
  "answer_quality": "incomplete",
  "confidence": "high"
}
```

### What Current QA Does Well

- Correctly identifies that the final answer is incomplete.
- Correctly points to `main_agent` as a root-cause step for the incomplete customer answer.
- Notices that `knowledge_planner` was skipped and treats it as relevant.
- Uses the user language, Hebrew, for human-readable report fields.
- Produces valid JSON matching the current compact schema.

### What Current QA Does Not Explain Well Enough

- It does not give an audit for every step, even though the workflow log contains 17 nodes.
- It does not explain what the classifier decided.
- It does not explain why `knowledge_vocabulary` ran or what it matched.
- It does not explain what investigation mode did.
- It does not summarize what Hybrid Search retrieved.
- It does not summarize what Graph Search added.
- It does not explain reranker quality, top chunks, or whether relevant evidence was discarded.
- It does not inspect n8n tool behavior beyond a generic recommendation.
- It does not use the visible OpenRouter token/cost telemetry in the report.
- It does not mention that the chat run was very expensive: `185967` total tokens and about `$0.25167648`.
- It does not separate answer truncation/output-limit behavior from weak synthesis behavior.
- It does not provide a timeline of what happened in the system.
- It does not provide per-agent verdicts such as good, questionable, bad, or not applicable.
- It does not capture the QA Agent's own token/cost/latency telemetry.
- It gives a generic recommendation to "check search and reranking" without naming exact retrieved records, chunk ranks, or reranker reasons.

### Phase 0 Conclusion

The current QA Agent is useful as a compact failure report, but it is not sufficient as a full internal run auditor.

The next phase should focus on approving the richer QA report contract. The main missing capability is not only prompt wording or model choice; the QA Agent needs a structured per-agent audit output and, later, a deterministic `qa_run_summary` input.

## Planner JSON Contract Hotfix

Completed: 2026-06-27.

Reason: during Planner retesting with `google/gemini-2.5-pro`, the methodology question `How do we decide whether a blocker is a real project delay?` produced useful planning content but QA flagged `knowledge_planner` as questionable because the model did not return parseable JSON. That makes downstream reranker/Main testing noisy, because the system falls back to a deterministic planner shape instead of using the model's intended structured plan.

### Change

- Added a runtime JSON contract for the Professional Knowledge Planner OpenRouter call using `responseFormat: { type: "json_object" }`.
- Added one repair attempt before fallback when the Planner content cannot be parsed as JSON.
- The repair call uses the same Planner model, temperature `0`, the same JSON response format, and a compact schema-only prompt.
- If repair succeeds, the plan includes `planner_json_repaired: true` so the QA Full Audit can expose that the contract was recovered.

### Tests And Measurements

| Check | Result |
| --- | --- |
| `node --check src\agent.js` | Pass |
| `node --check test\run-tests.js` | Pass |
| `npm.cmd test` Planner contract regression | Pass: `knowledge planner enforces JSON response format and repair before fallback` |
| `npm.cmd test` full suite | Non-zero because of unrelated existing prompt/timeline assertions outside this Planner hotfix |

### Manual UI Gate Before Reranker Testing

Re-run:

```text
How do we decide whether a blocker is a real project delay?
```

Pass criteria:

- `knowledge_planner` appears in the Full QA Audit.
- The Planner decision is `good`, or at least no longer fails with `Model did not return JSON`.
- Output summary includes `domain_summary`, `relevant_terms`, `decision_criteria`, `rag_queries`, `recommended_tools`, and `risks_or_cautions`.
- If `planner_json_repaired: true` appears, mark the run as acceptable but note that Gemini still needed JSON repair.
- The final answer should explain methodology/criteria and must not invent project-specific delay facts.

Proceed decision: move to reranker testing only after this manual UI gate passes.

## Planner Phase Completion

Completed: 2026-06-27.

After the JSON-contract hotfix, the Planner was retested with the required routing cases before moving to reranker work.

### Manual UI Evidence

| Test | Expected Planner behavior | Result |
| --- | --- | --- |
| `What were the significant delays in March?` | Planner runs for a professional delay question and returns structured planning fields. | Pass |
| `How do we decide whether a blocker is a real project delay?` | Planner runs for methodology/criteria, returns valid JSON, and does not invent project facts. | Pass |
| `Hello, how are you?` | Planner does not run for normal chat. | Pass |
| `What is the status of the latest invoice?` | Planner does not run for a non-professional invoice/status question. | Pass |

### Invoice/Status Evidence

The fourth test produced:

- Classifier: `type: RAG`, `tool_hint: financial_transactions,meetings`, `professional: false`.
- Knowledge vocabulary: checked, no match.
- `knowledge_planner`: did not run.
- Hybrid search: `plannedQueries: 0`.
- This confirms the Planner did not add unnecessary cost or professional methodology to an invoice/status workflow.

### Planner Decision

Planner phase is complete. Proceed to reranker prompt/testing.

Known downstream issues discovered while closing the Planner phase:

- Main can still receive very large context and become expensive.
- Main can hit output length limits.
- Conflict detection or QA may become the reported root cause after the Planner is no longer failing.
- These are not Planner blockers; they belong to the reranker/Main stabilization phases.

## Reranker Prompt Validation Gate

Purpose: verify whether the reranker selects the best evidence before changing Main. The reranker should improve evidence quality, not merely compress many candidates into fewer records.

### Before/After Method

For each test below, capture the run before the reranker prompt change if possible, then repeat the same prompt after the change.

Record:

- `hybrid_search.records`
- `reranker.candidates`
- `reranker.records`
- reranker model
- reranker prompt tokens, completion tokens, total tokens, cost, and latency
- QA Full Audit decision for `reranker`
- whether Main answer improved, degraded, or stayed the same

### Reranker Test Set

| Test | User question | What the reranker should prioritize |
| --- | --- | --- |
| R1 | `What were the significant delays in March?` | Actual March schedule blockers/delays with project impact. |
| R2 | `Who caused the significant delays in March?` | Records that connect a delay to a responsible party or dependency, without inventing blame. |
| R3 | `Which blockers delayed work, and which were only risks?` | Evidence separating realized delays from potential schedule risks. |
| R4 | `What is the status of the latest invoice?` | Latest invoice/payment-status records, not generic delay or meeting records. |
| R5 | `What project issues still require immediate action?` | Open/high-priority records, recent unresolved issues, and direct action requirements. |

### Reranker Pass Criteria

Pass only if all are true:

- Reranker returns valid structured ranking output.
- QA marks `reranker` as `good` or does not name it as a root cause.
- Top selected records are directly relevant to the user's question.
- Irrelevant records do not dominate the top results.
- For delay questions, meeting lateness or generic scheduling text does not outrank actual project-impact delay evidence.
- For responsibility questions, reranker prefers records with explicit actors, causes, or dependencies.
- For invoice/status questions, reranker prefers invoice/payment evidence and recent dated records.
- Token/cost stays reasonable relative to the candidate count. A high token run is acceptable only if the selected evidence clearly improves.

### Reranker Fail Signals

Treat as fail or needs prompt revision if any appear:

- QA says reranker missed important evidence.
- Top records are semantically related but not answer-bearing.
- Reranker favors generic Knowledge Base/planning text over project records.
- Reranker keeps duplicate records while discarding distinct evidence.
- Reranker ranks records with no dates above dated records for time-sensitive questions.
- Reranker causes Main to answer from weak/irrelevant evidence.

### Proceed Decision

Move to Main prompt/context stabilization only after R1-R5 are checked and the reranker is no longer a likely source of bad evidence selection.
