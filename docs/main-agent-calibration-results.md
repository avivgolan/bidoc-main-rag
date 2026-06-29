# Main Agent Calibration Results

This file records manual UI validation runs for the Main RAG Agent after the Main prompt tightening.

Prompt focus under test:

- Latest/current questions should identify the single latest dated supported record first.
- Broad/list answers should stay concise and prioritize the strongest supported findings.
- Every factual bullet should have a direct source link when available.
- Unsupported claims should move to uncertainty/missing information.
- Responsibility/causation claims should use cautious wording unless the source explicitly supports causation.

## Test M1: Latest Invoice Status

### Run Metadata

| Field | Value |
| --- | --- |
| Test id | `M1` |
| Date/time shown in UI | `17:21:51, 29.6.2026` |
| Saved message id | `1283` |
| Session id | `local_1782742843754_456c7b8b` |
| User question | `מה הסטטוס של החשבונית האחרונה?` |
| Expected behavior | Main should identify the single latest dated invoice/payment record first, state status clearly, cite every factual bullet, and avoid over-expanding. |

### User-Facing Answer Observations

From the chat screenshot, Main answered in Hebrew and listed several invoice records with statuses:

| Item surfaced by Main | Date/month | Status shown | Notes |
| --- | --- | --- | --- |
| `חשבונית מס 0065` | March 2026 | `ממתינה לתיקון` | Appears first and is likely the latest dated item surfaced. |
| `חשבונית מס 170` | February 2026 | `ממתינה לתיקון` | Older than March item. |
| `חשבון חלקי 7` | November 2025 | `טרם שולם` | Older invoice/payment item. |
| `גמר חשבון סמל הרצליה` | November 2025 | `ממתין לאישור` | Older invoice/payment item. |

Answer behavior notes:

- Positive: the answer starts with the newest visible invoice item, `חשבונית מס 0065 (מרץ 2026)`.
- Positive: statuses are explicit.
- Mixed: the answer still expands into multiple invoice records instead of giving a one-sentence "latest invoice" summary first.
- Mixed: source links appear, but one raw Outlook URL is visibly printed at the bottom, which violates the "do not print raw URLs" citation rule.

### Workflow Metrics

| Step | Model / source | Records / tokens | Cost | Latency | Status |
| --- | --- | --- | --- | --- | --- |
| classifier | `openai/gpt-4o-mini` | `1289` total tokens | `$0.00023385` | `1861 ms` | `done` |
| hybrid_search embedding | `text-embedding-3-large` | `29` total tokens | `$0.00000377` | `326 ms` | `done` |
| hybrid_search | Supabase RPC | `40` records, `25` sources, `plannedQueries: 0` | n/a | n/a | `done` |
| graph_search | RPC | `20` records | n/a | n/a | `done` |
| reranker | `openai/gpt-4o-mini` | `17400` total tokens, `40` candidates to `18` records | `$0.0029511` | `41057 ms` | `done` |
| main_agent | `google/gemini-2.5-pro` | `117119` total tokens | `$0.18220375` | `47797 ms` | `done`, but `MAX_TOKENS` |

### Main Agent Card

| Field | Value |
| --- | --- |
| QA decision | `questionable` |
| QA status | `done` |
| Model | `google/gemini-2.5-pro` |
| Total tokens | `117119` |
| Cost | `$0.18220375` |
| Latency | `47797 ms` |
| Input summary | message, tool calls, ranked entity list answer mode, memory messages, `retrieval_records: 18`, `graph_relationships: 20` |
| Output summary | Synthesized invoice-status answer in Hebrew |
| Finish reason | `length` |
| Native finish reason | `MAX_TOKENS` |

### QA Summary

| Field | Value |
| --- | --- |
| QA quality | `acceptable` |
| QA confidence | `medium` |
| QA severity | `medium` |
| QA root cause step | `conflict_detection` |
| QA finding | Conflict detection error: error detecting conflicting evidence across sources. |

