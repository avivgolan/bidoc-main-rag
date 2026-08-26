# BiDoc QA & Tuning MCP

## Technical Specification

**Status:** Implementation-ready design<br>
**Version:** 1.0<br>
**Audience:** BiDoc maintainers and Codex/Claude Code implementation agents<br>
**Scope:** QA automation, root-cause analysis, controlled configuration experiments, regression protection, and reversible production promotion

Normative terms such as **MUST**, **SHOULD**, and **MAY** are used in their usual specification sense.

---

## 1. Executive Summary

BiDoc QA & Tuning MCP is a control plane over the existing BiDoc RAG system. It enables an agent to:

1. Define reusable test suites and expected behavior.
2. Run isolated queries through the real BiDoc pipeline.
3. Capture answer, evidence, routing, retrieval, reranking, tools, context, latency, errors, token use, and cost.
4. Evaluate results with deterministic, pipeline, evidence, and LLM-based checks.
5. Identify failure patterns and probable root causes.
6. Propose minimal configuration or prompt changes.
7. Compare a candidate against an immutable baseline on the same tests.
8. Run core regression and golden-test gates.
9. Prepare a human-approved, audited, reversible production change.

The MCP server is an interface, not a second implementation of BiDoc. The QA UI, REST API, and MCP server MUST call the same internal QA and experiment services.

The initial deliverable is deliberately small: **five isolated QA tables and seven MCP tools**. The target control plane contains **22 core tools**, delivered in phases.

---

## 2. Objectives and Non-Goals

### 2.1 Objectives

- Provide repeatable QA for BiDoc domains such as schedules, contracts, safety, meetings, email, WhatsApp, financials, submittals, alerts, and knowledge.
- Diagnose *why* a response failed rather than reporting only a score.
- Test candidate prompts and settings without mutating production configuration.
- Compare quality, stability, latency, and cost using paired baseline/candidate runs.
- Grow regression coverage from reviewed production failures and user dislikes.
- Require explicit human approval before any production mutation.
- Preserve immutable configuration history and support safe rollback.
- Enforce organization, project, role, environment, and budget boundaries server-side.

### 2.2 Non-Goals

- Reimplementing BiDoc retrieval, agents, tools, or answer synthesis inside MCP.
- Replacing the existing BiDoc QA UI or REST API.
- Writing laboratory messages into normal user chat history.
- Allowing an agent to read or modify API keys, credentials, service-role keys, or secrets.
- Letting the QA agent modify production code, database schema, credentials, or integrations.
- Automatically promoting generated tests to golden status.
- Automatically applying a candidate merely because its average score improved.
- Solving statistical significance perfectly in Phase 1.

---

## 3. Architecture

```text
 Codex / Claude / MCP Client          BiDoc QA UI          REST API
              |                            |                  |
              +----------------------------+------------------+
                                           |
                                           v
                              QA / Experiment Service Layer
                     +---------------------+---------------------+
                     |                     |                     |
                QA services          Experiment services    Config services
                     |                     |                     |
                     +---------------------+---------------------+
                                           |
                                           v
                                  Existing BiDoc Core
                     classification -> retrieval -> reranking
                     -> tools -> context -> synthesis -> sources
                                           |
                             +-------------+-------------+
                             |                           |
                      Content/data stores          External tools
```

### 3.1 Required Service Boundaries

The implementation SHOULD expose framework-independent internal functions similar to:

```text
executeBiDocCase()
createTestSuite()
runTestSuite()
evaluateCase()
analyzeRun()
findFailurePatterns()
createConfigSnapshot()
createCandidate()
runExperiment()
compareExperiment()
runRegression()
createChangeRequest()
approveChangeRequest()
applyApprovedChange()
rollbackConfig()
```

MCP handlers MUST validate authorization and input, call these services, and normalize results. They MUST NOT contain duplicated RAG or tuning logic.

### 3.2 Suggested Module Layout

```text
src/
  qa/
    testSuiteService.js
    testCaseService.js
    evaluator.js
    scoring.js
    failureTaxonomy.js
    failureAnalyzer.js
    traceCollector.js
    goldenCases.js
  experiments/
    experimentService.js
    experimentRunner.js
    comparator.js
    regressionRunner.js
    candidateService.js
  tuning/
    configSnapshot.js
    configDiff.js
    promptVersioning.js
    tuningPolicy.js
    changeRequestService.js
    rollbackService.js
  services/
    chatExecutionService.js
    configService.js
  mcp/
    server.js
    context.js
    tools/
      qaTools.js
      configTools.js
      tuningTools.js
      experimentTools.js
      deploymentTools.js
```

---

## 4. End-to-End Control Loop

```text
Select or create suite
        -> capture production baseline snapshot
        -> run isolated baseline cases
        -> capture full traces
        -> evaluate and cluster failures
        -> propose the smallest plausible change
        -> create candidate overlay
        -> run paired experiment
        -> compare quality/stability/latency/cost
        -> run domain + core + golden regression
        -> create change request
        -> human approval
        -> apply with optimistic lock and transaction
        -> create immutable production version
        -> monitor or roll back by creating a new version
```

