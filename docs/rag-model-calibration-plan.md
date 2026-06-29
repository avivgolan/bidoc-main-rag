# RAG Model Calibration Plan

This assignment must be done step by step. Do not change code, prompts, or settings until the current phase is mapped, reviewed, and approved.

## Phase 1: Map The Current System

Goal: understand exactly what exists before changing anything.

### Steps

1. List every agent and mission in the Main RAG backend.
2. For each agent, map:
   - Runtime step name
   - Backend file and function
   - Prompt source
   - Model setting key
   - Temperature
   - Max output tokens
   - Timeout
   - Main inputs
   - Main outputs
3. Compare backend runtime behavior with the Settings UI.
4. Identify settings that appear in the UI but are not actually used by the backend.
5. Identify hidden model calls that are not visible in settings.
6. Identify token-heavy places:
   - Long system prompts
   - Large JSON payloads
   - Reranker candidate text
   - Retrieval context
   - Graph context
   - Tool results
   - QA workflow logs

### Gate

No code changes. No prompt changes. No settings changes.

Move to Phase 2 only after the current map is reviewed and confirmed.

## Phase 2: Cost And Token Diagnosis

Goal: understand where cost is coming from.

### Steps

1. Build a call-type table for:
   - Classifier
   - Knowledge Planner
   - Embedding / hybrid search
   - Reranker
   - Alert Agent
   - Main Agent
   - QA / AI Report
   - Timeline Link Agent, if relevant
2. Mark each call as:
   - Runs on every chat
   - Runs only on RAG
   - Runs only on professional / Knowledge Base questions
   - Runs only on QA
   - Runs only on timeline/link workflows
3. Estimate relative cost:
   - Low
   - Medium
   - High
4. Separate input-token cost from output-token cost.
5. Identify which calls are cacheable.
6. Identify which calls may be avoidable.
7. Inspect existing workflow logs where possible, including:
   - `019e9322-ae0c-7843-b066-2187e0294558`

### Gate

Confirm which agents actually ran in real examples before proposing calibration.

Move to Phase 3 only after the cost/token diagnosis is reviewed.

## Phase 3: Define Calibration Profiles

Goal: decide the target behavior before touching code or settings.

### Steps

1. Define a Conservative profile:
   - Best quality
   - Moderate savings
   - Minimal behavior risk
2. Define a Balanced profile:
   - Recommended default
   - Good quality/cost tradeoff
3. Define a Cheap Test profile:
   - Lowest practical cost
   - Used only for calibration/testing
4. For each profile, specify:
   - Model per agent
   - Temperature per agent
   - Max output tokens per agent
   - Request timeout per agent
   - Retrieval candidate count
   - Rerank top K
   - RAG context record limit
   - Chunk text limit
   - Knowledge Base top K
   - Knowledge agent limit
   - Graph context limits

### Gate

Choose one profile to test first.

Do not implement until the chosen profile is approved.

## Phase 4: Settings-Only Calibration

Goal: change only settings from the Settings UI or Supabase. Do not change code.

### Steps

1. Apply the approved model and parameter settings.
2. Keep prompts unchanged at first.
3. Run a controlled test set:
   - Simple chat question
   - Normal RAG question
   - Professional / Knowledge Base question
   - Delay / blocker question
   - Source-heavy question
   - QA / AI Report generation
4. For each run, inspect:
   - Classifier output
   - Knowledge vocabulary decision
   - Whether Knowledge Planner ran
   - Hybrid search result count
   - Reranker behavior
   - Tool calls
   - Main Agent input
   - Main Agent answer
   - Source links
   - Missing-info section
5. Record what improved, what got worse, and what stayed unchanged.

### Gate

Move to Phase 5 only if settings-only calibration is not enough.

If settings-only calibration works, stop and document the final settings.

## Phase 5: Prompt Calibration

Goal: reduce prompt size and improve routing only after settings are stable.

### Steps

1. Review the classifier prompt.
2. Shorten or clarify classifier only if routing is wrong or too expensive.
3. Review the Knowledge Planner prompt.
4. Tighten Knowledge Planner only if it returns too much, too little, or unclear JSON.
5. Review the reranker prompt.
6. Tighten reranker only if ranking quality is poor or token use is too high.
7. Review the Main Agent prompt.
8. Change Main only if:
   - It ignores the Knowledge Base plan
   - It treats Knowledge Base guidance as project evidence
   - It misses retrieved facts
   - It overstates weak evidence