### Pass / Fail Against Main Gate

| Criterion | Result | Notes |
| --- | --- | --- |
| Answers in Hebrew | Pass | Answer is Hebrew. |
| Latest record first | Partial pass | First listed item is March 2026, newer than the following records, but the answer could state the single latest invoice summary more directly. |
| Every factual bullet cited | Partial pass | Links are present, but citation quality needs review because a raw Outlook URL appears. |
| No raw URLs | Fail | Raw Outlook URL is visible at the bottom. |
| No unsupported over-expansion | Partial pass | Useful records are listed, but answer still expands beyond a direct latest-status answer. |
| Main not root cause | Pass | QA root cause is `conflict_detection`, not `main_agent`. |
| No `MAX_TOKENS` | Fail | Main hit `MAX_TOKENS`. |
| Cost reasonable | Watch | Main cost is still high at `$0.18220375`. |

### Initial Decision

`M1` is a **partial pass** for answer behavior and a **fail** for runtime/output constraints.

The prompt improvement appears to help ordering and status clarity, but the run still exposes:

- Main context/output size problem.
- Raw URL leakage in the rendered answer.
- `MAX_TOKENS`, meaning the answer may be truncated.
- Conflict detection remains noisy or brittle for invoice/status workflows.

### Follow-Up To Analyze Later

- Determine whether raw URL leakage is caused by Main prompt compliance, frontend link rendering, or source payload formatting.
- Reduce Main payload/context before judging Gemini 2.5 Pro cost as final.
- Consider an invoice-specific answer mode or instruction: one latest item first, then "other recent invoice records" only if needed.

## Test M2: Delay Responsibility In March

### Run Metadata

| Field | Value |
| --- | --- |
| Test id | `M2` |
| Date/time shown in UI | `17:33:10, 29.6.2026` |
| Saved message id | `1285` |
| Run id | `run_1782743590479_b711cb142c40b8` |
| Session id | `local_1782743424065_5167ae23` |
| User question | `מי גרם לעיכובים המשמעותיים בחודש מרץ?` |
| Expected behavior | Main should identify supported responsible parties or contributors cautiously, avoid unsupported blame, cite every factual claim, and separate confirmed responsibility from possible contributors. |

### User-Facing Answer Observations

From the chat screenshot, Main answered in Hebrew and organized the answer around delay contributors:

| Category surfaced by Main | Evidence behavior | Notes |
| --- | --- | --- |
| Client / legal representative, payment and invoice issue | Cited in some bullets | Uses cautious framing around payment delay and work-extension impact. |
| External factor / police | Cited | Discusses external works impact. |
| Supplier / subcontractor examples | Some support visible | Mentions doors/microtopping but QA later says direct citations were lacking. |
| Additional potential contributors | Weak citation behavior | A raw SharePoint URL appears at the bottom of the screenshot. |

Answer behavior notes:

- Positive: the answer does not appear to blame a single party too aggressively.
- Positive: it groups confirmed and potential contributors.
- Mixed/negative: QA says the final answer lacked direct source citations and did not fully use retrieved evidence.
- Negative: raw URL leakage is visible again at the bottom of the answer.

### Workflow Metrics

| Step | Model / source | Records / tokens | Cost | Latency | Status |
| --- | --- | --- | --- | --- | --- |
| classifier | `openai/gpt-4o-mini` | `1377` total tokens | `$0.00028575` | `4732 ms` | `done` |
| knowledge_planner first call | `google/gemini-2.5-pro` | `4079` total tokens | `$0.02245875` | `18395 ms` | `MAX_TOKENS`, invalid JSON |
| knowledge_planner repair | `google/gemini-2.5-pro` | `2667` total tokens | `$0.0189175` | `15920 ms` | `done`, repaired |
| hybrid_search | Supabase RPC | `40` records, `32` sources, `plannedQueries: 2` | mostly cached | n/a | `done` |
| graph_search | RPC | `0` records | cached | n/a | `done` |
| reranker | `openai/gpt-4o-mini` | cached, `40` candidates to `18` records | cached | n/a | `done` |
| main_agent | `google/gemini-2.5-pro` | `180280` total tokens | `$0.261155` | `49490 ms` | `done`, but `MAX_TOKENS` |

