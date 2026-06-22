# Professional RAG Stabilization Plan

## Purpose

Before calibrating another agent, stabilize the complete professional-question path.

The Professional Knowledge Planner currently performs its core task reasonably well with `openai/gpt-4o-mini`. However, Planner-generated searches expose downstream orchestration problems:

- Main receives the same evidence multiple times in different structures.
- Four of five professional tests exceeded the model's 128K context window.
- A successful professional run sent approximately 101K input tokens to Main.
- Main calls cost approximately `$0.19-$0.27`.
- Generic question words incorrectly activate expanded list mode.
- The Main fallback can expose raw internal data to the customer.
- The Planner sometimes recommends tools that do not exist in the backend.

The work must be completed phase by phase. After each phase:

1. Make only the changes assigned to that phase.
2. Run its automated tests.
3. Run its manual acceptance test.
4. Record the result.
5. Review and approve the phase before continuing.

Do not combine all phases into one large implementation.

---

## Current Baseline

Source:

`docs/Planner Functional Test Set - Results.pdf`

### Planner Routing Results

| Test | Expected | Observed Planner Behavior |
| --- | --- | --- |
| P1 - Blocker criteria | Planner runs | Passed |
| P2 - Risk versus blocker | Planner runs | Passed |
| P3 - Hebrew delay criteria | Planner runs; Hebrew output | Passed |
| P4 - Defect severity | Planner runs | Passed |
| P5 - Delay responsibility | Planner may run; no unsupported blame | Passed |
| P6 - Current project status | Planner must not run | Passed |
| P7 - Invoice lookup | Planner must not run | Passed |
| P8 - Greeting | Planner must not run | Passed |

### Critical End-To-End Results

| Test | Main Result |
| --- | --- |
| P1 | Completed, but Main used approximately 101K input tokens |
| P2 | Failed: context exceeded approximately 164K tokens |
| P3 | Failed: context exceeded approximately 157K tokens |
| P4 | Failed: context exceeded approximately 168K tokens |
| P5 | Failed: context exceeded approximately 140K tokens |
| P6 | Completed |
| P7 | Completed |
| P8 | Routed to Lite and completed |

### Planner Model Baseline

- Model: `openai/gpt-4o-mini`
- Average Planner cost: approximately `$0.00044`
- Average Planner latency: approximately 6 seconds
- Average Planner input: approximately 1,519 tokens
- Average Planner output: approximately 358 tokens

Conclusion: the Planner model is not currently the main cost problem. Context construction and downstream Main processing are the priority.

---

# Phase 1: Baseline And Main Payload Map

## Goal

Measure exactly what is sent to Main and prove which payload sections cause the context expansion.

## Step 1.1: Preserve The Baseline

Record the current P1-P8 results in a structured Markdown result table.

For each test, preserve:

- User message.
- Classifier output.
- Planner activation.
- Planner model.
- Planner output.
- Planner model tokens, cost, and latency.
- Number of Planner queries executed.
- Hybrid-search candidate count.
- Reranker candidate and output counts.
- Main model.
- Main input and output tokens.
- Main cost and latency.
- Final response.
- Error or fallback behavior.

## Step 1.2: Map Main Payload Sections

Inspect and document the size of every Main payload section:

- System prompt.
- Memory summary/messages.
- `user_message`.
- `retrieval_context`.
- `retrieval_results`.
- `graph_context`.
- `project_graph_findings`.
- `knowledge_plan`.
- `investigation_plan`.
- `source_quality`.
- `potential_conflicts`.
- `tool_results`.
- `skipped_tools`.
- `sources`.

## Step 1.3: Identify Duplicated Evidence

Confirm whether the same evidence appears in:

- `retrieval_context`.
- Full `retrieval_results`.
- `hybrid_search` inside `tool_results`.
- `hybrid_search_plan` inside `tool_results`.
- `reranker` inside `tool_results`.
- Planner `matches`.
- `graph_context`.
- `project_graph_findings`.
- Global `sources`.