9. Make only one prompt change at a time.
10. Re-run the same controlled test set after each prompt change.

### Gate

Move to Phase 6 only for confirmed runtime/settings mismatches that cannot be fixed through settings or prompts.

## Phase 6: Code Fixes Only If Needed

Goal: touch code only for confirmed issues.

### Possible Issues

1. A setting appears in the UI but the backend ignores it.
2. A max-token setting exists but one runtime path hardcodes a different value.
3. Knowledge Planner runs too often.
4. Knowledge Planner does not run when it should.
5. Reranker sends too much text per candidate.
6. QA uses an expensive model despite settings.
7. Alert Agent uses a different model than the settings indicate.
8. Workflow logs do not expose enough information to evaluate cost or routing.

### Steps

1. Pick one confirmed issue.
2. Write the smallest code change that fixes only that issue.
3. Run automated tests.
4. Run the relevant manual chat test.
5. Confirm the issue is fixed.
6. Move to the next confirmed issue only after approval.

### Gate

No batch fixes. No broad refactors.

Move to Phase 7 only after all required code fixes are validated.

## Phase 7: Final Knowledge Base Readiness Test

Goal: verify the chat is using the Knowledge Base correctly after calibration.

### Test Questions

1. `מהם החסמים המרכזיים בפרויקט?`
2. `מי היה הספק שגרם לעיכוב?`
3. `מה הקריטריונים לזהות עיכוב אמיתי בפרויקט?`
4. `האם היו סיכונים שדורשים פעולה?`
5. A normal project factual question that should not trigger Knowledge Base.
6. A casual chat question that should route to Lite.

### Success Criteria

1. Knowledge Base triggers only for professional, methodology, glossary, or domain-reasoning questions.
2. Main Agent uses Knowledge Base as planning guidance only.
3. Main Agent does not treat Knowledge Base as project factual evidence.
4. Project facts come from retrieval, tools, graph, or source records.
5. Source links remain correct.
6. The answer is still useful after lowering cost.
7. The selected calibration profile reduces token/cost pressure compared with the baseline.

## Working Rule

For every phase:

1. Map first.
2. Review together.
3. Approve the next action.
4. Change only what belongs to the current phase.
5. Test.
6. Document the result.
7. Move on only after confirmation.

# Calibration Progress Log

This section records what was actually calibrated, tested, and decided per agent. It is intentionally broader than QA: it includes routing, runtime contracts, prompt/model decisions, cost observations, workflow evidence, and follow-up gates.

## 2026-06-25 To 2026-06-27: QA Agent As Calibration Tool

### Scope

The QA / AI Report Agent was upgraded first because it is the evaluator for the rest of the pipeline. The goal was not only to improve a customer-facing report, but to make the internal workflow understandable enough to calibrate every agent.

### What Changed

- Added a deterministic `qa_run_summary` input so the QA Agent can inspect every workflow step without relying only on raw logs.
- Expanded the QA output contract from a compact failure report into a full internal audit:
  - `agent_audit`
  - `pipeline_timeline`
  - `retrieval_review`
  - `grounding_review`
  - `cost_review`
- Added a 6000-token minimum output budget for full QA reports.
- Updated the UI so QA cards show compact fields plus the full audit sections and raw QA JSON.

### What We Learned

- The original QA report was useful but too compact for calibration.
- Full QA Audit now exposes which agent failed, which agent was skipped, what each agent saw, and where cost was spent.
- The QA Agent can now be used as the inspection layer for Planner, Reranker, Main, and future agents.

### Test Evidence

- Live baseline disliked message `1255` was analyzed.
- QA generated valid full-audit JSON with per-agent audit and timeline entries.
- UI displayed:
  - Agent Audit
  - Pipeline Timeline
  - Retrieval Review
  - Grounding Review
  - Cost Review
  - Raw QA JSON

### Known Limits

- QA quality depends on the workflow log and summaries being complete.
- Old reports may still show only the compact view.
- Full Node test suite still has unrelated pre-existing UI/source assertions outside the QA changes.

## 2026-06-27: Professional Knowledge Planner Calibration

### Agent

