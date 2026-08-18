# BIDoc Contracts Agent - Phase 1 Dry-Run Checkpoint

- Date: 2026-08-10
- Status: Phase 1 accepted; final live gold evaluation and all scoped regressions pass; Phase 2 entry work is tracked separately
- Authorization: User confirmed CTO approval and explicitly authorized Phase 1 on 2026-08-08
- Scope: Local dry-run extraction only
- Production status: Not deployed

## Outcome

Phase 1 now has an authenticated, bounded `POST /api/contracts/extract` path that turns a text-layer PDF into a deterministic canonical candidate package. It extracts page-aware text, segments clauses, asks the configured main model for a constrained draft, validates exact evidence and material facts, compiles stable candidate identities, preserves unresolved conflicts and missing information, and returns JSON in `dry_run` mode.

This phase does not write to a database, promote a fact, calculate a Schedule date, resolve a conflict, alter an existing Schedule table, or invoke the Schedule Engine. Phase 2 subsequently entered its separately authorized read-only schema-reuse checkpoint; operational persistence is still not authorized.

This checkpoint closes and accepts the authorized Phase 1 implementation slice. The final real-contract run completed inside the unchanged 270-second budget and passed every schema, domain, material-fact, evidence, conflict, binding, candidate-semantics, candidate-gate, missing-information, packet-gap, storage, dry-run, safety, and quality gate. Subsequent Phase 2 entry work is recorded separately and does not alter this accepted dry-run result.

## CTO constraints preserved

### Existing Schedule behavior

- `src/scheduleEngine.js` and `src/scheduleCalendar.js` are unchanged because Phase 1 dry-run extraction did not require an Engine change.
- No existing Schedule formula, calendar rule, status, confidence, severity, snapshot, API, or UI behavior was changed.
- The protected Schedule suite remains green at 47/47.
- Contracts output always has `computedDate: null`, `automaticPromotionAllowed: false`, `operationalEligibility: blocked`, and `approvedScheduleProjectionCount: 0`.
- The CTO clarification from 2026-08-10 is preserved: later Contracts/Indicator slices may modify or extend the existing Schedule Engine when genuinely required, provided they reuse its existing logic, explain the integration, and add focused unchanged-input regression evidence. A parallel schedule-calculation implementation remains prohibited.

### Existing tables

- No table, migration, RPC, trigger, policy, grant, index, backfill, or database row was created or changed.
- Storage dispositions are non-writing mapping hints for the CTO-created tables only.
- Fixed project milestones may point to `schedule_contract_milestones`; approved, grounded calendar-day extension events may point to `schedule_contract_extensions`; supported relative conditions may point to `schedule_contract_conditions`.
- Contractual extension rules, pending/non-calendar extension events, recurring/compliance facts, missing facts, and unsupported shapes remain `dry_run_only`.
- Every candidate remains blocked and requires human review even when a later storage destination is identifiable.

## Implemented components

| Component | Responsibility |
| --- | --- |
| `src/contracts/constants.js` | Lightweight versions and limits for diagnostics |
| `src/contracts/request.js` | Strict JSON, PDF/base64, field, mode, and explicit project-selection validation |
| `src/contracts/pdfReader.js` | Page-aware PDF.js text-layer extraction with page/text/time limits; OCR is unsupported |
| `src/contracts/segmenter.js` | Stable page/clause/appendix segmentation |
| `src/contracts/schema.js` | Ajv validation for the model draft and canonical output |
| `src/contracts/compiler.js` | Evidence verification, stable IDs, role locks, material grounding, binding, conflicts, gates, and dry-run invariants |
| `src/contracts/goldEvaluator.js` | Type, projection, material fact, party/action, evidence, conflict, binding, missing-data, packet-gap, gate, storage, and dry-run evaluation |
| `src/subagents/contracts.js` | Prompt, chunking, bounded concurrency, provider cancellation, one structural repair, telemetry, and orchestration |
| `src/server.js` | Authenticated endpoint and diagnostics; the heavy Contracts stack is loaded only for this route |
| `scripts/evaluate-contracts-gold-set.mjs` | Offline actual-versus-gold report and exit code |
| `scripts/evaluate-contracts-representative-set.mjs` | Exact canonical evaluation for six complete synthetic drafts |
| `scripts/evaluate-contracts-sample-live.mjs` | Real-PDF in-memory extraction and redacted gold evaluation; no persistence |
| `test/contracts-agent.tests.js` | Focused Phase 1 safety and regression coverage |