### Main Agent Card

| Field | Value |
| --- | --- |
| QA decision | `questionable` |
| QA status | `done` |
| QA issue | `Lacked direct source citations` |
| Model | `google/gemini-2.5-pro` |
| Prompt tokens | `176188` |
| Completion tokens | `4092` |
| Total tokens | `180280` |
| Cost | `$0.261155` |
| Latency | `49490 ms` |
| Input summary | message, tool calls, ranked entity list answer mode, memory messages, `retrieval_records: 18`, `graph_relationships: 0` |
| Output summary | Synthesized Hebrew answer about causes/contributors to March delays |
| Finish reason | `length` |
| Native finish reason | `MAX_TOKENS` |

### QA Summary

| Field | Value |
| --- | --- |
| QA quality | `acceptable` |
| QA confidence | `high` |
| QA severity | `medium` |
| QA root cause step | `main_agent` |
| QA finding | Main final answer lacked direct source citations and did not fully utilize retrieved evidence. |

### Pass / Fail Against Main Gate

| Criterion | Result | Notes |
| --- | --- | --- |
| Answers in Hebrew | Pass | Answer is Hebrew. |
| Responsibility wording cautious | Partial pass | It appears to group contributors rather than assert one cause, but exact phrasing needs full answer review. |
| Every factual bullet cited | Fail | QA explicitly says direct source citations were missing. |
| No raw URLs | Fail | Raw SharePoint URL appears visibly in the answer screenshot. |
| Uses retrieved evidence fully | Fail | QA says not all relevant retrieved evidence was used. |
| Main not root cause | Fail | QA names `main_agent` as root cause. |
| No `MAX_TOKENS` | Fail | Main hit `MAX_TOKENS`. |
| Cost reasonable | Fail/watch | Main cost is high at `$0.261155`. |

### Initial Decision

`M2` is a **fail for Main calibration**.

The prompt improvement was not enough for this responsibility question. The dominant issue is now Main runtime/context behavior:

- Massive prompt size: `176188` prompt tokens.
- Output truncation: `MAX_TOKENS`.
- Direct citation failure despite prompt rules.
- Raw URL leakage.
- QA root cause is `main_agent`.

### Follow-Up To Analyze Later

- Main needs context compaction before further prompt tightening.
- Sending both `retrieval_context` and full `retrieval_results` is likely contributing to excessive input tokens.
- Responsibility/cause answers may need a stricter output template after context is reduced.
- Citation rendering/source payloads need investigation because raw URLs keep leaking into the final answer.

## Test M3: Blockers That Delayed Work Vs Risks

### Run Metadata

| Field | Value |
| --- | --- |
| Test id | `M3` |
| Date/time shown in UI | `17:44:06, 29.6.2026` |
| Saved message id | `1287` |
| Run id | `run_1782744246233_61caeaac2c8168` |
| Session id | `local_1782743424065_5167ae23` |
| User question | `אילו חסמים עיכבו עבודה בפועל, ואילו היו רק סיכונים?` |
| Expected behavior | Main should separate realized blockers/delays from risks, explain the basis for each classification, cite every factual item, and avoid unsupported conclusions. |

### User-Facing Answer Observations

From the chat screenshot, Main answered in Hebrew and used the intended blocker/risk separation:

| Section / behavior | Result | Notes |
| --- | --- | --- |
| Defines what was checked | Pass | Opens with a short explanation of checked sources. |
| Separates actual blockers from risks | Partial pass | Shows a clear section for blockers that delayed work; screenshot does not show the full risk section. |
| Provides reasons for delay classification | Pass/partial | Includes reasons such as halted work, missing progress, and safety/procurement/coordination causes. |
| Uses source links | Partial | Links appear, but raw URL leakage appears again. |
| Concision | Partial | Answer is detailed and may still over-expand. |

