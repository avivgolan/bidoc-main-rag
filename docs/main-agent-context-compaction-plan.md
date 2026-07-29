# Main Agent Context Compaction And Source-Link Stabilization Plan

This plan continues the agent calibration work after QA, Planner, Reranker, and Main validation. It is intended for a separate implementation conversation.

## Current Diagnosis

The Main Agent model and prompt are not the main bottleneck anymore.

After the Main prompt tightening, M1-M5 showed that `google/gemini-2.5-pro` can produce useful answers, but Main still receives too much context and often fails runtime/output constraints.

Observed Main validation results:

| Test | Question type | Main tokens | Cost | Finish | Decision |
| --- | --- | ---: | ---: | --- | --- |
| M1 | Latest invoice/status | `117119` | `$0.18220375` | `MAX_TOKENS` | Partial/fail |
| M2 | Delay responsibility | `180280` | `$0.261155` | `MAX_TOKENS` | Fail |
| M3 | Blockers vs risks | `130515` | `$0.19894875` | `MAX_TOKENS` | Partial |
| M4 | Significant March delays | `175380` | `$0.2388775` | `STOP` | Answer pass, cost fail/watch |
| M5 | Immediate action topics | `162849` | `$0.23936625` | `MAX_TOKENS` | Partial/fail |

Recurring problems:

- Main prompt tokens are extremely high.
- Main frequently hits `MAX_TOKENS`.
- Direct source links are inconsistent.
- Raw Outlook/SharePoint URLs leak into the answer.
- QA often names `main_agent` or `conflict_detection` as root cause.
- Reranker and Planner are not the primary cost drivers compared with Main.

## Relevant Code Surface

Primary implementation area:

- `src/agent.js`
  - `synthesizeAnswer(...)`
  - Main payload currently includes:
    - `retrieval_context`
    - `retrieval_results`
    - `tool_results`
    - `graph_context`
    - `project_graph_findings`
    - `knowledge_plan`
    - `investigation_plan`
    - `source_quality`
    - `conflicts`
    - `sources`
    - memory fields

Secondary areas:

- `src/prompts.js`
  - Main prompt already has precision rules.
  - May need small updates after payload shape changes.
- `src/qaSummary.js`
  - QA should expose compacted payload metrics.
- `public/app.js` / `public/styles.css`
  - May need source-link rendering support if answer uses source IDs.
- `test/run-tests.js`
  - Add regression tests for compact Main payload and source-link behavior.

## Target Outcome

The next phase should reduce Main input size while preserving answer quality.

Target gates:

- Main prompt tokens reduced materially from the current `117k-180k` range.
- M1-M5 do not repeatedly hit `MAX_TOKENS`.
- Main answers still cite sources correctly.
- No raw URLs appear in customer-facing answer text.
- QA no longer repeatedly names `main_agent` for missing direct citations.
- Main cost drops meaningfully without switching away from Gemini 2.5 Pro.

## Phase 1: Baseline Payload Inspection

Goal: identify exactly what is making Main payload huge before editing behavior.

### Steps

1. Add temporary/debug-only measurement around `synthesizeAnswer`.
2. Measure serialized size and approximate token pressure for:
   - `retrieval_context`
   - `retrieval_results`
   - `tool_results`
   - `graph_context`
   - `project_graph_findings`
   - `sources`
   - `knowledge_plan`
   - `memory`
3. Log these measurements internally in Workflow/QA debug only.
4. Run one or two known heavy questions from M1-M5.

### Tests Before Moving On

Run:

- `מה הסטטוס של החשבונית האחרונה?`
- `מי גרם לעיכובים המשמעותיים בחודש מרץ?`

Record:

- Main prompt tokens.
- Main total tokens.
- Payload-size breakdown by field.
- Whether `retrieval_context` and `retrieval_results` duplicate the same content.
- Whether graph/tool/source payloads add large repeated text.

### Gate

Move to Phase 2 only after we know the top 2-3 payload contributors.

## Phase 2: Build Compact Evidence Records

Goal: replace duplicated raw evidence with a compact, structured evidence list for Main.

### Proposed Shape

```json
{
  "source_id": "S1",
  "title": "short document or record title",
  "date": "2026-03-15",
  "record_type": "email | whatsapp | invoice | meeting | report | alert | index",
  "source_table": "data_index",
  "source_id_raw": "123",
  "url": "https://...",
  "score": 0.82,
  "why_relevant": "one short sentence",
  "evidence_excerpt": "short excerpt, capped",
  "entities": ["supplier", "invoice", "delay"],
  "supports": ["latest_status", "delay_cause"]
}
```

### Steps

1. Add `buildMainEvidenceRecords(...)` in `src/agent.js` or a new helper file.
2. Input:
   - reranked retrieval records,
   - source list,
   - graph context,
   - tool calls.
3. Output:
   - compact deduplicated `evidence_records`.
4. Keep excerpts short.
5. Preserve enough metadata for citations.
6. Do not include raw full record objects in the Main prompt by default.