New exact production dependencies: `ajv` 8.20.0, `ajv-formats` 3.0.1, and `pdfjs-dist` 4.10.38.

## API contract and limits

Request body:

```json
{
  "filename": "contract.pdf",
  "mediaType": "application/pdf",
  "pdfBase64": "...",
  "mode": "dry_run",
  "sourceId": null,
  "projectSelection": {
    "projectId": "explicit-project-id",
    "projectSite": "explicit project site",
    "selectedByUser": true
  }
}
```

Guards:

- JSON request: 4,250,000 bytes maximum.
- Decoded PDF: 3,000,000 bytes maximum.
- PDF pages: 80 maximum.
- Extracted text: 160,000 characters maximum.
- Canonical response: 2,000,000 serialized wire bytes maximum.
- Total extraction budget: 270,000 ms.
- Strict canonical base64 and `%PDF-` signature are required.
- Unknown fields, non-PDF media, implicit project binding, and any `commit`, `persist`, or non-`dry_run` option are rejected.
- Error bodies expose bounded codes and never raw provider responses, contract text, credentials, or stack traces.

The route is after the existing authorization wall. It contains no Supabase, Schedule, or writer call. Heavy PDF/Ajv/model modules are dynamically imported only when the Contracts endpoint is invoked, so unrelated routes do not pay the Contracts cold-start cost.

## Extraction and safety behavior

- The prompt receives bounded clause segments and an outline used only as context; headings cannot become evidence candidates.
- Evidence must reproduce the complete supplied parser segment. The compiler re-resolves it against the claimed page/clause.
- Up to three model chunks run concurrently. The first failure stops queued calls and aborts in-flight OpenRouter requests.
- A global deadline watchdog actively aborts in-flight and queued model work at the 270-second total budget; the budget is not only checked between calls.
- One bounded retry is allowed only for transient transport, HTTP 408/429, or HTTP 5xx failures. When a distinct configured lite model exists, that retry uses it instead of repeating the failing provider model.
- Schema-validated completed chunks are retained in a bounded 30-minute in-process resume cache. A repeated request for the same prompt/model configuration reuses only those validated drafts; raw, invalid, failed, or partial model output is never cached, and model/prompt changes invalidate reuse.
- One repair call is allowed only for JSON/schema structure. Provider failure or truncation is not repaired into a result.
- Operator-configured main-model token and timeout limits are upper bounds; Contracts does not silently raise them.
- Dates, numbers, amounts, units, and notice branches are checked against evidence. A number must be locally paired with its unit/currency.
- Known roles own their canonical type and projection instead of trusting model classification.
- Conflicts require an explicit shared hint, except the narrow daily-delay-charge comparison. Complementary notice clocks are not conflicts.
- Conflict status is always `unresolved`; the model cannot select a winner.
- Project binding requires an explicit selection. A site mismatch stays `needs_review` and never binds automatically.
- Visible signatures and execution authority remain `unknown`/`unverified` because text extraction cannot establish them.
- Telemetry contains versions, counts, durations, tokens, cost, provider status, and bounded codes only; it excludes raw contract evidence, filename, project/site values, and credentials.

## Gold/schema decision log

The Phase 1 annotation is `human-gold.phase1.v4` for sample SHA-256 `0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA`.