Visible examples surfaced:

- Work stoppage in Herzliya project around October-November 2025.
- Hamad'an follow-up work delay in March 2026.
- Several sub-reasons such as missing progress, safety/defect risk, permissions, and coordination.

### Workflow Metrics

| Step | Model / source | Records / tokens | Cost | Latency | Status |
| --- | --- | --- | --- | --- | --- |
| classifier | `openai/gpt-4o-mini` | `1360` total tokens | `$0.0002733` | `4311 ms` | `done` |
| knowledge_planner first call | `google/gemini-2.5-pro` | `4189` total tokens | `$0.022605` | `19284 ms` | `MAX_TOKENS`, invalid JSON |
| knowledge_planner repair | `google/gemini-2.5-pro` | `2977` total tokens | `$0.02109` | `16160 ms` | `MAX_TOKENS`, invalid JSON |
| knowledge_planner final | fallback | n/a | n/a | n/a | failed, fallback used |
| hybrid_search | Supabase RPC | `40` records, `30` sources, `plannedQueries: 0` | cached | n/a | `done` |
| graph_search | RPC | `20` records | cached | n/a | `done` |
| reranker | `openai/gpt-4o-mini` | coalesced/cached, `40` candidates to `18` records | cached | n/a | `done` |
| main_agent | `google/gemini-2.5-pro` | `130515` total tokens | `$0.19894875` | `56091 ms` | `done`, but `MAX_TOKENS` |

### Main Agent Card

| Field | Value |
| --- | --- |
| QA decision | `good` |
| QA status | `done` |
| Model | `google/gemini-2.5-pro` |
| Prompt tokens | `126423` |
| Completion tokens | `4092` |
| Total tokens | `130515` |
| Cost | `$0.19894875` |
| Latency | `56091 ms` |
| Input summary | message, tool calls, memory, retrieval records, graph relationships |
| Output summary | Generated a detailed blocker/risk answer |
| Finish reason | `length` |
| Native finish reason | `MAX_TOKENS` |

### QA Summary

| Field | Value |
| --- | --- |
| QA quality | `acceptable` |
| QA confidence | `medium` |
| QA severity | `medium` |
| QA root cause step | `conflict_detection` |
| QA finding | Conflict detection encountered an error, possibly affecting completeness. |

### Pass / Fail Against Main Gate

| Criterion | Result | Notes |
| --- | --- | --- |
| Answers in Hebrew | Pass | Answer is Hebrew. |
| Separates blockers from risks | Partial pass | Visible answer separates blockers; full risk section needs full-answer review. |
| Every factual bullet cited | Partial | Links are present, but citation quality remains questionable due raw URL leakage. |
| No raw URLs | Fail | Raw SharePoint URL is visible in the answer screenshot. |
| Main not root cause | Pass | QA root cause is `conflict_detection`, not `main_agent`. |
| QA marks Main good | Pass | Main Agent card shows `decision: good`. |
| No `MAX_TOKENS` | Fail | Main hit `MAX_TOKENS`. |
| Cost reasonable | Watch/fail | Main cost remains high at `$0.19894875`. |

### Initial Decision

`M3` is a **partial pass** for answer behavior and a **fail** for runtime/output constraints.

This is the best Main result so far from a QA-agent perspective because Main was marked `good`, but the run still shows unresolved systemic issues:

- Main hit `MAX_TOKENS`.
- Main cost and prompt size remain high.
- Raw URL leakage persists.
- Knowledge Planner failed both initial and repair JSON attempts, so Main received fallback planning rather than the model-generated structured plan.
- QA root cause moved to `conflict_detection`, but the Main runtime constraints remain real.

### Follow-Up To Analyze Later

