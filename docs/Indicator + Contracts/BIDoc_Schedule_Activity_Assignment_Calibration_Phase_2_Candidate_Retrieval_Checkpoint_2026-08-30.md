# Schedule Activity Assignment Calibration. Phase 2 Candidate Retrieval Checkpoint

Date: 2026-08-30

Status: Phase 2 implemented and evaluated locally. Recommended retrieval configuration awaits approval. Phase 3 has not started.
Decision: reject full-semantic-only retrieval and candidate limits of 8 or 12. Recommend a 20-candidate hybrid union with 14 deterministic slots and 6 semantic slots.

## 1. Outcome

Phase 2 corrected two concrete lexical retrieval misses, added full-set semantic retrieval with versioned caching, and introduced a backward-compatible hybrid retrieval boundary.

The current production-style path remains the default `deterministic_first` strategy. The new `full_semantic` and `hybrid_union` strategies are available only when explicitly selected by an internal caller or evaluator. No remote setting, database row, prompt, model, threshold, margin, deployment, or automatic-write behavior was changed.

The recommended Phase 2 candidate configuration is:

| Parameter | Recommendation |
|---|---|
| Strategy | `hybrid_union` |
| Deterministic reserve | 14 candidates |
| Full-set semantic reserve | 6 candidates |
| Semantic ranking pool | 20 candidates |
| Matcher and Validator input | 20 candidates |
| Judge input | Existing top 5 |
| UI review choices | Existing top 2 plus none |
| Activity embedding cache identity | activity key, name, planned start, planned finish, model |

This keeps the current 20-candidate model-input envelope while adding semantic recall. The frozen evidence did not support reducing the model pool to 6, 8, or 12 without losing reviewed activities.

## 2. Delivered implementation

### 2.1 Backward-compatible retrieval strategies

`src/subagents/scheduleActivityAssignmentAgent.js` now provides:

- `deterministic_first`, preserving the existing production behavior by default.
- `full_semantic`, scoring every active non-summary activity before selection.
- `hybrid_union`, reserving candidates from deterministic and semantic legs with stable deduplication and tie-breaking.
- Separate semantic-pool and model-candidate limits.
- A complete `retrieval` stage in the audit and evaluation output.

The runtime server route does not accept browser-controlled retrieval parameters. The new strategy cannot be activated by a client request.

### 2.2 Versioned activity-embedding cache

Full-set semantic activity embeddings are cached through the existing shared cache provider. Cache identity includes:

- Embedding model.
- Schedule-version-bearing activity key.
- Activity name.
- Planned start.
- Planned finish.

Any identity, Schedule version, text, or date change therefore produces a new cache key. Concurrent scans use bounded concurrency of eight and coalesce identical in-flight cache operations.

One failed activity embedding no longer discards every successful vector. Partial semantic ranking remains available for review, while the failed semantic role still blocks automatic assignment.

### 2.3 Construction vocabulary correction

The deterministic vocabulary now recognizes:

- `סינר` and `סינרים` as the same construction scope.
- Flooring, tile, porcelain, ceramic, and slip-risk terms as one flooring trade family.

This corrected two verified misses without changing scoring weights:

| Source alert | Reviewed activity | Previous deterministic result | Phase 2 result |
|---|---|---|---|
| `2713` | activity `49`, soffits and partitions | absent from bounded set | deterministic rank 3, final rank 2 |
| `5689` | activity `15`, porcelain-tile specification | absent from bounded set | deterministic rank 2, final rank 2 |

### 2.4 Evaluation controls

The evaluation runner now supports:

- Explicit retrieval strategy and candidate limits.
- A retrieval-only lane that disables chat roles but retains full embedding retrieval.
- Exact source-ID subsets for targeted full-model validation.
- Per-case progress output.
- Retrieval-stage, model-pool, semantic-scan, and cache diagnostics.

## 3. Frozen comparison

All comparisons use the Phase 1 frozen dataset:

- 30 total cases.
- 28 confirmed reviewed links.
- 2 reviewed rejected choices.
- Active Schedule version `1787251318726_MS_Project.xml`.
- No label leakage into the evaluated case.
- No persistence.

### 3.1 Strategy comparison