- Gold evidence equals the exact full parser segment on the same page and clause.
- Candidate keys use document hash, clause identity, and role; amounts do not affect identity.
- Daily-charge metadata uses `amount`, `currency`, `rateUnit`, and `dayType`.
- Unqualified days use `day`, not silently inferred `calendar_day`, and carry `calendar_semantics_unresolved`.
- Runtime visible-signature status is `unknown`, not a visual claim of `blank`.
- The sample binding is an explicitly selected mismatch with number/text mismatch reasons.
- Notice service has typed registered-mail, hand-delivery, and email branches.
- Owner-delay relief and manager-set corrections remain `dry_run_only`.
- Non-null responsible/beneficiary parties must be exact source-language spans. Known role codes are compiler-locked so contractor, owner, and inspector identities cannot be swapped by model wording.
- Six complete synthetic cases now freeze the full canonical output by SHA-256 and cover fixed completion, working-day uncertainty, approved extension, project mismatch, compound monthly payment, and negative-offset bond notice.
- Annotation v4 reconciles compiler-owned safety gates and canonical missing-information wording. It requires `authority_unverified`, `human_review_required`, and, for this project mismatch, `project_binding_unreviewed` on every candidate. Compiler safety invariants and quality thresholds were not weakened.

## Verification record

Passed on 2026-08-10:

- `npm.cmd run test:contracts` - 32/32 passed.
- `npm.cmd run contracts:representative` - 6/6 complete canonical cases passed with exact expected SHA-256 digests.
- `npm.cmd run test:schedule` - 47/47 passed unchanged.
- `npm.cmd run react:build` - passed; 16 modules, 411.31 kB / 101.65 kB gzip.
- `npm.cmd audit --omit=dev --json` - 0 production vulnerabilities.
- Syntax checks and `git diff --check` - passed; only Windows line-ending warnings.
- Protected Schedule files - no diff and Phase 0 hashes preserved.
- Manual Contracts diagnostics - passed by the user: `active: true`, `mode: dry_run`, `contracts-agent.phase1.v1`, `pdfjs-dist/4.10.38`, and the configured byte/time limits including the 270,000 ms budget.
- Manual Schedule UI regression - passed from the user-provided screenshot: the three-axis view rendered the existing real schedule with 285 of 328 activities, milestone/delay summaries, and timeline data; no Contracts candidate appeared in Schedule.

Reliability addendum verified on 2026-08-12 after two repeated final-chunk provider timeouts:

- `npm.cmd run test:contracts` - 79/79 passed, including alternate-model retry, typed provider-timeout handling, validated-chunk resume, and model-change invalidation.
- Hebrew UI error handling distinguishes provider timeout from a generic failure and states that no partial result was saved.

The full repository suite still fails on two pre-existing Timeline mobile source assertions for absent `wireTimelineGraphTouch` and `wireTimelineDetailSwipe`. Contracts/OpenRouter tests pass before those failures. No Timeline implementation was changed.

## Live sample results and accepted exit gate

The first bounded run on 2026-08-10 used 19 selected temporal segments in seven batches. Batch 5 returned an invalid three-segment draft and was automatically split into three sequential single-segment calls inside the same worker and global deadline.

- Model: `google/gemini-2.5-pro`
- Duration: 150,228 ms
- Output: 12 candidates, 1 unresolved conflict, 10 pre-normalization missing-information rows, and 2 pre-normalization packet gaps
- Candidate-type micro-F1: 1.0
- Projection macro-F1: 1.0
- Critical-role recall: 1.0
- Material-fact precision/recall: 1.0 / 1.0
- Evidence coverage/location accuracy: 1.0 / 1.0
- False operational eligibility: 0
- Schema, domain, evidence, material facts, conflict, project binding, storage, and dry-run gates: passed
- Exact gates that failed: candidate semantics, candidate gates, missing-information, and packet gaps

The first redacted evidence artifact is [sample-herzliya-contract.live-report.2026-08-10.json](./gold-set/sample-herzliya-contract.live-report.2026-08-10.json). It contains no raw contract text, provider response, or credential.