### Deduplication Rules

Deduplicate by:

- URL if available.
- `source_table + source_id`.
- normalized title + date.
- text fingerprint for repeated chunks.

When duplicates exist:

- keep the highest-ranked or most recent item,
- merge source IDs/metadata,
- do not repeat the same excerpt many times.

### Tests Before Moving On

Automated tests:

- Deduplicates repeated records by URL.
- Deduplicates repeated records by `source_table + source_id`.
- Keeps source URL and source ID metadata.
- Caps excerpt length.
- Does not drop all evidence when URLs are missing.

Manual check:

- Run M1 or M4 and confirm QA Full Audit shows compact evidence count.

### Gate

Move to Phase 3 only if compact evidence records preserve source metadata and reduce payload size.

## Phase 3: Replace Main Payload Inputs

Goal: make Main use compact evidence as the primary evidence view.

### Steps

1. In `synthesizeAnswer`, replace or downgrade:
   - `retrieval_results`
   - large `tool_results`
   - large graph payloads
2. Send:
   - `evidence_records`
   - compact `tool_summaries`
   - compact `graph_summary`
   - compact `source_map`
3. Keep full raw payloads out of the Main LLM prompt unless debug mode explicitly requires them.
4. Update Main prompt to say:
   - use `evidence_records` as primary evidence,
   - cite by `source_id`,
   - do not print raw URLs.

### Proposed Main Input Policy

Default:

- `8-12` evidence records.
- `18` only for explicit broad/list/report mode.
- graph summary capped to the most relevant relationships.
- no full duplicated `retrieval_results` in Main prompt.

Exception:

- If user explicitly asks for a full list/report, allow more records but still compact each record.

### Tests Before Moving On

Automated tests:

- Main LLM payload contains `evidence_records`.
- Main LLM payload does not contain full `retrieval_results` by default.
- Main event logs include `evidence_records_count`.
- Main payload respects default cap.
- Broad/report mode can raise cap safely.

Manual tests:

- Run M1 and M4.
- Confirm Main prompt tokens drop materially.
- Confirm no obvious answer quality regression.

### Gate

Move to Phase 4 only if Main token usage drops and answers still contain the requested facts.

## Phase 4: Source-Link Normalization

Goal: stop raw URL leakage and make citations reliable.

### Problem

Current Main answers sometimes print raw Outlook/SharePoint URLs in the answer body. The prompt asks for links, but the model can still leak raw URLs if URLs are included directly in evidence text.

### Target Behavior

Main should cite with source IDs or controlled Markdown links, not raw URLs.

Preferred approach:

- Main writes citations like `[S1]`, `[S2]`, or `[מקור 1]`.
- Backend/UI maps source IDs to actual links.
- Customer-facing answer does not include raw URL strings.

### Steps

1. Create a `source_map`:
   - `S1 -> title, url, type`
2. Give Main:
   - source IDs,
   - titles,
   - dates,
   - short excerpts,
   - not raw URLs inside the free-text evidence excerpt.
3. Post-process or render answer citations:
   - replace `[S1]` with a controlled link,
   - or render source chips below each answer.
4. Keep raw URLs available in debug/QA only.

### Tests Before Moving On

Automated tests:

- Customer-facing answer text does not contain `http://` or `https://`.
- Source map still contains real URLs.
- Citation IDs in the answer map to known sources.
- Unknown citation IDs are handled safely.

Manual tests:

- Re-run M1, M2, M3, and M5.
- Confirm no visible raw Outlook/SharePoint URLs in the chat bubble.
- Confirm source buttons/links still work.

### Gate

Move to Phase 5 only if raw URL leakage is eliminated without losing source access.

## Phase 5: Answer-Mode Templates

Goal: make Main more predictable for common question types.

### Answer Modes

Add or refine compact answer contracts for:

- `latest_status`
- `responsibility`
- `blockers_vs_risks`
- `delay_list`
- `immediate_actions`
- `standard_grounded_answer`

### Expected Behavior By Mode

`latest_status`:

- Start with the single latest dated supported record.
- Then show up to 3 older relevant records if useful.

`responsibility`:

- Separate confirmed cause, likely contributor, and insufficient evidence.
- Never say “caused by” unless the evidence explicitly supports causation.

`blockers_vs_risks`:

- Two sections:
  - actual blockers that delayed work,
  - risks or warnings only.

`delay_list`:

- strongest delay findings only,
- each item includes impact and source.

`immediate_actions`:

- list only topics requiring action now,
- include why it is urgent,
- include missing owner/date when absent.

### Tests Before Moving On

Manual tests:

- M1 should use `latest_status`.
- M2 should use `responsibility`.
- M3 should use `blockers_vs_risks`.
- M4 should use `delay_list`.
- M5 should use `immediate_actions`.

Pass criteria:

- correct answer shape,
- no over-expansion,
- all factual claims cited,
- no raw URLs,
- no `MAX_TOKENS`.

## Phase 6: Conflict Detection Stabilization

Goal: reduce noisy QA failures caused by brittle conflict detection.

