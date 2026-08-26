# Schedule-activity assignment agent — V2 review package

Status: V2.1 structured prompts and configuration published to remote settings; human-labelled accuracy validation remains deferred  
Version: `schedule-assignment-openai.v2.1-rc1`

## Executive summary

V2.1 improves the existing agent with the CTO-approved GPT-4o allocation and a stricter write policy. The main change is a reliable contract around each model role: a consistent OpenAI-style prompt structure, complete bounded alert evidence, strict server-owned Structured Outputs, calibrated scores, Hebrew explanations and immutable prompt/schema fingerprints. Publication also removed drift in the remote `draft-v1` settings, which had introduced unapproved GPT-5-family role models and a 50% automatic-assignment threshold.

The model allocation remains:

| Role | Model | Purpose | Invocation |
|---|---|---|---|
| Time filter | `openai/gpt-4o-mini` | High-recall check for schedule relevance | Batch flow only, when deterministic signals are absent |
| Event extractor | `openai/gpt-4o-mini` | Extract factual scope, trade, location and date | Once per full assignment run |
| Professional matcher | `openai/gpt-4o-mini` | Compare event scope against bounded Gantt candidates | Once per full assignment run |
| Schedule validator | `openai/gpt-4o-mini` | Independently validate date, hierarchy, scope and conflicts | Once per full assignment run |
| Conditional judge | `openai/gpt-4o` | Resolve disagreement, ambiguity or a near-threshold result | Only when required |
| Semantic embedding | `openai/text-embedding-3-large` | Rerank the bounded candidate set | Bounded by candidate limit |

## What changed

1. Every Chat role now follows the same visible prompt template: `# Identity`, `# Objective`, `# Instructions`, `# Examples`, `# Output Semantics`, `# Failure Behavior`, and `# Context`.
2. Each prompt includes bounded positive, ambiguous/negative, and injection-resistant examples relevant to its single responsibility.
3. Legacy `json_object` mode and prompt-embedded JSON schemas were replaced by `json_schema` with `strict:true`.
4. Each role has a separate schema name and version. Schemas are owned by the server and cannot be replaced by alert text.
5. Dynamic event/candidate data remains in the user message; stable role instructions remain in the `system` message. A live OpenRouter run verified this role with the approved GPT-4o models.
6. The model receives bounded title, description, question, answer, hashtags, alert type, canonical date, severity and status. Previously most of this evidence was dropped.
7. Every candidate score is explicitly defined on a 0–100 scale. This fixes a reproduced defect in which the validator returned `1` for a strong match while the engine interpreted it as 1%.
8. Reasons are written in Hebrew for Hebrew inputs. Unsupported candidate reasons are classified as contradicting evidence rather than supporting evidence.
9. Runtime audit now includes engine version, settings version, configuration snapshot ID, prompt hash, schema name and schema version.
10. Settings now identifies the active publication status, prompt version, publication time, configuration snapshot, instruction role and schema beside each role. Reload fetches the protected full settings again so prompt text is not replaced by the sanitized public snapshot.

## Role behavior

### Time filter

Goal: skip only confidently irrelevant alerts. Plausible or uncertain schedule relevance continues to the complete flow. The role may use only explicit evidence and must not treat source text as instructions.

Output contract: `schedule_time_relevance_v2` — decision, confidence 0–100, reason and evidence signals.

### Event extractor

Goal: preserve only evidenced event type, subjects, locations, trades, keywords and canonical date. Missing values remain empty or null. The extractor is prohibited from selecting a Gantt activity.

Output contract: `schedule_event_extraction_v2`.

### Professional matcher

Goal: rank only supplied candidates using scope, trade, component, location and event meaning. Dates are supporting evidence because the validator independently owns schedule consistency. A score above 90 requires specific positive evidence, not a generic shared construction term.

Output contract: `schedule_activity_match_v2` — a bounded score and reason per supplied candidate, selected key and `match | ambiguous | no_match | conflict` decision.

### Schedule validator