- Planner max-output/prompt compactness should be revisited because this is another Planner JSON/fallback failure.
- Main payload/context compaction remains the likely next phase.
- Raw URL leakage should be fixed or masked before considering citation behavior complete.

## Test M4: Significant Delays In March

### Run Metadata

| Field | Value |
| --- | --- |
| Test id | `M4` |
| Date/time shown in UI | `18:02:52, 29.6.2026` |
| Saved message id | `1289` |
| Session id | `local_1782745238636_f009f001` |
| User question | `מה היו העיכובים המשמעותיים בחודש מרץ?` |
| Expected behavior | Main should list only the strongest significant March delays, explain schedule/work impact, avoid generic methodology as project evidence, and cite factual findings. |

### User-Facing Answer Observations

From the chat screenshot, Main answered in Hebrew and produced a focused delay list:

| Finding type | Result | Notes |
| --- | --- | --- |
| March delay summary | Pass | Answer directly addresses significant delays in March 2026. |
| "What was checked" section | Pass | Mentions emails, WhatsApp analysis, index summaries, search by delay/risk terms. |
| Specific delay findings | Pass | Includes payment/accounting delay, Hamad'an work stoppage, microtopping/sample approval delay. |
| Potential impact / unresolved items | Pass | Includes a section for potential unresolved impacts. |
| Citation behavior | Mixed | Uses bracket-style source references such as `[8]`, `[10]`; screenshot does not show raw URLs in this run, but link/citation directness should be checked in full answer. |
| Concision | Pass | Shorter and more focused than earlier long answers. |

### Workflow Metrics

| Step | Model / source | Records / tokens | Cost | Latency | Status |
| --- | --- | --- | --- | --- | --- |
| classifier | `openai/gpt-4o-mini` | `1363` total tokens | `$0.0002778` | `4829 ms` | `done` |
| knowledge_planner | `google/gemini-2.5-pro` | `3401` total tokens | `$0.02010625` | `19656 ms` | `done` |
| hybrid_search | Supabase RPC | `40` records, `32` sources, `plannedQueries: 2` | mostly cached + two embedding calls | n/a | `done` |
| graph_search | RPC | `0` records | cached | n/a | `done` |
| reranker | `openai/gpt-4o-mini` | cached, `40` candidates to `18` records | cached | n/a | `done` |
| main_agent | `google/gemini-2.5-pro` | `175380` total tokens | `$0.2388775` | `31558 ms` | `done`, `STOP` |

### Main Agent Card

| Field | Value |
| --- | --- |
| QA decision | `good` |
| QA status | `done` |
| Model | `google/gemini-2.5-pro` |
| Prompt tokens | `173134` |
| Completion tokens | `2246` |
| Total tokens | `175380` |
| Cost | `$0.2388775` |
| Latency | `31558 ms` |
| Input summary | message, tool calls, ranked entity list answer mode, memory messages, `retrieval_records: 18`, `graph_relationships: 0` |
| Output summary | Generated a detailed answer about significant March delays |
| Finish reason | `stop` |
| Native finish reason | `STOP` |

### QA Summary

| Field | Value |
| --- | --- |
| QA quality | `acceptable` |
| QA confidence | `medium` |
| QA severity | `medium` |
| QA root cause step | `conflict_detection` |
| QA finding | Conflict detection encountered an error, possibly affecting completeness. |

### Pass / Fail Against Main Gate

| Criterion | Result | Notes |
| --- | --- | --- |
| Answers in Hebrew | Pass | Answer is Hebrew. |
| Lists strongest delays only | Pass | Visible answer is focused and not overly broad. |
| Explains impact | Pass | Mentions payment, stoppage, sample/mockup approval, and work/payment implications. |
| Avoids generic methodology as evidence | Pass | Answer appears based on project records rather than KB methodology. |
| Every factual bullet cited | Partial pass | Uses references, but direct link quality should be checked in full output. |
| No raw URLs | Pass from screenshot | No raw URL visible in screenshot. |
| Main not root cause | Pass | QA root cause is `conflict_detection`, not `main_agent`. |
| QA marks Main good | Pass | Main Agent card shows `decision: good`. |
| No `MAX_TOKENS` | Pass | Finish reason is `STOP`. |
| Cost reasonable | Watch/fail | Main cost remains high at `$0.2388775`; prompt tokens are `173134`. |

