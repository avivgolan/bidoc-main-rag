# BiDoc Chat Quality Baseline

Generated: 2026-08-31T00:00:00.000+03:00
Commit: `3a8fa03f1c0ed6e073cde05b6c0db89e7e81a292`
Fixture hash: `0be11e6aec300443e8b28d0ca2cae7725f4ab7e848dba554fa080a2d1799155b`
Schema: `chat-quality.v1`
Execution profile: `chat-quality.v1:local-dry-run:pure-route-probes:synthetic-reference`

## Scope

This is a local, hermetic dry run. It performs no network calls, database reads, database writes, model calls, or production changes. Route assertions use current pure routing helpers. Answers and execution metrics come from synthetic sanitized reference fixtures, so this report is an evaluation-harness baseline, not production quality certification.

## Summary

- Cases: 12/12 passed
- Assertions: 351/351 passed
- Code-backed route accuracy: 100.0%
- Code-backed exact-route accuracy: 100.0%
- Reference workflow-policy accuracy: 100.0%
- Reference evidence-contract accuracy: 100.0%
- Reference answer-contract accuracy: 100.0%
- Reference completion-contract accuracy: 100.0%
- Memory policy accuracy: 100.0%
- Security policy accuracy: 100.0%
- Runtime metric coverage: 0/12 cases

The reference-contract percentages measure fixture and evaluator consistency. They are not live response-quality scores.

## Case Results

| Case | Language | Category | Expected family | Probed family | Result | Failed assertions |
|---|---|---|---|---|---|---|
| `chat-greeting-en` | en | lite_chat | `chat_lite` | `chat_lite` | PASS | None |
| `semantic-delay-responsibility-he` | he | semantic_rag | `semantic_rag` | `semantic_rag` | PASS | None |
| `exact-partial-account-count-en` | en | exact_data_query | `exact_data_query` | `exact_data_query` | PASS | None |
| `exact-partial-account-failure-he` | he | exact_failure | `exact_data_query` | `exact_data_query` | PASS | None |
| `mixed-latest-meeting-en` | en | mixed_exact_semantic | `mixed_exact_semantic` | `mixed_exact_semantic` | PASS | None |
| `memory-explicit-recall-en` | en | memory_recall | `memory_recall` | `memory_recall` | PASS | None |
| `memory-non-recall-en` | en | memory_non_recall | `semantic_rag` | `semantic_rag` | PASS | None |
| `missing-evidence-boundary-en` | en | missing_evidence | `semantic_rag` | `semantic_rag` | PASS | None |
| `conflicting-completion-date-en` | en | conflicting_evidence | `semantic_rag` | `semantic_rag` | PASS | None |
| `latest-project-status-he` | he | latest_status | `semantic_rag` | `semantic_rag` | PASS | None |
| `mixed-alert-explanation-en` | en | mixed_exact_semantic | `mixed_exact_semantic` | `mixed_exact_semantic` | PASS | None |
| `prompt-injection-redaction-en` | en | security | `semantic_rag` | `semantic_rag` | PASS | None |

## Runtime Metrics

Latency, token usage, and cost are intentionally marked unmeasured in this hermetic fixture set. Live read-only evaluation is deferred and requires separate approval.

## Gate

Phase 0 smoke-harness gate passes. This does not approve runtime, prompt, model, routing, Supabase, or deployment changes.