## Step 1.4: Add Internal Payload Telemetry

Add administrator-only metrics for:

- Estimated total Main input tokens.
- Total serialized Main payload characters.
- Character size of each payload section.
- Retrieval record count.
- External tool result count.
- Planner query count.
- Graph relationship count.
- Selected answer mode.
- Whether payload reduction was applied.

Do not log:

- API keys.
- Authentication headers.
- Supabase secrets.
- Full customer evidence in the summary metrics.

## Phase 1 Tests

- Verify telemetry reports every expected payload section.
- Verify telemetry does not include secrets.
- Verify a P1 run reports the same approximate input size visible in OpenRouter.
- Compare estimated and actual prompt tokens and document the difference.

## Phase 1 Approval Gate

Proceed only after telemetry confirms which duplicate payload sections are responsible for the excessive Main input.

---

# Phase 2: Build One Compact Main Payload

## Goal

Give Main one bounded, authoritative representation of each evidence type.

## Step 2.1: Keep One Retrieval Representation

Keep compact `retrieval_context` as the authoritative retrieval evidence supplied to Main.

Remove full `retrieval_results` from the Main model payload.

The compact retrieval records must preserve:

- Record identifier where available.
- Short title or source label.
- Relevant content excerpt.
- Date where available.
- Score where useful.
- Source URL attached to the same record.

## Step 2.2: Remove Internal Retrieval Calls From Tool Results

Do not send these internal orchestration calls inside `tool_results`:

- `hybrid_search`.
- `hybrid_search_plan`.
- `reranker`.
- `graph_search`.

These calls may remain available in:

- Workflow logs.
- Internal debugging.
- Cost telemetry.

They must not duplicate evidence inside the Main prompt.

## Step 2.3: Compact External Tool Results

Only actual external/project tools should appear in Main `tool_results`.

Examples:

- `alert`.
- `meetings`.
- `emails`.
- `whatsapp_messages`.
- `financial_transactions`.
- `consultants_reports`.
- `exceptions_report`.
- `quality_control`.
- `safety_report`.
- `submittals`.

For each result, include only:

- Tool name.
- Success/failure state.
- Compact relevant findings.
- Matching source URLs.
- Material error or skipped reason.

Apply a bounded text limit to every tool result.

## Step 2.4: Compact The Knowledge Plan

Main should receive only:

```json
{
  "domain_summary": "",
  "relevant_terms": [],
  "decision_criteria": [],
  "rag_queries": [],
  "recommended_tools": [],
  "risks_or_cautions": []
}
```

Do not send:

- Planner `matches`.
- Full Knowledge Base excerpts.
- Knowledge agent descriptions.
- Chunk filenames and full chunk text.
- Planner retrieval scores unless specifically required.

## Step 2.5: Keep One Graph Representation

Send compact `project_graph_findings` to Main.

Remove duplicate `graph_context` from the Main payload.

The compact graph representation should contain:

- Top connected entities.
- Top relationship types.
- A bounded number of relationships.
- Short evidence snippets.
- Confidence where available.

## Step 2.6: Remove Duplicate Global Sources

Attach each source URL directly to its matching evidence item.

Remove the global `sources` array from the Main payload unless a verified fallback path requires it.

Do not allow Main to attach a source to an unrelated claim.

## Step 2.7: Add A Main Input Budget

Use a conservative preflight target of approximately 24,000 estimated input tokens.

If the payload exceeds the budget, reduce in this order:

1. Remove duplicate or nearly identical retrieval records.
2. Reduce evidence text per retrieval record.
3. Reduce external tool-result text.
4. Reduce graph relationships.
5. Reduce retrieval record count.

Do not remove:

- The user question.
- Core grounding instructions.
- URLs attached to retained evidence.
- Material conflict or uncertainty information.

## Phase 2 Automated Tests