### Initial Decision

`M4` is a **pass for Main answer behavior** and a **fail/watch for cost/context size**.

This is the strongest Main result so far:

- Main was marked `good`.
- No `MAX_TOKENS`.
- Answer is focused and useful.
- No visible raw URL leakage in the screenshot.

However, the runtime payload remains too large:

- `173134` prompt tokens.
- `$0.2388775` Main cost.
- Graph relationships were `0`, so the high token count came mostly from retrieval/tool/source payloads rather than graph volume.

### Follow-Up To Analyze Later

- Use this run as a positive target for answer style.
- Context compaction is still required because even a successful Main answer consumed very high input tokens.
- Conflict detection continues to be a recurring QA root cause even when Main behaves well.

## Test M5: Project Issues Requiring Immediate Action

### Run Metadata

| Field | Value |
| --- | --- |
| Test id | `M5` |
| Date/time shown in UI | `18:24:23, 29.6.2026` |
| Saved message id | `1294` |
| User question | `אילו נושאים בפרויקט עדיין דורשים פעולה מיידית?` |
| Expected behavior | Main should list only currently actionable project issues, prioritize urgency and evidence strength, cite factual claims, and avoid turning generic risks into immediate actions without support. |

### User-Facing Answer Observations

From the chat screenshot, Main answered in Hebrew and produced a useful action-oriented list.

| Finding type | Result | Notes |
| --- | --- | --- |
| Directly answers the question | Pass | The answer lists project topics that still require immediate action. |
| Prioritizes actionable issues | Pass/partial | Visible items include work stoppage, building/coordination issue, 3-month delivery delay, schedule follow-up, unpaid invoices/payment constraints, updated plans, open operational topics, and tasks with missing details. |
| Citation behavior | Fail/partial | Some source links appear, but QA says most claims lacked direct source links. A long raw SharePoint URL appears at the bottom. |
| Concision | Partial | The answer is usable, but still long and appears to hit the output limit. |
| Source hygiene | Fail | Raw URL leakage is visible again. |

### Workflow Metrics

| Step | Model / source | Records / tokens | Cost | Latency | Status |
| --- | --- | --- | --- | --- | --- |
| classifier | `openai/gpt-4o-mini` | `1315` total tokens | `$0.0002481` | `4071 ms` | `done` |
| knowledge_planner | `google/gemini-2.5-pro` | `3113` total tokens | `$0.01857375` | `17135 ms` | `done` |
| hybrid_search | Supabase RPC | `71` records, `16` sources, `plannedQueries: 2` | two embedding calls | n/a | `done` |
| graph_search | RPC | `20` records | n/a | n/a | `done` |
| reranker | `openai/gpt-4o-mini` | `23398` total tokens, `71` candidates to `18` records | `$0.00382335` | `19440 ms` | `done` |
| main_agent | `google/gemini-2.5-pro` | `162849` total tokens | `$0.23936625` | `50901 ms` | `done`, but `MAX_TOKENS` |

### Main Agent Card

| Field | Value |
| --- | --- |
| QA decision | `questionable` |
| QA status | `done` |
| QA issue | `Final answer lacked direct source links for most claims.` |
| Model | `google/gemini-2.5-pro` |
| Prompt tokens | `158757` |
| Completion tokens | `4092` |
| Total tokens | `162849` |
| Cost | `$0.23936625` |
| Latency | `50901 ms` |
| Input summary | message, tool calls, ranked entity list answer mode, memory messages, `retrieval_records: 18`, `graph_relationships: 20` |
| Output summary | Generated final answer with incomplete source links |
| Finish reason | `length` |
| Native finish reason | `MAX_TOKENS` |