No experiment may modify live settings. No approved change may be applied if production no longer matches the candidate's baseline.

---

## 5. Delivery Plan

| Phase | Capability | Database additions | MCP tools added | Exit condition |
|---|---|---|---|---|
| **1 — QA Harness** | Suites, isolated execution, traces, scoring, run analysis | Five `qa_*` tables | First 7 tools | A suite can run end-to-end and explain each failure without polluting production chat history. |
| **2 — Experiments** | Snapshots, candidate overlays, failure patterns, paired comparisons | `config_snapshots`, `config_candidates`, `qa_experiments` | 10 additional tools; 17 cumulative | A candidate can be tested against the same baseline/data without changing production. |
| **3 — Controlled Promotion** | Golden/regression gates, approvals, versions, audit, rollback | `config_change_requests`, `config_audit_log` | Final 5 tools; 22 cumulative | Production change is impossible without passed gates, human approval, unchanged baseline, audit, and backup. |
| **4 — Continuous Optimization** | Production-failure intake, reviewed test generation, clustering, trend and tuning memory | Optional derived tables | Reuses core tools; optional extensions | Real failures can become reviewed regression tests and inform future proposals without autonomous production changes. |

### 5.1 Phase 1 Tool Subset

```text
qa_create_test_suite
qa_get_test_suite
qa_add_test_cases
qa_run_query
qa_run_test_suite
qa_get_run
qa_analyze_run
```

---

## 6. Data Model

### 6.1 Existing Tables Retained

| Table | Continued purpose |
|---|---|
| `chat_messages_gf` | Real user conversations and production chat history. QA runs MUST NOT write here by default. |
| `qa_reports` | Existing QA reports for real production answers. A reviewed report MAY later create a regression test case. |
| `agent_settings` | Current configuration source. Snapshots normalize its non-secret effective values; experiments do not mutate it. |

### 6.2 Phase 1 Tables

#### `qa_test_suites`

Stores a named group of tests for a domain.

Key fields: `id`, `name`, `description`, `domain`, `status`, `is_regression`, `is_golden`, `created_by`, timestamps.

Allowed lifecycle SHOULD include `draft`, `reviewed`, `active`, and `deprecated`. Golden designation requires a human reviewer.

#### `qa_test_cases`

Stores each question and its expected behavior.

Key fields: `id`, `suite_id`, unique `case_key`, `question`, optional future `turns`, `expected_behavior`, `tags`, `priority`, `origin`, `is_golden`, `is_critical`, `enabled`, timestamps.

`origin` values: `manual`, `generated`, `production_failure`, `user_dislike`, `bug_report`, or `ground_truth`.

`expected_behavior` is extensible JSON:

```json
{
  "expected_route": "RAG",
  "required_tools": ["meetings"],
  "forbidden_tools": [],
  "required_source_types": ["schedule"],
  "required_source_ids": [],
  "must_have_sources": true,
  "expected_facts": [],
  "forbidden_claims": [],
  "reference_answer": null,
  "max_latency_ms": null
}
```

#### `qa_runs`

Stores one execution of one suite under one immutable configuration reference.

Key fields: `id`, `suite_id`, `run_type`, `status`, `config_snapshot_id`, `candidate_id`, `organization_id`, `project_id`, `data_snapshot_at`, `corpus_version`, `repeat_each`, `options`, `summary`, `usage_metrics`, `estimated_cost`, timestamps, `created_by`.

`run_type`: `baseline`, `candidate`, `regression`, `manual`, or `production_sample`.<br>
`status`: `queued`, `running`, `completed`, `partial`, `failed`, or `cancelled`.

#### `qa_case_runs`

Stores what actually happened for one case repetition. This is the principal diagnostic record.

Key fields: `id`, `run_id`, `case_id`, `repetition`, `status`, `execution_id`, `question`, `answer`, `classification`, `retrieval`, `reranking`, `knowledge`, `tools`, `sources`, `context_trace`, `workflow`, `errors`, `latency_ms`, `usage_metrics`, `raw_result`, timestamps.

`raw_result` permits reevaluation after evaluator changes without paying to rerun BiDoc. Sensitive raw fields MUST be redacted and retention-limited.

#### `qa_evaluations`

Stores the verdict for a case run.

Key fields: `id`, `case_run_id`, `evaluator_version`, `evaluator_model`, `evaluation_profile`, `status`, `overall_score`, `scores`, `passed`, `hard_fail`, `hard_fail_reason`, `failure_codes`, `severity`, `root_cause_domain`, `root_cause_confidence`, `analysis`, `evidence`, `recommendations`, timestamp.

Multiple evaluation records MAY reference one case run so evaluator versions remain comparable.

### 6.3 Phase 2 Tables

#### `config_snapshots`

Stores an immutable, secret-free, canonical effective configuration.

Key fields: `id`, monotonic `version`, `environment`, `organization_id`, optional `project_id`, `config`, `config_hash`, `source`, `parent_snapshot_id`, `created_by`, timestamp.