| Configuration | Recall at 5 | Correct activity in bounded set | Actual embedding calls | Average latency | Result |
|---|---:|---:|---:|---:|---|
| Phase 1 deterministic-first baseline | 82.14% | 89.29% | 270 | 18.254 s | baseline |
| Full semantic, model limit 8 | 64.29% | 67.86% | 132 | 10.510 s | rejected |
| Hybrid, model limit 8 | failed the first difficult case | failed | not completed | not accepted | rejected |
| Hybrid, model limit 12 | recovered source `1474` only at rank 12 | incomplete deterministic preservation | smoke only | 18.239 s | rejected |
| Hybrid, model limit 20, retrieval-only full set | 89.29% | 96.43% | 132 | 1.013 s | selected retrieval basis |

The hybrid-20 retrieval-only run had zero role failures. It produced 2,958 cache hits and 132 misses. The 132 misses consist of 102 versioned activity embeddings plus 30 case-query embeddings.

The Phase 2 improvement over the Phase 1 baseline is:

- Recall at 5: 82.14% to 89.29%, a gain of 7.15 percentage points.
- Bounded-set presence from the raw event: 89.29% to 96.43%, a gain of 7.14 percentage points.
- Actual embedding calls: 270 to 132, a reduction of 51.11% for the frozen run.

### 3.2 Targeted full-model validation

A separate full-model run covered the five prior retrieval or top-five failures plus both reviewed rejected choices. It completed with:

- 7/7 cases completed.
- 0 role failures.
- 0 structured-output failures.
- 0 automatic assignments.
- Both rejected examples classified as `conflict`.
- Average latency 18.504 seconds.

| Source | Label | Reviewed activity rank in hybrid pool | Final rank | Decision | Automatic write |
|---|---|---:|---:|---|---|
| `1474` | confirmed | 18 | 20 | match | no |
| `2713` | confirmed | 3 | 2 | ambiguous | no |
| `2734` | confirmed | 10 | 14 | conflict | no |
| `2791` | confirmed | 6 | 13 | match | no |
| `5689` | confirmed | 2 | 2 | match | no |
| `4681` | rejected | n/a | n/a | conflict | no |
| `4825` | rejected | n/a | n/a | conflict | no |

The raw-event full run recovered 27 of 28 confirmed activities. The targeted extractor-enabled run recovered the remaining source `1474` through the semantic reserve. Combining these two non-leaking observations supports 28/28 candidate-pool coverage for the recommended configuration. This is an inference from complementary frozen runs, not a claim that one uninterrupted full 30-case chat-role run passed.

## 4. Explicit evidence mismatches

Three reviewed links remain outside the top five even after their activities reach the bounded model pool:

| Source | Alert evidence | Preserved reviewed activity | Final rank |
|---|---|---|---:|
| `1474` | insurance and signed contract | stone-cladding supply and installation | 20 |
| `2734` | drywall cladding for a corridor door | wall marking and architect approval | 14 |
| `2791` | ordering a grid ceiling for open spaces | wall marking and architect approval | 13 |

These links remain immutable reviewed evidence. Phase 2 does not delete, repair, relabel, or reinterpret them. The mismatches explain why a content-based system cannot place all preserved labels in the top five without label leakage or artificial overfitting.

## 5. Safety and rollback

- The active runtime default remains `deterministic_first`.
- No production strategy or candidate limit was published.
- A partial semantic scan blocks automatic assignment.
- Both reviewed rejected examples remained conflicts in the targeted full-model run.
- Current thresholds and margins remain unchanged.
- The UI remains limited to two review choices and none.
- Rollback is the existing default strategy. It requires no data mutation.

## 6. Phase 2 acceptance assessment

| Acceptance condition | Result |
|---|---|
| Material recall-at-5 improvement | Passed. 82.14% to 89.29% |
| No unexplained confirmed activity lost from the bounded pool | Passed with documented evidence. 27/28 raw-event coverage plus targeted semantic recovery of the remaining case |
| Negative cases do not gain false certainty | Passed on both reviewed negatives. Both conflict, zero automatic writes |
| Provider calls and latency reviewed | Passed for evaluation. 132 embedding calls with cache, unchanged 20-candidate chat envelope |
| Selected retrieval configuration approved before Phase 3 | Pending user approval |

Phase 2 implementation and evaluation are complete. Phase 3 calibration must use the recommended hybrid-20 retrieval configuration only after explicit approval.

## 7. Verification

- `node --check` on edited JavaScript modules.
- `npm.cmd run test:schedule`: 100 tests passed.
- Full 30-case retrieval-only comparison with no persistence.
- Targeted seven-case full-model comparison with no persistence.
- `git diff --check` in the final handoff.

No deployment, commit, remote settings write, database write, or production UI mutation was performed.
