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