The snapshot includes prompt versions/values, model identifiers, retrieval/reranking settings, tool policy, subagent settings, and knowledge settings. It MUST contain no credentials or resolved secrets.

#### `config_candidates`

Stores a proposed overlay on one baseline snapshot.

Key fields: `id`, `baseline_snapshot_id`, `status`, `changes`, `reason`, `risk_level`, `policy_validation`, `created_by`, timestamps.

Candidate statuses: `draft`, `ready`, `testing`, `passed`, `failed`, `discarded`, `approved`, `applied`.

#### `qa_experiments`

Stores a paired baseline/candidate comparison.

Key fields: `id`, `name`, `suite_id`, `baseline_snapshot_id`, `candidate_id`, `baseline_run_id`, `candidate_run_id`, `status`, `comparison`, `regression_result`, timestamps, `created_by`.

Experiment statuses: `draft`, `baseline_running`, `candidate_running`, `evaluating`, `regression_running`, `passed`, `failed`, `cancelled`.

### 6.4 Phase 3 Tables

#### `config_change_requests`

Stores a promotion request and its evidence, approval, and resolution.

Key fields: `id`, `candidate_id`, `experiment_id`, `baseline_snapshot_id`, `status`, `recommendation`, `evidence`, `risk_level`, `requested_by`, `approved_by`, `approval_at`, `approval_expires_at`, `applied_snapshot_id`, `resolved_at`, timestamps.

Statuses: `pending`, `approved`, `rejected`, `applied`, `rolled_back`, `expired`, or `conflict`.

#### `config_audit_log`

Stores an append-only record of every configuration-related write or attempted privileged action.

Key fields: `id`, `action`, `actor`, `actor_role`, `organization_id`, `project_id`, `environment`, `entity_type`, `entity_id`, redacted `before`, redacted `after`, `reason`, `request_id`, `idempotency_key`, timestamp.

### 6.5 Optional Phase 4 Derived Tables

- `qa_evaluation_profiles`: versioned domain scoring weights and hard-fail policies.
- `qa_failure_clusters`: persisted failure signatures, case membership, trend counts, and confidence.
- `tuning_learnings`: failure signature -> attempted change -> experiment result -> decision, preventing repeated bad proposals.

### 6.6 Required Indexes and Integrity

At minimum, index suite/case/run foreign keys, run status and creation time, experiment status, candidate baseline, and change-request status. Use a GIN index for `qa_evaluations.failure_codes` and JSON indexes only for demonstrated queries. Enforce organization/project scope in foreign keys or row-level policy where supported. Write tables SHOULD carry creator and timestamp fields. Audit and snapshots are append-only.

---

## 7. Canonical Configuration

A resolved snapshot MUST normalize all non-secret settings relevant to behavior:

```json
{
  "prompts": {
    "classifier": {"version": 12, "value": "..."},
    "knowledge_planner": {"version": 7, "value": "..."},
    "lite": {"version": 4, "value": "..."},
    "main": {"version": 31, "value": "..."},
    "reranker": {"version": 9, "value": "..."},
    "qa": {"version": 6, "value": "..."}
  },
  "models": {
    "classifier": "model-id",
    "main": "model-id",
    "reranker": "model-id",
    "qa": "model-id",
    "embedding": "model-id"
  },
  "retrieval": {
    "hybrid_candidates": 40,
    "rerank_top_k": 10,
    "vector_weight": 0.65,
    "keyword_weight": 0.35
  },
  "tools": {"parallel_limit": 3, "enabled": []},
  "subagents": {},
  "knowledge": {},
  "metadata": {"environment": "production"}
}
```

A candidate is a validated overlay, preferably JSON-Patch-like:

```json
{
  "baseline_snapshot_id": "cfg_142",
  "changes": [
    {
      "operation": "replace",
      "path": "retrieval.rerank_top_k",
      "value": 14
    }
  ]
}
```

Candidate paths MUST be allow-listed. Each path has a risk class, type/range validation, maximum allowed delta, whether it may be tested, and whether production approval is required.

- **SAFE:** prompt candidates, bounded temperature/top-k/weights, and other reversible settings. Safe means experimentable, not auto-deployable.
- **CONTROLLED:** model changes, routing/classifier behavior, tool enable/disable, or globally scoped settings.
- **PROTECTED:** secrets, credentials, schema, access policy, production code, or unrestricted integration settings. The MCP cannot mutate these.

Experiments SHOULD change one variable or one intentionally declared bundle at a time.

---

## 8. Trace Capture

### 8.1 Execution Context

Every case receives a context propagated through the pipeline:

```json
{
  "execution_id": "uuid",
  "environment": "qa",
  "organization_id": "org-id",
  "project_id": "project-id",
  "config_snapshot_id": "cfg-id",
  "candidate_id": null,
  "suite_id": "suite-id",
  "case_id": "case-id",
  "session_id": "qa-isolated-uuid",
  "started_at": "RFC3339 timestamp"
}
```

### 8.2 Required Trace Stages

Capture at least:

```text
input -> sanitize -> classification -> heuristic override
-> knowledge routing -> query planning -> embedding
-> hybrid retrieval -> filters -> deduplication -> graph search
-> reranking -> tool selection -> tool calls/results
-> conflict detection -> context construction
-> main model call -> answer -> source extraction
```

Each step MUST expose: `step`, start/end time, duration, status, safe input/output summary, errors, usage, and cost where available. Prompts, document bodies, tool payloads, personal data, and secrets MUST be redacted or replaced with hashes/IDs unless explicitly required and authorized.

### 8.3 Diagnostic Trace Requirements

- **Retrieval:** query, requested/returned counts, filters, deduplication, ranked source IDs and scores, rerank input/output, and whether each source reached context.
- **Tools:** selected tools, safe arguments summary, start/end, status, result count, and error category. QA MUST block side-effecting tool calls unless an approved sandbox/mock exists.
- **Context:** source ID/type, token count, inclusion, dropped items, and drop reason.
- **Usage:** model/provider ID, calls, prompt/completion tokens, embedding/reranking use, cache status, estimated cost, and latency.

Trace completeness itself is an acceptance criterion. Missing diagnostic data MUST be reported as `TRACE_INCOMPLETE`, not silently interpreted as pipeline success.

---

## 9. QA Evaluation and Scoring

### 9.1 Evaluation Pipeline

Each case is evaluated in this order:

1. **Deterministic checks:** answer exists, required sources/tools are present, forbidden tools are absent, fields exist, latency is within policy, no internal error occurred.
2. **Pipeline checks:** expected routing, target evidence through retrieval/reranking/context, tool selection, tool failure, and context loss.
3. **Evidence checks:** extract answer claims and label them supported, unsupported, or conflicting against captured evidence.
4. **LLM judge:** relevance, completeness, reasoning, clarity, and instruction following. It receives prior findings and does not decide from scratch.
5. **Score and verdict:** apply the versioned domain profile, hard-fail rules, and pass policy.

Deterministic and pipeline findings take precedence over an inconsistent LLM judgment.

### 9.2 Default Score Profile

| Dimension | Default weight |
|---|---:|
| Correctness | 25% |
| Grounding | 20% |
| Completeness | 15% |
| Retrieval | 10% |
| Tool selection | 10% |
| Source quality/citation accuracy | 10% |
| Instruction following | 5% |
| Stability | 5% |

Weights are versioned per domain. Safety SHOULD give greater weight to correctness, grounding, and unsupported claims. Contracts SHOULD emphasize citation accuracy, date reasoning, and cross-source conflicts.

Recommended initial verdict policy: pass at `>= 80`, partial at `60–79.99`, fail below `60`; any hard fail yields fail regardless of score. These thresholds MUST be configuration, not code constants.

### 9.3 Stability

For repeated cases, store `sample_size`, pass agreement, `mean_score`, `min_score`, `max_score`, variance/dispersion, and a normalized `stability_score`. A candidate that raises average quality while materially reducing repeatability SHOULD fail or require explicit risk acceptance.

### 9.4 Hard Fails

Examples include:

- Critical unsupported safety claim.
- Fabricated or mismatched source used to support a material claim.
- Cross-tenant/project data exposure.
- Required golden critical case failure.
- Unapproved side effect during QA.
- Critical instruction or authorization violation.

Hard-fail reasons are policy-coded and versioned.

---

## 10. Failure Taxonomy

The core response-quality taxonomy is fixed and machine-readable:

| Failure code | Meaning | Primary root-cause domain | Typical tuning target |
|---|---|---|---|
| `CLASSIFICATION_ERROR` | Wrong route or intent classification | Model/Prompt or Code/Pipeline | Classifier prompt/model/heuristics |
| `RETRIEVAL_MISS` | Required evidence never retrieved | Retrieval/Data | Query expansion, embeddings, weights, filters |
| `RETRIEVAL_NOISE` | Irrelevant evidence overwhelms useful results | Retrieval/Data | Candidate count, filters, hybrid weights |
| `RERANK_ERROR` | Retrieved evidence is incorrectly discarded/ranked | Retrieval/Data or Code/Pipeline | Reranker prompt/model/top-k |
| `WRONG_TOOL_SELECTION` | Required tool not selected or wrong tool selected | Tools/Integrations or Model/Prompt | Tool-routing prompt/policy |
| `TOOL_FAILURE` | Selected tool fails, times out, or returns invalid data | Tools/Integrations | Integration reliability/configuration |
| `KNOWLEDGE_ROUTING_ERROR` | Query sent to wrong knowledge path | Model/Prompt or Code/Pipeline | Planner/routing logic |
| `CONTEXT_LOSS` | Correct evidence is dropped during context construction | Code/Pipeline | Packing, limits, prioritization |
| `HALLUCINATION` | Material unsupported claim | Model/Prompt | Synthesis prompt/model/grounding policy |
| `SOURCE_MISMATCH` | Citation does not support the associated claim | Model/Prompt or Code/Pipeline | Citation extraction/synthesis |
| `INCOMPLETE_ANSWER` | Correct but materially incomplete response | Model/Prompt | Main prompt/context/synthesis |
| `PROMPT_BEHAVIOR` | Explicit instruction-following defect | Model/Prompt | Relevant prompt |
| `MODEL_LIMITATION` | Failure persists with adequate evidence/instructions | Model/Prompt | Model selection or code workaround |