### Problem

QA repeatedly flags `conflict_detection`, sometimes even when Main answer quality is acceptable.

### Steps

1. Review `detectConflicts(...)` in `src/sourceQuality.js`.
2. Add domain-aware conflict categories:
   - invoice/payment status,
   - schedule delay,
   - responsibility/causation,
   - work stoppage,
   - immediate action.
3. Avoid generic conflict labels when evidence is merely incomplete.
4. Emit conflict evidence IDs, not only tool names.
5. Let QA distinguish:
   - true conflict,
   - missing evidence,
   - tool/config failure,
   - harmless inconsistency.

### Tests Before Moving On

Automated tests:

- No conflict when sources are different but not contradictory.
- Conflict when two records explicitly state different statuses for the same invoice/item.
- Conflict output includes source/evidence IDs.

Manual tests:

- Re-run M1 and M4.
- QA should not name `conflict_detection` unless a real contradiction exists.

## Phase 7: Full M1-M5 Retest Gate

Goal: verify that the Main Agent is actually improved after implementation.

### Retest Questions

Run these in Hebrew:

1. `מה הסטטוס של החשבונית האחרונה?`
2. `מי גרם לעיכובים המשמעותיים בחודש מרץ?`
3. `אילו חסמים עיכבו עבודה בפועל, ואילו היו רק סיכונים?`
4. `מה היו העיכובים המשמעותיים בחודש מרץ?`
5. `אילו נושאים בפרויקט עדיין דורשים פעולה מיידית?`

### Metrics To Record

For each run:

- Main model.
- Main prompt tokens.
- Main completion tokens.
- Main total tokens.
- Main cost.
- Main latency.
- Finish reason.
- Evidence records count.
- Raw retrieval records count.
- Graph relationships count.
- QA quality.
- QA confidence.
- QA root cause step.
- Whether raw URLs appeared in chat.
- Whether every factual bullet had a source.
- Whether answer was useful.

### Target Comparison

Compare against baseline:

| Test | Baseline Main tokens | Baseline finish |
| --- | ---: | --- |
| M1 | `117119` | `MAX_TOKENS` |
| M2 | `180280` | `MAX_TOKENS` |
| M3 | `130515` | `MAX_TOKENS` |
| M4 | `175380` | `STOP` |
| M5 | `162849` | `MAX_TOKENS` |

### Pass Criteria

The phase passes only if:

- Main token usage drops materially in most runs.
- At least 4 of 5 runs finish with `STOP`.
- No raw URLs appear in the chat answer.
- QA does not repeatedly name `main_agent` for citation failures.
- Answers remain useful and grounded.

## Implementation Order Recommendation

Do this in small phases:

1. Baseline payload inspection.
2. Build compact evidence records.
3. Replace Main payload with compact evidence.
4. Normalize source-link rendering.
5. Add answer-mode templates.
6. Stabilize conflict detection.
7. Re-run M1-M5 and document results.

Do not change the Main model during these phases unless the compacted payload still fails after retesting.

## Documentation To Update During Implementation

Update these files as work progresses:

- `docs/main-agent-calibration-results.md`
- `docs/rag-model-calibration-plan.md`
- `bedrock/Memory/workflow.md`

For each phase, record:

- what changed,
- tests run,
- pass/fail result,
- measured token/cost changes,
- whether to proceed or repeat the phase.

## Global Answer Hardening Closeout - 2026-07-29

This post-calibration change applies to every Main RAG answer, not only exception queries.

Implemented:

- OpenRouter HTTP/capacity failures expose typed internal retry metadata without placing provider errors in customer answers.
- Main synthesis receives one bounded compact retry. Capacity failures move to the configured lite model with a reduced token budget; timeouts retry the same model with compact context.
- The last-resort RAG answer renders only deterministic Data Query facts and up to five deduplicated safe project links. It never renders raw tool payloads, retrieval excerpts, contact details, provider errors, or internal workflow labels.
- Meeting evidence runs only for explicit meeting intent or an explicit meeting-evidence route. Generic investigation mode no longer activates it.
- Every external n8n tool request has a shared 30-second default timeout, configurable from `toolsRuntime.timeoutMs`, so a stalled workflow cannot block the answer indefinitely.
- Final customer text receives a control-character and whitespace cleanup pass.

Verification:

- Focused global hardening tests: `7/7` passed.
- Protected Data Query suite: `122/122` passed.
- Full repository suite: `372/383` passed. The remaining 11 failures are the pre-existing settings, workflow UI, and timeline mobile group; this change introduced no additional full-suite failure.
- Syntax checks passed for all modified JavaScript files.
- `git diff --check` passed (line-ending warnings only).

Live limitation:

- A one-off run of `אפשר פירוט על החריגים הקריטיים?` reached the RAG route without activating Meeting Evidence, but an external retrieval stage did not return, so no final customer answer was available for a visual UI assertion in this closeout.
- The backend remains local-only; no deployment, production-data change, schema change, commit, or push was performed.
