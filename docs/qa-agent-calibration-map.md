# QA Agent Calibration Map

Date: 2026-06-24

Status: mapping complete; no runtime code, prompt, or settings changes made.

## Purpose

The QA Agent should serve two roles:

1. Product feature: generate an internal QA / AI report for one completed chat run.
2. Calibration tool: help diagnose routing, retrieval, reranking, Main grounding, citations, cost, and workflow quality.

This document maps the current implementation before changing the agent.

## Runtime Map

| Item | Current behavior |
| --- | --- |
| Single-run QA endpoint | `POST /api/qa/:messageId/run` in `src/server.js` |
| AI report endpoint | `POST /api/ai-report/:messageId/run` in `src/server.js` |
| Trend endpoint | `POST /api/qa/trends` in `src/server.js` |
| Single-run function | `runQaAgent()` in `src/qaAgent.js` |
| Trend function | `runQaTrendAnalysis()` in `src/qaAgent.js` |
| Model key | `config.models.qa` |
| Default model | `openai/gpt-4o`, unless `settings.models.qa`, `QA_MODEL`, or `MAIN_MODEL` override it |
| Single-run prompt source | `config.prompts.qa`, falling back to `QA_SYSTEM_PROMPT` |
| Trend prompt source | Internal `TREND_SYSTEM_PROMPT` constant |
| Single-run temperature | `config.ai.qa.temperature`, default `0.1` |
| Single-run max output tokens | `config.ai.qa.maxTokens`, default `3000` |
| Single-run timeout | `config.ai.qa.timeoutMs`, default `90000` |
| Single-run sampling controls | `topP`, `frequencyPenalty`, `presencePenalty`, and `seed` from `config.ai.qa` |
| Trend temperature | Hardcoded `0.1` |
| Trend max output tokens | Hardcoded `3000` |
| Trend timeout | OpenRouter default, because no `timeoutMs` is passed |
| Input payload | `user_message`, `ai_response`, full `workflow_log`, optional `user_feedback` |
| Output contract | JSON report with summary, root-cause steps, step issues, recommendations, answer quality, and confidence |
| Persistence | `qa_reports` table through `saveQaReport()` |
| UI entry point | QA tab in `public/app.js`; messages with `workflow_log` can be filtered and analyzed |

## Current Strengths

- The single-run QA path already honors the configurable QA model and most `ai.qa` settings.
- The QA UI supports user feedback before running analysis.
- QA reports are persisted and can be reused for trend analysis.
- The chat workflow log already includes `workflowLog.openRouterUsage` for normal chat model calls, including prompt tokens, completion tokens, generation IDs, latency, and cost when OpenRouter returns it.
- The QA prompt tells the model to separate retrieval failure from answer-generation failure and to avoid blaming skipped optional tools by default.

## Important Drift From Older Calibration Notes

The older `docs/rag-model-calibration-documentation` file says that `chatCompletion()` discards usage data. That is no longer fully current.

Current `src/openrouter.js` records telemetry when a caller passes `telemetry`, and `src/agent.js` summarizes it into `workflowLog.openRouterUsage`.

However, the QA Agent itself does not currently pass telemetry into `chatCompletion()`. This means:

- The QA Agent can read cost/token data from the analyzed chat run if the workflow log contains it.
- The QA Agent's own model call cost is not attached to its saved QA report.
- QA Trend model-call cost is also not captured.

## Current Gaps

| Gap | Why it matters | Type |
| --- | --- | --- |
| QA sends the full `workflow_log` JSON to the model | QA can become expensive on large RAG runs, especially after context-heavy Main failures | Cost / token risk |
| QA does not capture its own OpenRouter telemetry | Admin cannot see cost, latency, token count, generation ID, or model used for the QA report itself | Calibration visibility |
| Trend analysis ignores `config.ai.qa` controls | QA trend can have different timeout/token behavior than the configured QA Agent | Settings/runtime mismatch |
| Active QA prompt and fallback QA prompt differ | If saved/default prompt is unavailable or overwritten, behavior can diverge | Prompt consistency |
| QA output parsing uses a broad `{...}` regex | If the model emits surrounding text or nested braces oddly, parsing can be brittle | Robustness |
| QA report schema is only prompt-enforced | Invalid enum values, too many/few recommendations, or malformed arrays are not normalized before saving | Reliability |
| QA sees compacted workflow nodes but may still receive large trace/openRouter payloads | Workflow compaction protects node input/output only; the full log can still grow | Cost / privacy |
| AI report default feedback is shorter than the generalized prompt-pack version | The AI report may under-emphasize cost, token usage, latency, and evidence-backed recommendations | Diagnostic quality |