Operational codes such as `TRACE_INCOMPLETE`, `EVALUATOR_FAILURE`, `TIMEOUT`, `BUDGET_EXCEEDED`, and `AUTHORIZATION_DENIED` are tracked separately from answer-quality failures.

Every diagnosed failure includes severity (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), evidence, root-cause confidence, and one of these action classes:

```text
CONFIG_TUNABLE
PROMPT_TUNABLE
CODE_CHANGE_REQUIRED
DATA_PROBLEM
EXTERNAL_TOOL_PROBLEM
```

Root-cause confidence MUST be evidence-based. Low-confidence suggestions are hypotheses, not conclusions.

---

## 11. MCP Contract Conventions

### 11.1 Authentication Context

The server injects authenticated `actor_id`, `organization_id`, allowed projects, current project, role, and environment. A caller-supplied project ID is only a selector within that allowed scope; it never grants access.

### 11.2 Common Inputs

All write or execution tools MUST accept `idempotency_key`. Expensive tools SHOULD accept a budget object:

```json
{
  "max_cases": 100,
  "max_parallel": 4,
  "max_repeats": 3,
  "max_estimated_cost": 20.0,
  "currency": "USD"
}
```

### 11.3 Common Result Envelope

```json
{
  "request_id": "uuid",
  "status": "succeeded|accepted|partial|failed",
  "data": {},
  "warnings": [],
  "meta": {
    "schema_version": "1.0",
    "created_at": "RFC3339 timestamp"
  },
  "error": null
}
```

Errors contain a stable `code`, safe `message`, `retryable`, and optional safe `details`. Long operations return `accepted` plus a run/experiment ID; clients use read tools for progress. Large result sets use cursor pagination and `detail=summary|failures|full`.

### 11.4 Core 22 Tool Registry

The following contracts specify required concepts; implementation schemas SHOULD add length, enum, UUID, range, and batch limits.

#### Phase 1 — QA Harness (7)

1. **`qa_create_test_suite`** — Input: name, description, domain, regression flag, optional tags, `idempotency_key`. Output: suite ID and lifecycle status. Permission: `QA_OPERATOR`; low-risk write.
2. **`qa_get_test_suite`** — Input: suite ID, optional `include_cases`, cursor/limit. Output: suite metadata and optionally paged case summaries. Permission: `QA_VIEWER`.
3. **`qa_add_test_cases`** — Input: suite ID, batch of case key/question/expected behavior/tags/priority/origin, `idempotency_key`. Output: created, updated, rejected, and validation-error counts with case IDs. Permission: `QA_OPERATOR`; generated cases remain draft/non-golden.
4. **`qa_run_query`** — Input: question, project selector, production/snapshot/candidate config reference, isolated session mode, capture options, optional expected behavior and budget, `idempotency_key`. Output: case execution, trace summary, evaluation, usage, latency, and cost. Permission: `QA_OPERATOR`; read-only production data access.
5. **`qa_run_test_suite`** — Input: suite ID, project selector, config reference, parallelism, repeat count, stop-on-critical flag, budget, `idempotency_key`. Output: accepted run ID, estimated cost, case/repetition count, and status. Permission: `QA_OPERATOR`; expensive execution.
6. **`qa_get_run`** — Input: run ID, `detail=summary|failures|full`, filters, cursor/limit. Output: status, summary, costs, stability, and optionally paged case/evaluation records. Permission: `QA_VIEWER`.
7. **`qa_analyze_run`** — Input: run ID, evaluation-profile ID/version, optional reevaluate flag, `idempotency_key` when persisting. Output: scores, pass rate, severity/failure distribution, critical failures, root causes with confidence/evidence, and recommendations. Permission: `QA_OPERATOR` for persisted compute; viewer for existing result.

#### Phase 2 — Advanced Analysis and Experiments (10; 17 cumulative)