- Full retrieval rows appear only once in the Main payload.
- Planner KB excerpts do not enter Main.
- Internal retrieval calls are absent from Main `tool_results`.
- External tool evidence remains present.
- Graph information appears only once.
- Source URLs stay attached to matching records.
- Oversized input is reduced below the configured budget.
- Customer evidence is still available to Main after compaction.

## Phase 2 Manual Test

Run P1:

`How should we determine whether an issue is a real blocker?`

Verify:

- Planner runs.
- Main succeeds.
- Main prompt is substantially smaller than 101K input tokens.
- The answer still contains supported criteria and project findings.
- Source links still match their claims.

## Phase 2 Approval Gate

P1 must pass with a compact Main payload and no material answer-quality loss.

---

# Phase 3: Correct Answer-Mode Expansion

## Goal

Expand retrieval only for real entity-list questions.

## Current Problem

The current list-intent logic treats broad words such as `what`, `who`, `which`, `מה`, and `מי` as enough to activate list mode.

This causes normal questions to use:

- `ranked_entity_list`.
- Expanded rerank limits.
- Expanded Main record limits.
- Expanded graph context.

## Step 3.1: Define True List Intent

Use `ranked_entity_list` only for explicit requests such as:

- List all suppliers associated with delays.
- Which suppliers caused delays?
- Who caused the project delay?
- What other blockers exist?
- Show all responsible candidates.
- Rank the relevant suppliers.
- Equivalent explicit Hebrew requests.

## Step 3.2: Keep Normal Questions Standard

The following must use `standard_grounded_answer`:

- What is the difference between a risk and a blocker?
- Which criteria determine defect severity?
- What is the current project status?
- What is invoice 50?
- How should an issue be evaluated?

## Step 3.3: Separate Investigation From List Intent

Investigation mode may broaden evidence moderately.

It must not automatically force the same limits as a broad entity-list request.

Initial limits:

| Mode | Maximum reranked records | Maximum graph relationships |
| --- | ---: | ---: |
| Standard | Configured normal limit | Configured normal limit |
| Investigation | 12 | 10 |
| True entity list | 15 | 15 |

## Phase 3 Tests

- P2 uses `standard_grounded_answer`.
- P3 uses `standard_grounded_answer`.
- P4 uses `standard_grounded_answer`.
- P5 uses `ranked_entity_list`.
- P6 uses `standard_grounded_answer`.
- P7 uses `standard_grounded_answer`.
- Explicit English list requests activate list mode.
- Explicit Hebrew list requests activate list mode.
- Generic `what`, `who`, `מה`, or `מי` alone does not activate list mode.

## Phase 3 Approval Gate

All test questions must use the intended answer mode and bounded record limits.

---

# Phase 4: Tighten Planner Output

## Goal

Keep the inexpensive Planner model while improving output validity and controlling downstream searches.

## Step 4.1: Keep The Current Model

Initial configuration:

| Setting | Value |
| --- | --- |
| Model | `openai/gpt-4o-mini` |
| Temperature | `0` |
| Max output tokens | `1000` |
| Timeout | `60000` ms |
| Top P | `1` |
| Frequency penalty | `0` |
| Presence penalty | `0` |

Do not move to a more expensive Planner model unless testing proves a quality failure.

## Step 4.2: Restrict Recommended Tools

The Planner prompt must list the exact allowed backend tools:

- `alert`
- `whatsapp_messages`
- `emails`
- `meetings`
- `financial_transactions`
- `consultants_reports`
- `exceptions_report`
- `quality_control`
- `safety_report`
- `submittals`

Unknown names must not be returned.

Runtime normalization must remove unknown tools even if the model returns them.

## Step 4.3: Bound Planner Arrays

Apply these maximums:

| Field | Maximum |
| --- | ---: |
| `relevant_terms` | 8 |
| `decision_criteria` | 8 |
| `rag_queries` | 4 generated |
| `recommended_tools` | 4 |
| `risks_or_cautions` | 5 |

Trim empty entries and duplicates.

## Step 4.4: Limit Extra Searches

Initial settings:

| Setting | Value |
| --- | ---: |
| Planner extra queries executed | 1 |
| Planner rows per query | 10 |
| Knowledge agent limit | 2 |
| Knowledge top K | 3 |
| Knowledge chunk size | 1500 |

The Planner may generate up to four possible queries, but runtime should execute only the highest-priority distinct query initially.

## Step 4.5: Add Planner Validation Telemetry

Record internally:

- Generated query count.
- Executed query count.
- Duplicate queries removed.
- Invalid tools removed.
- Output array lengths.
- Whether Planner fallback was used.

## Phase 4 Tests

Re-run P1-P5.

Verify:

- All six Planner fields are present.
- JSON is valid.
- All tool names are supported.
- No duplicate query is executed.
- At most one additional query runs.
- The Planner does not make a project conclusion.
- P5 does not assign responsibility without project evidence.
- Hebrew remains readable and valid.

## Phase 4 Approval Gate

Planner output validity must be 100%, while reduced search expansion must preserve useful final answers.

---

# Phase 5: Safe Main Failure Handling

## Goal

Never expose raw internal data when Main fails.

## Step 5.1: Replace The Current Raw Fallback

The customer-facing fallback must never include:

- Serialized retrieval rows.
- JSON objects.
- Database column names.
- Table names.
- Internal tool names.
- Prompts.
- Model names.
- Routing details.
- Workflow architecture.

## Step 5.2: Produce A Customer-Safe Fallback

When Main cannot answer, return:

1. A short localized explanation.
2. Up to five compact evidence findings.
3. A matching source link beside each retained finding.
4. A clear uncertainty statement.
5. Material missing information.

The fallback must use the user's language.

## Step 5.3: Retry Context Overflow Once

Retry only when the provider rejects the request because of context length.

Emergency retry payload:

- Half the normal evidence records.
- Shorter text per evidence record.
- Maximum five graph relationships or a graph summary only.
- Compact Planner guidance.
- Compact external tool findings only.
- No duplicate evidence structures.

## Step 5.4: Do Not Retry Unrelated Failures

Do not automatically retry:

- Invalid API key.
- Authentication failure.
- Rate limit.
- Provider outage.
- Generic network failure.
- Invalid request unrelated to context size.

Use the safe fallback instead.

## Phase 5 Tests

- Simulated context overflow triggers one compact retry.
- Successful retry returns a grounded answer.
- Failed retry returns a clean fallback.
- Authentication failure does not trigger a context retry.
- No internal JSON appears in customer output.
- No internal database/tool names appear.
- Evidence links remain matched to their findings.
- Hebrew and English fallback versions are both valid.

## Phase 5 Approval Gate

All Main failure paths must be customer-safe.

---

# Phase 6: End-To-End Planner Retest

## Goal

Verify that the complete professional-question flow is stable after the changes.

## Test Set

### P1

`How should we determine whether an issue is a real blocker?`

Expected:

- Planner runs.
- Blocker criteria are produced.
- Main succeeds.
- No unsupported project conclusion.

### P2

`What is the difference between a risk and a blocker?`

Expected:

- Planner runs.
- Definitions and criteria are clear.
- Standard answer mode.
- Main succeeds.

### P3

`מהם הקריטריונים לזיהוי עיכוב אמיתי בפרויקט?`

Expected:

- Planner runs.
- Planner output is Hebrew.
- Main response is Hebrew.
- Standard answer mode.

### P4

`Which criteria should determine defect severity?`

Expected:

- Planner runs.
- Safety/quality knowledge is selected.
- Recommended tools are valid.
- Main succeeds.

### P5

`Who caused the project delay?`

Expected:

- Planner may run.
- Investigation mode may run.
- True list mode may run.
- No unsupported blame.
- Strong and weak candidates are separated.

### P6

`What is the current project status?`

Expected:

- Planner does not run.
- Standard answer mode.
- Factual grounded answer.

### P7

`Show invoice 50`

Expected:

- Planner does not run.
- Financial routing is used.
- Standard answer mode.

### P8

`Hi, how are you?`

Expected:

- Planner does not run.
- Lite Agent runs.
- No RAG pipeline.

## Metrics To Record

For every test:

- Classifier model.
- Classifier output.
- Planner activation.
- Planner model.
- Planner output.
- Knowledge agents selected.
- Knowledge matches.
- Planner queries generated.
- Planner queries executed.
- Hybrid candidates.
- Reranker input count.
- Reranker output count.
- Answer mode.
- Main estimated tokens.
- Main actual tokens.
- Cost per call.
- Total run cost.
- Latency per call.
- Total latency.
- Final response.
- Source correctness.
- Fallback/error state.

## Required Results

- P1-P5 activate the Planner correctly.
- P6-P8 do not activate the Planner.
- Zero context-window failures.
- Zero raw fallback responses.
- Main input target remains below approximately 24K estimated tokens.
- Planner cost remains around or below `$0.001`.
- Knowledge guidance is not treated as project evidence.
- Claims use matching source links.
- P5 does not assign blame without direct evidence.
- Reduced context does not create false “no information found” responses.

## Phase 6 Approval Gate

All eight tests must meet the required behavior before model-cost comparison begins.

---

# Phase 7: Main Model Cost Comparison

## Goal

Select the cheapest Main model that preserves grounded answer quality.

Do not begin this phase until the compact pipeline passes Phase 6.

## Step 7.1: Fix All Non-Model Variables

Keep unchanged:

- Main prompt.
- Planner prompt.
- Planner model.
- Retrieval settings.
- Reranker settings.
- Graph settings.
- Evidence payload.
- Test questions.

Only change the Main model.

## Step 7.2: Test `gpt-4o`

Run:

- P1.
- P5.
- P6.
- P7.

Record all quality, token, cost, and latency metrics.

## Step 7.3: Test `gpt-4o-mini`

Run the same four questions using identical settings and evidence.

## Step 7.4: Compare Results

Evaluate:

- Grounding.
- Completeness.
- Correct interpretation of Planner criteria.
- Citation correctness.
- Unsupported claims.
- Responsibility/blame safety.
- Hebrew and English quality.
- Input tokens.
- Output tokens.
- Cost.
- Latency.

## Model Selection Rule

Choose `openai/gpt-4o-mini` when it produces functionally equivalent grounded answers.

Keep `openai/gpt-4o` only when documented test evidence shows a material quality advantage that justifies the additional cost.

## Phase 7 Approval Gate

Document the selected model and the reason for the decision.

---

# Final Approval Gate

Move to calibration of the next agent only when all of the following are true:

- Planner routing passes P1-P8.
- Planner JSON is valid.
- Planner tool names are valid.
- Planner search expansion is bounded.
- Main receives one compact evidence payload.
- Main requests remain far below the context limit.
- List mode activates only for real list questions.
- Customer-safe fallback is verified.
- Answers remain grounded.
- Source links match their claims.
- No unsupported responsibility is assigned.
- Final Planner and Main models are documented.
- Final settings and test results are saved under `docs`.

---

# Working Checklist

Use this checklist while implementing:

- [ ] Phase 1 completed and approved.
- [ ] Phase 2 completed and approved.
- [ ] Phase 3 completed and approved.
- [ ] Phase 4 completed and approved.
- [ ] Phase 5 completed and approved.
- [ ] Phase 6 completed and approved.
- [ ] Phase 7 completed and approved.
- [ ] Final settings documented.
- [ ] Final cost comparison documented.
- [ ] Ready to move to the next agent.

## Default Decisions

- Keep `openai/gpt-4o-mini` for the Planner unless testing proves otherwise.
- Use one Planner-generated extra search during initial stabilization.
- Target approximately 24K or fewer estimated Main input tokens.
- Keep rich workflow diagnostics administrator-only.
- Preserve source URLs with their matching evidence.
- Implement and approve one phase at a time.