| Field | Value |
| --- | --- |
| Agent | Professional Knowledge Planner |
| Runtime step | `knowledge_planner` |
| Main backend path | `src/agent.js` |
| Prompt source | `prompts.knowledge_planner` / `src/prompts.js` |
| Current tested model | `google/gemini-2.5-pro` |
| Previous model considered acceptable | `openai/gpt-4o-mini` |
| Main mission | Convert Knowledge Base guidance into a compact search and reasoning plan for the Main Agent |
| Important output fields | `domain_summary`, `relevant_terms`, `decision_criteria`, `rag_queries`, `recommended_tools`, `risks_or_cautions` |

### Why We Looked At It

The Planner is cheap compared with Main, but its output affects retrieval and reranker input. If it returns malformed JSON or runs in the wrong cases, the rest of the pipeline becomes harder to evaluate.

### Changes Made

This phase was not just a prompt change.

- Switched the tested Planner model to `google/gemini-2.5-pro` through settings.
- Found that Gemini produced useful content but once failed the required JSON contract.
- Added runtime JSON enforcement for Planner calls:
  - `responseFormat: { type: "json_object" }`
- Added one schema-only repair attempt before falling back.
- Added `planner_json_repaired: true` when repair succeeds, so QA can expose the recovery.
- Added a regression test:
  - `knowledge planner enforces JSON response format and repair before fallback`

### Automated Checks

| Check | Result |
| --- | --- |
| `node --check src\agent.js` | Pass |
| `node --check test\run-tests.js` | Pass |
| Planner JSON enforcement regression | Pass |
| Full `npm.cmd test` | Non-zero due to unrelated existing assertions outside Planner work |

### Manual UI Calibration Tests

| Test | Expected behavior | Result |
| --- | --- | --- |
| `What were the significant delays in March?` | Planner runs and returns useful delay/search criteria. | Pass |
| `How do we decide whether a blocker is a real project delay?` | Planner runs, returns valid JSON, focuses on methodology, and does not invent project facts. | Pass after JSON hardening |
| `Hello, how are you?` | Planner does not run. | Pass |
| `What is the status of the latest invoice?` | Planner does not run for a non-professional invoice/status route. | Pass |

### Latest Invoice Evidence

The invoice/status test showed:

- Classifier: `type: RAG`
- `tool_hint: financial_transactions,meetings`
- `professional: false`
- `knowledge_tags: []`
- Knowledge vocabulary checked and found no match.
- `knowledge_planner` did not run.
- Hybrid search showed `plannedQueries: 0`.

This confirms the Planner is not adding cost or methodology to a normal project-status question.

### Cost Observations

Example Planner run with Gemini:

- Model: `google/gemini-2.5-pro`
- Total tokens: about `3713`
- Cost: about `$0.01746`
- Latency: about `15.4s`

This is acceptable for professional/methodology questions, but should remain gated so it does not run on ordinary project questions.

### Planner Decision

Planner calibration gate is complete.

Current policy:

- Keep Planner available for professional/methodology/delay reasoning questions.
- Do not optimize Planner further until Reranker and Main are checked.
- Treat Main context size as the bigger cost risk.

## 2026-06-27: Downstream Cost Finding From Planner Tests

Planner testing repeatedly confirmed that Planner is not the main cost danger.

Examples:

- Methodology/blocker run:
  - Planner: about `$0.01746`, `3713` tokens.
  - Main: about `$0.24927`, `175869` tokens.
- Invoice/status run:
  - Reranker: about `18898` tokens.
  - Main: about `$0.19429`, `126787` tokens.
  - Main hit `finish_reason: length` / `MAX_TOKENS`.

Conclusion:

- Planner cost is acceptable when correctly gated.
- Reranker token use needs inspection.
- Main context size and answer truncation are high-priority calibration targets after reranker validation.

## Next Agent: Reranker Calibration Gate

### Agent

| Field | Value |
| --- | --- |
| Agent | Reranker |
| Runtime step | `reranker` |
| Main backend path | `src/openrouter.js` and `src/agent.js` call site |
| Current model observed | `openai/gpt-4o-mini` |
| Main mission | Rank retrieved candidate records by relevance before Main synthesis |
| Current risk | High candidate text can create large token usage, and weak ranking can cause Main to synthesize from poor evidence |

### What To Test After Updating The Reranker Prompt

Run the same questions before/after prompt changes when possible:

1. `What were the significant delays in March?`
2. `Who caused the significant delays in March?`
3. `Which blockers delayed work, and which were only risks?`
4. `What is the status of the latest invoice?`
5. `What project issues still require immediate action?`