8. **`qa_analyze_suite`** — Input: suite ID, optional run range/config filters/profile. Output: trends, stability, recurring failures, domain metrics, and latest/best run references. Permission: `QA_VIEWER` or `QA_OPERATOR` for recompute.
9. **`qa_find_failure_patterns`** — Input: run or suite ID, minimum cluster size, optional failure/severity filters. Output: clusters with case IDs, shared trace signals, likely root cause, confidence, and evidence. Permission: `QA_OPERATOR`.
10. **`config_get_snapshot`** — Input: `production`, candidate, or snapshot selector plus project/global scope. Output: redacted canonical configuration, snapshot ID/version/hash/source. Permission: `QA_VIEWER`; secrets are never returned.
11. **`config_get_prompt`** — Input: prompt name and snapshot/candidate selector. Output: prompt name, value or authorized redacted view, version, hash, and scope. Permission: `TUNING_ENGINEER`; access may be more restrictive than general snapshot access.
12. **`config_diff`** — Input: two snapshot/candidate selectors. Output: machine diff and semantic summary grouped by prompt/model/retrieval/tools, including risk classification. Permission: `QA_VIEWER`.
13. **`tuning_create_candidate`** — Input: baseline snapshot ID, bounded allow-listed changes, reason, optional proposal/run reference, `idempotency_key`. Output: candidate ID, resolved risk, validation result, effective diff, and status. Permission: `TUNING_ENGINEER`; no production mutation.
14. **`tuning_propose_change`** — Input: analyzed run/cluster ID, target or `auto`, maximum changes, allowed risk level, tuning-learning lookup. Output: ranked minimal proposals with current/proposed values, evidence, confidence, expected trade-offs, and action class. Permission: `TUNING_ENGINEER`; proposal only.
15. **`experiment_create`** — Input: name, suite ID, baseline snapshot ID, candidate ID, project/data scope, options, `idempotency_key`. Output: experiment ID, locked references, estimated workload/cost, and draft status. Permission: `TUNING_ENGINEER`.
16. **`experiment_run`** — Input: experiment ID, repeats, parallelism, budget, stop policy, `idempotency_key`. Output: accepted experiment ID/status and baseline/candidate run IDs. Permission: `TUNING_ENGINEER`; expensive execution.
17. **`experiment_compare`** — Input: experiment ID, profile/version, comparison thresholds. Output: paired per-case and aggregate deltas for quality/stability/latency/cost, improved/same/regressed counts, hard failures, confidence indicators, and recommendation. Permission: `QA_VIEWER`.

#### Phase 3 — Regression and Controlled Promotion (5; 22 cumulative)

18. **`regression_run`** — Input: candidate ID, domain/core/golden suite IDs or policy aliases, repeats, budget, `idempotency_key`. Output: accepted regression run plus golden pass/fail, core delta, critical failures, and final gate status. Permission: `TUNING_ENGINEER`.
19. **`change_request_create`** — Input: candidate ID, experiment ID, regression result ID, reason, `idempotency_key`. Output: change-request ID/status and immutable evidence summary. Permission: `TUNING_ENGINEER`; does not approve or apply.
20. **`change_request_approve`** — Input: change-request ID, decision, reviewer comment, expected evidence hash, `idempotency_key`. Output: approval/rejection record, actor, timestamp, expiry, and next action. Permission: human `TUNING_APPROVER`; MUST NOT silently apply.
21. **`version_list`** — Input: project/global scope, environment, cursor/limit. Output: immutable snapshot/version history with parent, actor, reason, change request, and rollback relationships. Permission: `QA_VIEWER`.
22. **`version_rollback`** — Input: target snapshot ID, current expected snapshot ID, reason, confirmation/approval reference, `idempotency_key`. Output: newly created snapshot ID/version based on the target, audit ID, and deployment status. Permission: human `TUNING_APPROVER`; privileged production mutation.

### 11.5 Recommended Extensions Outside the Core 22

- `qa_generate_test_cases`: draft generation only; human review is required before activation and golden promotion.
- `change_apply`: preferred explicit separation between approval and deployment. Until exposed, application SHOULD occur through a separate protected deployment service/UI, not inside `change_request_approve`.
- `tuning_rebase_candidate`: rebuild a candidate against a newer production baseline after conflict.

---

## 12. Experiment Engine

### 12.1 Isolation and Pairing

- Resolve `effective_config = baseline_snapshot + candidate_overlay` in memory or a QA-scoped config context.
- Never implement an experiment as “write production settings, test, restore.”
- Run baseline and candidate as close together as practical against the same suite and project/data snapshot.
- Record `data_snapshot_at`; add a stable corpus version when available. If the corpus materially changes between arms, mark the comparison invalid.
- Use one independent session per case unless the case explicitly declares a multi-turn scenario.
- Cache keys MUST include config snapshot/candidate identity. Baseline and candidate must not accidentally share an answer cache.
- Side-effecting tools MUST be disabled, mocked, or routed to a QA sandbox.

### 12.2 Comparison

Comparison is paired by case and repetition and includes:

- Overall and dimensional score deltas.
- Pass/partial/fail transitions and critical failures.
- Improved, unchanged, and regressed case counts.
- Stability and variance.
- Total and per-query latency/cost/token/call deltas.
- Failure-code/root-cause shifts.
- Golden and core-regression results.
- Sample size and a confidence/noise indication; formal significance is optional in V1.

A recommendation is one of `REJECT`, `NEEDS_MORE_DATA`, `PROCEED_TO_REGRESSION`, or `ELIGIBLE_FOR_APPROVAL`.

### 12.3 Default Promotion Policy

Recommended initial policy, configurable and versioned:

```text
target suite delta > 0
AND no target critical failures
AND golden pass rate = 100%
AND core critical failures = 0
AND global/core score delta >= -1 percentage point
AND stability does not breach policy
AND latency/cost remain within approved limits
```