## Recommended QA Calibration Phases

### Phase QA-1: Map And Test Existing QA

No code changes.

1. Run one QA report on a recent disliked RAG answer.
2. Record:
   - QA model.
   - QA prompt source.
   - QA temperature, max tokens, and timeout.
   - Input workflow log size in characters.
   - Whether analyzed `workflowLog.openRouterUsage` exists.
   - Whether QA report is valid JSON.
   - Whether recommendations reference concrete steps, node IDs, chunks, prompts, or limits.
3. Run QA Trend if at least two QA reports exist.

Gate: confirm whether the current QA report is useful enough to keep as the baseline.

### Phase QA-2: Add QA Cost Telemetry

Small code change.

Add OpenRouter telemetry collection around:

- `runQaAgent()`
- `runQaTrendAnalysis()`

Persist admin-only telemetry in the saved QA report envelope, for example:

```json
{
  "kind": "qa_report",
  "generated_at": "...",
  "report": {},
  "openRouterUsage": {
    "calls": [],
    "totals": {}
  }
}
```

Do not expose this telemetry in customer-facing chat responses.

Gate: saved QA report shows QA model, tokens, latency, and cost when OpenRouter provides usage data.

### Phase QA-3: Compact QA Input

Small code change.

Build a `compactQaWorkflowLog()` payload for QA instead of sending the raw full log. Preserve:

- nodes: id, label, kind, status, compact input/output.
- edges.
- active prompt hashes or short previews, not full prompts by default.
- trace summary by step.
- openRouterUsage totals and per-step call summaries.
- reranker top chunks.
- main answer mode, retrieval counts, source links, conflicts, and errors.

Remove or bound:

- full prompts.
- long retrieved text.
- full tool results.
- oversized traces.
- duplicate source arrays.

Gate: QA report quality stays useful while input size drops substantially.

### Phase QA-4: Normalize QA Output

Small code change.

Use the existing `extractJsonObject()` helper and add validation/normalization for:

- required top-level keys.
- allowed severity enum.
- allowed answer-quality enum.
- recommendation count.
- step issue shape.

Gate: malformed-but-recoverable model output is normalized; unrecoverable output fails with a clear error.

### Phase QA-5: Synchronize QA Prompts

Prompt/config change after QA-1 through QA-4 are stable.

Align:

- `config.prompts.qa` default in `src/prompts.js`.
- `QA_SYSTEM_PROMPT` fallback in `src/qaAgent.js`.
- `TREND_SYSTEM_PROMPT` with the generalized trend prompt.
- AI report default instruction in `src/server.js`.

Gate: runtime `/api/agents` and a real QA report show the intended effective prompt.

## Initial Model Policy To Test

Do not upgrade QA first. The starting comparison should be:

| Profile | QA model | Reason |
| --- | --- | --- |
| Conservative | `openai/gpt-4o` | Keeps current reasoning quality while telemetry/input compaction is validated |
| Balanced | `openai/gpt-4o-mini` | QA output is structured JSON and may be cheap enough without losing diagnostic value |
| Hard-case escalation | `openai/gpt-4o` | Use only when QA reports are generic, miss visible root causes, or fail complex multi-step diagnosis |

## Acceptance Criteria

The QA Agent is ready to use as a calibration tool when:

- It diagnoses the observed run, not imagined missing data.
- It distinguishes classifier, planner, retrieval, reranker, graph/tool, Main, citation, fallback, and rendering failures.
- It reports when the answer is acceptable even if the user disliked it.
- It names concrete steps, fields, chunks, limits, prompts, or model settings in recommendations.
- It uses available token/cost/latency telemetry from the analyzed run.
- Its own report-generation cost is visible internally.
- It does not expose internal telemetry or workflow details to customer-facing chat.
- It can run on compacted logs without losing the evidence needed for useful diagnosis.

## Recommended Next Action

Start with Phase QA-1 using a real disliked run. If the baseline QA report is specific and useful, implement Phase QA-2 next because it is the smallest high-value calibration improvement.