### Measurements To Record Per Run

- `hybrid_search.records`
- `reranker.candidates`
- `reranker.records`
- reranker model
- reranker prompt tokens
- reranker completion tokens
- reranker total tokens
- reranker cost
- reranker latency
- QA Full Audit decision for `reranker`
- Whether Main improved, stayed stable, or got worse

### Reranker Pass Criteria

- Reranker returns valid structured ranking output.
- QA marks `reranker` as `good` or does not name it as a root cause.
- Top records directly answer the user question.
- Delay questions prioritize actual project-impact delays, not generic schedule guidance or meeting lateness.
- Responsibility questions prioritize records with explicit actor, cause, supplier, dependency, or approval evidence.
- Invoice/status questions prioritize invoice/payment records and recent dated evidence.
- Reranker does not keep many duplicates while dropping distinct important evidence.
- Token/cost stays reasonable for the candidate count, or the higher cost clearly improves evidence quality.

### Reranker Fail Signals

- QA says reranker missed important evidence.
- Main answer worsens because selected evidence is weak or irrelevant.
- Top results are semantically related but not answer-bearing.
- Generic Knowledge Base/planning records outrank project evidence.
- Dated questions are answered from undated or stale records when dated records exist.
- Duplicate chunks dominate the selected evidence.

### Proceed Decision

Do not move to Main prompt/context stabilization until the reranker test set is checked and the reranker is no longer a likely source of poor evidence selection.

## 2026-06-29: Main Agent Prompt Calibration

### Agent

| Field | Value |
| --- | --- |
| Agent | Main RAG Agent |
| Runtime step | `main_agent` |
| Main backend path | `src/agent.js` |
| Prompt source | `prompts.main` / `src/prompts.js` |
| Current tested model | `google/gemini-2.5-pro` |
| Main mission | Synthesize the final grounded answer from retrieval, graph, tool results, Knowledge Planner guidance, and conversation context |

### Why We Calibrated It

Reranker tests showed acceptable reranker behavior, but Main remained the largest risk:

- Very high input-token usage in several runs.
- Occasional `MAX_TOKENS` truncation.
- QA sometimes flagged missing citations or unsupported claims.
- "Latest" questions sometimes produced a useful list, but did not always identify the single latest dated record first.

### Prompt Change Made

This was a targeted prompt tightening, not a full rewrite.

Added `Answer Precision Rules`:

- For `latest/current/recent/last` questions, identify the single latest dated supported record first.
- Sort multiple relevant records by support and recency.
- Cap normal list answers to the strongest `5-7` supported findings unless the user explicitly asks for a full list.
- Every factual bullet must have a directly matching citation when a source URL is available.
- Claims without direct support or citation should move to uncertainty/missing information instead of being presented as fact.
- For cause/blame/accountability/responsibility questions, use `caused by` only when a project record explicitly links the actor or dependency to the delay, issue, or outcome.
- Prefer a short complete answer over a long answer that risks unsupported claims or missing citations.

Also made the citation rule explicit:

- Do not create a separate sources section at the bottom.

### Automated Checks

Added prompt regression assertions in `test/run-tests.js` for:

- Latest-record-first behavior.
- Strongest `5-7` finding cap.
- Explicit `caused by` restriction.
- Inline source-link rule.
- No separate sources section at the bottom.

### Manual Main Agent Validation Gate

Run these after the prompt is active in the UI/runtime:

1. `What is the status of the latest invoice?`
2. `Who caused the significant delays in March?`
3. `Which blockers delayed work, and which were only risks?`
4. `What were the significant delays in March?`
5. `What project issues still require immediate action?`

Record detailed Main validation results in:

- `docs/main-agent-calibration-results.md`

### Main Pass Criteria

- QA marks `main_agent` as `good` or at least does not name it as root cause.
- No `MAX_TOKENS` truncation.
- Every factual bullet has a direct source link when a source URL exists.
- Latest invoice answer starts with the single latest dated supported invoice/payment record and its status.
- Responsibility answers do not claim a party "caused" a delay unless the source explicitly supports causation.
- Blocker/risk answers separate realized blockers from possible risks.
- Broad answers are capped and do not over-expand into weak or duplicate records.

### Known Remaining Non-Prompt Issue

The Main prompt is now more precise, but the largest remaining improvement is probably payload/context reduction:

- `retrieval_results` and `retrieval_context` may duplicate evidence.
- Graph, tool, source, and reranker payloads can make Main input very large.
- Prompt changes can improve answer discipline, but code-level context compaction will likely be needed for major cost reduction.

### Early Main Validation Signal

The first five Hebrew Main validation runs support the non-prompt diagnosis:

- M1 latest invoice: partial answer behavior, but raw URL leakage and `MAX_TOKENS`.
- M2 March delay responsibility: QA named `main_agent` as root cause for missing direct citations and incomplete evidence use, with `180280` total Main tokens and `MAX_TOKENS`.
- M3 blockers vs risks: QA marked Main `good`, but Main still hit `MAX_TOKENS`, raw URL leakage persisted, and Knowledge Planner fell back after JSON repair failed.
- M4 significant March delays: Main answer behavior passed and finished with `STOP`, but still used `175380` Main tokens and cost `$0.2388775`.
- M5 immediate action topics: answer was useful but QA named `main_agent` as root cause, quality was `incomplete`, direct source links were missing for most claims, raw URL leakage persisted, and Main used `162849` total tokens with `MAX_TOKENS`.

Current conclusion: the Main prompt is now tight enough to expose the real bottleneck. Further prompt tightening alone is unlikely to fix the dominant failures. The next implementation phase should be Main payload/context compaction and source-link normalization.

## 2026-06-29: Main Agent Validation Summary

### What We Changed

- Kept `google/gemini-2.5-pro` for Main because the successful runs show strong synthesis quality.
- Tightened Main prompt rules for:
  - latest/current questions,
  - broad list answers,
  - direct citations per factual bullet,
  - unsupported or uncited claims,
  - cautious responsibility/causation language.
- Added prompt regression assertions so these precision rules stay present.
- Created the manual validation log:
  - `docs/main-agent-calibration-results.md`

### Manual Tests Completed

| Test | Question type | Main behavior | Runtime/cost result | Decision |
| --- | --- | --- | --- | --- |
| M1 | latest invoice/status | Mostly useful, latest item surfaced first, but raw URL leakage | `117119` tokens, `$0.18220375`, `MAX_TOKENS` | Partial/fail |
| M2 | delay responsibility | Useful but citation failure; QA root cause `main_agent` | `180280` tokens, `$0.261155`, `MAX_TOKENS` | Fail |
| M3 | blockers vs risks | QA marked Main `good`, but raw URL leakage and Planner fallback | `130515` tokens, `$0.19894875`, `MAX_TOKENS` | Partial |
| M4 | significant March delays | Best answer behavior; focused and completed | `175380` tokens, `$0.2388775`, `STOP` | Answer pass, cost fail/watch |
| M5 | immediate action topics | Useful list but QA root cause `main_agent`; missing source links | `162849` tokens, `$0.23936625`, `MAX_TOKENS` | Partial/fail |

### Main Agent Decision

The Main model choice is acceptable for now. The bigger issue is not model intelligence.

Main failures are dominated by:

- oversized context,
- duplicated retrieval/tool/source payloads,
- inconsistent citation mapping,
- raw URL leakage,
- output truncation,
- noisy conflict detection feedback.

### Next Required Phase

Implement Main context compaction before further prompt/model changes.

Detailed implementation plan:

- `docs/main-agent-context-compaction-plan.md`

Target changes:

1. Build a compact `evidence_records` payload for Main.
2. Deduplicate retrieval records before Main by URL/title/date/text fingerprint.
3. Cap default Main evidence to the strongest `8-12` records unless the answer mode explicitly needs a larger list.
4. Send structured source IDs and metadata to Main instead of encouraging raw URLs in generated text.
5. Move URL rendering to the UI/source renderer wherever possible.
6. Summarize graph relationships before Main when graph result count is high.
7. Add answer-mode templates for latest status, responsibility, blockers-vs-risks, delay lists, and immediate actions.

### Next Phase Tests

Retest M1-M5 after context compaction and compare:

- Main prompt tokens,
- Main completion tokens,
- Main total cost,
- finish reason (`STOP` vs `MAX_TOKENS`),
- QA root cause step,
- direct source-link coverage,
- raw URL leakage,
- answer usefulness in the chat UI.

Proceed only if Main token use drops materially and M1-M5 no longer repeatedly hit `MAX_TOKENS`.