The four remaining differences were deterministic and were corrected after the run:

1. Generic reciprocal notice labels such as “party” and “the other” are normalized to null rather than treated as legal identities.
2. Redundant notice `temporalSteps` cannot create a compound-rule gate when canonical delivery branches already own the semantics.
3. Phase 1 missing-information rows are compiler-owned; out-of-scope template observations cannot expand the operational missing-data contract.
4. Packet gaps are derived deterministically from source references and present appendix identities, with canonical impacts.

The authorized replay then completed without fallback:

- Duration: 88,709 ms
- Output: 12 candidates, 1 unresolved conflict, 5 canonical missing-information rows, and 2 packet gaps
- Every quality metric remained perfect: candidate type, projection, critical-role recall, material facts, evidence coverage/location, and false operational eligibility
- Exact gates now passing: schema, domain, material facts, evidence, conflicts, project binding, candidate semantics, missing information, storage disposition, dry-run safety, and operational blocking
- Exact gates still failing in that saved run: candidate gates and packet gaps

The replay artifact is [sample-herzliya-contract.live-report.2026-08-10-replay.json](./gold-set/sample-herzliya-contract.live-report.2026-08-10-replay.json). Its two deterministic causes were corrected afterward:

1. Only the canonical monthly payment chain may retain multi-step temporal metadata; simple locked roles cannot inherit `compound_rule_not_supported` from redundant model metadata.
2. An appendix heading whose body states that referenced material will be attached remains a packet gap; a placeholder is not treated as supplied content.

These changes pass 32 focused tests, all six unchanged representative hashes, the 47-test protected Schedule suite, and the React build.

The final authorized live replay then passed the complete unchanged acceptance contract:

- Evaluated at: `2026-08-10T10:14:08.073Z`
- Duration: 172,120 ms, within the 270,000 ms budget
- Output: 12 candidates, 1 unresolved conflict, 5 canonical missing-information rows, and all 3 expected packet gaps
- Approved Schedule projections: 0; computed completion date: null
- All 15 hard gates: passed
- Candidate-type micro-F1, projection macro-F1, critical-role recall, material-fact precision/recall, and evidence coverage/location accuracy: 1.0
- False operational eligibility: 0
- Batch 5 used the already-tested three-call single-segment structural fallback and still completed within the global deadline

The accepted redacted evidence artifact is [sample-herzliya-contract.live-report.2026-08-10-accepted.json](./gold-set/sample-herzliya-contract.live-report.2026-08-10-accepted.json). It contains no raw contract text, raw provider response, or credential.

## Manual checks

1. Start locally with `npm.cmd run dev`.
2. Open diagnostics and run the Contracts Agent diagnostic; confirm `active`, `dry_run`, versions, limits, and budget.
3. Send an authenticated `POST /api/contracts/extract` with an explicit project selection and small PDF.
4. Confirm exact evidence, blocked eligibility, null computed dates, and zero approved projections.
5. Try `commit: true`, invalid media, malformed base64, or an oversized body and confirm a bounded safe error.
6. Open Schedule and confirm its existing behavior/data are unchanged. No Contracts candidate should appear there.

There is no Contracts upload/review UI in Phase 1; API verification is the intended manual path.

## Phase 1 exit decision

Phase 1 exit is accepted against annotation v4 and the unchanged acceptance thresholds. Its scope remains local authenticated dry-run extraction only.

Phase 2 staging/review persistence, promotion, all Schedule writes, Indicator integration, alerting, OCR, and deployment were not performed in Phase 1. Work on Phase 2 begins only as a separately reviewed and approved slice that reuses the CTO-created tables and the existing Schedule Engine logic.

Transition note (2026-08-10): the Phase 2 read-only entry audit and pure no-I/O promotion planner have begun. Operational persistence remains paused; see [BIDoc Phase 2 Entry and Schema-Reuse Gate](./BIDoc_Phase_2_Entry_Schema_Reuse_and_Promotion_Gate.md).