An approver may accept a non-critical cost or latency trade-off only with a recorded reason. Hard-fail or golden-gate overrides are prohibited.

---

## 13. Regression and Golden Tests

- A regression run SHOULD combine the target domain suite, a core cross-domain suite, and domain-specific golden suites.
- Suggested golden suites include `golden_general`, `golden_schedule`, `golden_contracts`, and `golden_safety`.
- Golden tests are reviewed, stable, critical invariants. An AI-generated or production-derived case begins as draft and cannot become golden without human review.
- Any required golden failure blocks promotion even when aggregate quality improves.
- Production dislikes and `qa_reports` MAY generate draft candidate tests. Reviewers decide expected behavior, priority, regression membership, and golden status.
- Cases and expected behavior are versioned; a changed expected answer must not rewrite historical run interpretation silently.

---

## 14. Approval, Apply, Versioning, and Rollback

### 14.1 Approval and Apply Are Separate

`change_request_approve` records a human decision. A protected deployment operation then performs apply. Before apply, it MUST verify:

- Request is approved and unexpired.
- Candidate and evidence hashes are unchanged.
- Experiment, regression, and golden gates still pass.
- Current production snapshot equals the candidate baseline.
- Actor is authorized for the exact organization/project/global scope.
- Production is not locked and the candidate still satisfies tuning policy.

If baseline `v110` produced the candidate but production is now `v111`, apply returns `BASELINE_CONFLICT`; rebase and retest are required.

### 14.2 Transactional Apply

The protected apply service SHOULD perform atomically:

```text
verify approval and baseline
-> load and validate candidate
-> create backup snapshot
-> apply configuration
-> read back and validate effective configuration
-> create new production snapshot
-> append audit record
-> commit
```

On failure, roll back the transaction or restore the backup before reporting success.

### 14.3 Rollback

Rollback never deletes history. If `v113` is bad and the user selects `v112`, the system creates `v114` containing the effective configuration of `v112`, with reason and linkage to `v113`. Rollback requires the same scope checks, explicit approval, expected-current-version lock, idempotency, and audit as apply.

---

## 15. Permissions

| Role | Capabilities |
|---|---|
| `QA_VIEWER` | Read suites, cases, runs, analyses, experiments, comparisons, and redacted version history. |
| `QA_OPERATOR` | Viewer capabilities plus create suites/cases, execute queries/suites, and persist analyses. |
| `TUNING_ENGINEER` | Operator capabilities plus read authorized prompts, propose/create candidates, run experiments/regressions, and create change requests. |
| `TUNING_APPROVER` | Review evidence, approve/reject, invoke protected apply/rollback for authorized scope. |
| `ADMIN` | Manage policy, role bindings, transports, retention, and emergency locks; secret access remains outside ordinary MCP responses. |

Permissions are cumulative only if explicitly assigned. Global configuration requires separate global scope. Production mutations SHOULD require recent strong authentication and MAY require two-person approval for controlled/global/high-risk changes.

---

## 16. Cost, Performance, and Stability Controls

Every query/run/experiment records:

```text
LLM calls and model IDs
embedding and reranking calls
prompt/completion tokens
tool calls
cache hits/misses
latency by step and total
estimated and, when available, billed cost
```

Before execution, estimate workload and cost. Reject or require explicit approval when requested cases, repeats, parallelism, or estimated cost exceed policy. Apply provider and project rate limits and bounded worker concurrency. Cancellation MUST stop undispatched work and mark partial results accurately.

Candidate comparisons always show four first-class axes:

```text
QUALITY | STABILITY | LATENCY | COST
```

The system must not characterize a candidate as “better” based only on average quality while hiding major cost, latency, or variance regressions.

---

## 17. Production Isolation

The existing chat pipeline SHOULD accept an execution contract equivalent to:

```js
runChatPipeline({
  message,
  sessionId,
  executionMode: "qa",
  persistChatHistory: false,
  configOverride,
  traceCollector
})
```

Required safeguards:

- QA runs use the real read pipeline but do not persist to `chat_messages_gf` by default.
- Candidate configuration exists only in the execution context; it never updates `agent_settings`.
- Each case gets a unique isolated session unless explicitly multi-turn.
- Outbound notifications, writes, webhooks, and other side effects are denied by default.
- Production data access remains tenant/project-scoped and read-only.
- QA tables are logically separated from user chat and existing production QA reports.
- QA load is concurrency/rate limited so it cannot degrade production traffic.

---

## 18. Security Requirements

- Begin with an internal/local transport for developer clients. Do not expose the current unauthenticated application server as a remote MCP endpoint.
- A future remote endpoint MUST use authenticated encrypted transport, current MCP authorization/security requirements, access-token validation, origin validation, rate limits, and tenant-aware authorization.
- Never call a settings-export path that resolves secrets. Build snapshots through a safe `configService` that allow-lists non-secret fields.
- Enforce authorization in services and database policy, not only in MCP tool descriptions.
- Validate every schema, enum, range, array size, patch path, and pagination limit server-side.
- Treat questions, retrieved documents, tool output, and generated proposals as untrusted data. They cannot override policy or authorize a tool/config mutation.
- Redact credentials, personal data, document content, prompts, and tool payloads according to role and retention policy.
- Encrypt sensitive stored QA artifacts, define retention for raw results/traces, and support deletion obligations without corrupting immutable config history.
- Audit privileged reads, all writes, policy denials, approval/apply/rollback, and baseline conflicts.
- Use idempotency for every write/execute operation and safe retry semantics for jobs.
- Restrict side-effecting integrations to mocks/sandboxes during QA.
- Add emergency production lock and per-environment kill switches for execution and deployment.