Goal: independently test date range, specificity, hierarchy, milestone semantics, location, trade and scope. Missing evidence is uncertainty, not automatically a hard conflict.

Score calibration:

- 90–100: specific scope, location and date consistency.
- 70–89: likely match with one missing discriminator.
- 40–69: partial support.
- 0–39: unsupported or incompatible.

Output contract: `schedule_activity_validation_v2`, including an explicit `hardConflict` for every candidate.

### Conditional judge

Goal: make a conservative final determination only when earlier roles disagree, remain ambiguous or are near the threshold. It must prefer abstention over a weak guess and must explain the winner against the runner-up or identify the missing/conflicting evidence.

Output contract: `schedule_assignment_judgement_v2`.

## Published policy and configuration

- Automatic-assignment threshold: 90%.
- Minimum runner-up margin: 12 points.
- Suggestion threshold: 45%.
- Time-filter negative confidence threshold: 80%.
- Judge near-threshold range: 8 points.
- Maximum candidates: 20.
- Maximum Chat role invocations: 4.
- Automatic write requires all server-side gates, including Matcher/Validator agreement, no hard conflict, canonical date, active schedule activity, fresh unassigned source and successful AI completion.
- Model output can select only an activity key already supplied by the server.

## Verification evidence

- `npm.cmd run test:schedule`: 83 tests passed.
- `npm.cmd run react:build`: passed.
- Synthetic Hebrew dry-run: expected flooring activity ranked first in deterministic, semantic and final stages.
- Strict output compatibility: no role failures and no JSON/schema failures across four Chat calls and six embedding calls.
- Validator scale correction: model consensus increased from 0.48 to 0.925; final confidence increased from 79.96% to 87.38%.
- Safety behavior: zero database writes and no automatic assignment because the unchanged 90% gate was not met.
- Fresh remote reload: `schedule-assignment-openai.v2.1-rc1`, `valid:true`, matching role/schema/prompt hashes and published snapshot.

## What this does and does not prove

This release proves that the approved models can execute the V2 prompt/schema contracts, that the persisted configuration reloads correctly, and that the server remains conservative. One synthetic case does not prove production accuracy. The V2 configuration was published after explicit approval to proceed without the unavailable live dataset; it must still be compared on a frozen human-labelled set containing confirmed matches, rejected matches, no-match, stale-activity, irrelevant and ambiguous cases before claiming production quality. The acceptance priority is zero false automatic assignments; coverage and abstention can then be tuned without weakening safety silently.

## Publication record and deferred live validation

On 2026-08-26 the approved Kapaim APP DATA project returned HTTP 522 for the dataset preparation queries. A direct read-only SQL health query through Supabase management also timed out, while API logs showed 522 responses across unrelated existing tables and RPCs that had returned 200 earlier. This is a project-wide connectivity outage, not evidence of a missing Schedule table or bad query. MAIN is not a valid substitute for labelled accuracy evidence because it has no human assignment-link tables and no Gantt rows.

After explicit approval to defer that dataset work, the V2 prompt/configuration section was published independently to MAIN `agent_settings`. V2.1 subsequently replaced the flat prompt prose with the reviewed OpenAI-style structure without changing the approved models, weights or safety gates. A pre-publication rollback snapshot was stored locally, every unrelated settings section was verified unchanged, and a fresh process reloaded the persisted version, models, instruction roles, prompt hashes, schema names, 90% threshold and 12-point margin. Published snapshot: `schedule-assignment-config:9f2fb7c98d4faae092c69927b92b0e1dcbcb4bd318344f08b7b9557d91d7b4d0`; published at `2026-08-26T17:28:41.905Z`.

Canonical implementation:

- `src/scheduleActivityAssignmentPromptPack.js`
- `src/scheduleActivityAssignmentEngine.js`
- `src/subagents/scheduleActivityAssignmentAgent.js`
- `src/scheduleActivityAssignmentWorkflow.js`
- `src/react/SettingsPage.jsx`
- `scripts/publish-schedule-activity-assignment-v2.mjs`