### QA Summary

| Field | Value |
| --- | --- |
| QA quality | `incomplete` |
| QA confidence | `medium` |
| QA severity | `medium` |
| QA root cause step | `main_agent` |
| QA finding 1 | Conflict Detection Error: error detecting conflicting evidence. |
| QA finding 2 | Answer Quality: final answer lacked direct source links for most claims. |

### Pass / Fail Against Main Gate

| Criterion | Result | Notes |
| --- | --- | --- |
| Answers in Hebrew | Pass | Answer is Hebrew. |
| Lists current action items | Pass | The visible answer lists relevant operational/action topics. |
| Prioritizes only strongest actionable items | Partial pass | The list is useful, but still broad and long. |
| Every factual bullet cited | Fail | QA explicitly says most claims lacked direct source links. |
| No raw URLs | Fail | Raw SharePoint URL is visible in the chat answer. |
| Main not root cause | Fail | QA root cause is `main_agent`. |
| No `MAX_TOKENS` | Fail | Main hit `MAX_TOKENS`. |
| Cost reasonable | Fail/watch | Main cost remains high at `$0.23936625`; prompt tokens are `158757`. |

### Initial Decision

`M5` is a **partial pass for usefulness** and a **fail for Main calibration constraints**.

The answer is directionally useful, but it repeats the core Main problems:

- Direct source links are missing for many claims.
- Raw URL leakage remains unresolved.
- Main hit `MAX_TOKENS`.
- Prompt size remains extremely high.
- QA names `main_agent` as the root cause.

## Main Agent Validation Summary After M1-M5

### What Improved

- The Main prompt tightening improved answer discipline in some cases.
- M4 shows the target answer style: focused, useful, project-specific, and not truncated.
- M3 and M4 show that Gemini 2.5 Pro can synthesize good answers when the evidence shape is manageable.
- The latest/invoice and causation/responsibility instructions are directionally useful, but not sufficient by themselves.

### What Still Fails

| Problem | Evidence |
| --- | --- |
| Main input is too large | Main prompt tokens ranged from about `117k` to `176k` across M1-M5. |
| Main often hits output limit | M1, M2, M3, and M5 hit `MAX_TOKENS`. |
| Main cost is too high | Main cost ranged from about `$0.18` to `$0.26` per tested run. |
| Direct citation behavior is inconsistent | M2 and M5 explicitly failed direct-source-link checks; M1/M3 leaked raw URLs. |
| Raw URL leakage persists | Visible in M1, M2, M3, and M5 screenshots. |
| Conflict detection is noisy/brittle | QA repeatedly flags `conflict_detection`, even when Main answer quality is acceptable. |

### Current Decision

Do **not** keep tightening only the Main prompt as the next step.

The next phase should be a Main payload/context compaction phase. Prompt quality is now good enough to expose the real bottleneck: Main receives too much duplicated or overly verbose evidence, then spends too many tokens and sometimes truncates before completing citation-safe answers.

### Recommended Next Phase

Implement Main context compaction before another model or prompt change:

- Send Main a compact `evidence_records` payload instead of full duplicated retrieval/tool/source blobs.
- Deduplicate records by source URL, title, date, and text fingerprint before Main.
- Cap default Main evidence to the strongest `8-12` records, with an explicit exception for true list/full-report mode.
- Keep source metadata structured: `source_id`, `title`, `date`, `url`, `record_type`, `why_relevant`, `evidence_excerpt`.
- Prevent raw URLs in generated answer text by giving Main source IDs and letting the renderer map IDs to links.
- Summarize graph relationships before Main instead of sending full graph payloads when many relationships exist.
- Add answer-mode templates for `latest_status`, `responsibility`, `blockers_vs_risks`, and `immediate_actions`.
- Retest M1-M5 after compaction and compare Main prompt tokens, cost, finish reason, QA root cause, and citation behavior.