---

## 19. Acceptance Criteria

### 19.1 Phase 1

Phase 1 is complete only when:

1. A user can create a suite and batch-add cases.
2. A suite run executes every enabled case with bounded concurrency and optional repetition.
3. Each case is isolated and does not write normal chat history.
4. The stored result includes answer, sources, classification, retrieval/reranking, tools, context/workflow, errors, latency, usage, and cost.
5. Deterministic, pipeline, evidence, and semantic evaluators produce versioned results.
6. Each case receives pass/partial/fail, dimensional scores, failure code, severity, evidence, and root-cause confidence.
7. A run summary reports pass rate, critical failures, score dimensions, stability, latency, and cost.
8. Missing traces, partial execution, cancellation, and evaluator failure are explicit states.
9. Project/tenant authorization and side-effect denial are tested.
10. The seven Phase 1 MCP tools pass schema, idempotency, pagination, error, and budget tests.

### 19.2 Phase 2

Phase 2 is complete only when:

1. Production effective configuration can be captured as an immutable, secret-free snapshot.
2. Allow-listed candidate overlays can be created without mutating production.
3. Baseline and candidate execute against the same suite and valid data window.
4. Comparison reports paired quality, stability, latency, cost, and regressions.
5. Cache/session/config isolation is demonstrated by tests.
6. Failure clustering returns evidence and calibrated confidence.
7. Invalid, protected, overly broad, or excessive-delta changes are blocked.

### 19.3 Phase 3

Phase 3 is complete only when:

1. Domain, core, and golden gates are policy-enforced.
2. An experiment cannot reach approval eligibility after a hard/golden failure.
3. Only an authorized human approver can approve production promotion.
4. Approval does not silently apply a change.
5. Apply blocks on baseline conflict and is transactional, idempotent, and audited.
6. Version history is immutable and shows parent/change-request/actor/reason.
7. Rollback creates a new version and preserves the bad and target versions.
8. Recovery is tested for failure at each apply step.

### 19.4 Phase 4

Phase 4 is complete only when:

1. Reviewed production failures/dislikes can become regression cases.
2. Generated cases remain draft until human review.
3. Failure trends are reportable across releases and domains.
4. Previous tuning attempts and outcomes influence new proposals.
5. Continuous optimization still stops at recommendation/approval; it does not autonomously mutate production.

---

## 20. Implementation Order

1. Extract or confirm shared BiDoc service boundaries; MCP and REST must call the same core.
2. Define versioned canonical execution, trace, evaluation, error, and configuration schemas.
3. Add the five Phase 1 tables, constraints, indexes, scope policy, and retention policy.
4. Add QA execution mode to the existing pipeline: isolated sessions, no chat persistence, no side effects, trace collector, and budget context.
5. Implement `executeBiDocCase`, normalization, redaction, usage/cost capture, and failure-safe persistence.
6. Implement suite/run services with job cancellation, bounded concurrency, repetition, and idempotency.
7. Implement deterministic and pipeline evaluators first, then evidence evaluation and the constrained LLM judge.
8. Implement and contract-test the first seven MCP tools; expose summary-first results.
9. Calibrate domain scoring, hard-fail policies, stability, and evaluator-version comparison on real reviewed examples.
10. Implement secret-free snapshots, tuning policy, candidate overlays, semantic diff, and the eight config/tuning/experiment tools.
11. Add suite-level trends and failure clustering, completing the 17-tool Phase 2 set.
12. Implement paired experiment comparison, corpus/time consistency checks, and quality/stability/latency/cost gates.
13. Establish reviewed core and domain golden suites; implement `regression_run`.
14. Implement change requests, human approval, immutable versions, append-only audit, protected apply, optimistic locking, and rollback.
15. Security-test tenant isolation, prompt injection resistance, trace redaction, protected paths, side-effect denial, budget bypass, duplicate calls, and apply recovery.
16. Only after internal operation is stable, add a secured remote MCP transport.
17. Add Phase 4 production-failure ingestion, reviewed test promotion, trend analysis, and tuning learnings.

---

## 21. Definition of Success

The system succeeds when a user can ask:

> Test the contracts domain, explain the failures, try the smallest safe improvements, compare them with production, and recommend whether to promote one.

The agent can then create/select tests, run an isolated baseline, diagnose trace-backed failure clusters, build minimal candidates, execute paired experiments and regression gates, and return an evidence-backed recommendation across quality, stability, latency, and cost—while production remains unchanged until an authorized human explicitly approves and a protected deployment service applies the change.
