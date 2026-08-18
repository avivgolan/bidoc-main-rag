# BIDoc Contracts Pipeline R3.2 — Clause Persistence Checkpoint

- Date: 2026-08-15
- Branch: `feature/contracts-indicator-schedule-intelligence`
- Starting HEAD: `b62ad04983e0`
- Approval: explicitly approved by the user after the R3.1 handoff
- Status: remote KAPAIM R3/R3.2 migrations applied; the real 189-clause PDF is durably persisted and canonical reopen is verified; user visual acceptance is pending
- Stop gate: R4 Contracts Relationships Agent work has not started

## 1. Outcome

R3.2 makes the complete Contracts Agent clause result durable. The first accepted run stores the immutable PDF in the existing private content-addressed bucket and atomically persists the R1 clause generation plus R3 enrichment. Later uploads of the same PDF and current generation return the canonical saved result before parser, model, or Storage work. The Contracts tab also lists saved clause generations so a user can reopen one without uploading the PDF at all.

The saved visual result contains the same evidence as R3.1: exact source text, Hebrew summary, controlled tags, parent/page identity, explicit-reference observations, search content, coverage metrics, source/content hashes, and generation IDs. It still returns empty semantic-decision and canonical-relationship collections.

## 2. Reused architecture

R3.2 adds no new domain table. It reuses:

- `private.contract_workspaces` with `workspace_version = contracts-workspace.r1.v1`;
- `private.contracts_documents` for immutable source and mutable R3 processing state;
- the existing private `contracts-private` Storage bucket;
- the R1 workspace/clause RPCs and the R3 enrichment RPC.

The new batch RPC calls those primitives within one short database transaction after PDF parsing, model enrichment, and Storage verification have already completed. It inserts or reuses at most 500 clauses and fails the complete database write on any clause/enrichment error.

## 3. New artifacts

- [`clausePersistence.js`](../../src/contracts/clausePersistence.js)
  - computes the current parser/enrichment generation before expensive work;
  - checks for a complete saved generation by project, document hash, parser generation, and enrichment generation;
  - skips parser/model/Storage on a canonical hit;
  - uses immutable no-overwrite Storage upload and verifies duplicate bytes;
  - sends one bounded server-owned persistence RPC and validates the canonical readback.
- [`20260815180207_contracts_pipeline_r3_2_clause_persistence.sql`](../../supabase/migrations/20260815180207_contracts_pipeline_r3_2_clause_persistence.sql)
  - adds service-role-only status/find/get/list/persist functions;
  - projects complete processed clause generations without exposing `raw_data`;
  - keeps the classic Phase 3F.1 saved-workspace list isolated from R1/R3 workspaces.
- [`contracts_pipeline_r3_2_clause_persistence.rollback.sql`](../../supabase/rollbacks/contracts_pipeline_r3_2_clause_persistence.rollback.sql)
  - refuses rollback while R3.2 workspaces exist;
  - removes only R3.2 functions and restores the prior classic list contract.
- [`test-contracts-clause-persistence-r3-2.mjs`](../../scripts/test-contracts-clause-persistence-r3-2.mjs)
  - resets only the dedicated local Supabase container;
  - verifies first insert, exact rerun reuse, find/get/list reopening, browser-role denial, populated rollback refusal, and zero downstream writes.

The repo-pinned Supabase CLI `migration new` command was attempted first as required, but Supabase CLI 2.113.0 on this Windows checkout returned `LegacyMigrationNewWriteError` because the existing migrations directory already existed. The migration uses the timestamp captured immediately after that failed command.

## 4. Safety boundary

- All routes require a same-origin authenticated superadmin session.
- Browser database overrides are rejected before I/O.
- Service-role credentials remain server-only.
- Database functions use `SECURITY INVOKER`, explicitly revoke default execution, and grant only `service_role`.
- The PDF object path is content-addressed by source-project UUID and SHA-256; overwrite is disabled and an existing object must match exact bytes.
- Model and Storage calls occur outside the database transaction.
- No `private.contracts`, `private.contract_relationships`, Schedule target, mapping, alert, projection, n8n, or deployment path is called.
- Runtime activation is fail closed behind `CONTRACTS_CLAUSE_PERSISTENCE_APPROVED=TRUE`.

## 5. Verification evidence

| Check | Result |
| --- | ---: |
| Focused R3/R3.1/R3.2 tests | 16/16 passed |
| Full Contracts suite | 117/117 passed |
| Schedule regression suite | 47/47 passed |
| React production build | passed |
| Node syntax checks | passed |
| Local R3.2 database fixture | passed |
| Provider-failure diagnostics: KAPAIM writes | 0 |
| Exact real batch-2 validation after provider fix | 8/8 items accepted in one call |

The local database fixture inserted one four-record generation, then reran the exact payload:

| Measure | First run | Exact rerun |
| --- | ---: | ---: |
| Workspace inserted / reused | 1 / 0 | 0 / 1 |
| Clauses inserted / reused | 4 / 0 | 0 / 4 |
| Enrichments inserted / reused | 4 / 0 | 0 / 4 |
| Decisions | 0 | 0 |
| Canonical relationships | 0 | 0 |
| Schedule rows | 0 | 0 |

The fixture verified that `authenticated` cannot execute the RPCs and that rollback refuses to strand saved R3.2 workspaces.

## 6. User-visible behavior

The existing Contracts tab now contains **חילוצי סוכן החוזים שנשמרו**. Selecting **פתח ללא חילוץ חוזר** loads the complete saved view immediately. The primary upload action is **חלץ ושמור את כל תוצאת סוכן החוזים**. The classic extraction remains separately visible and saved through its existing Phase 3F.1 flow.

## 7. Remote activation evidence

The user separately approved replacing the obsolete classic extraction with the canonical full-clause generation. The bounded KAPAIM activation completed as follows:

- deleted only classic workspace `fd056b39-e62b-40de-aef2-d5d6655280ab` and its one review draft after verifying it belonged to MAIN project `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7`, contained 12 classic candidates, and contained zero R1 clauses, decisions, or relationships;
- retained the identical private, content-addressed source PDF object for safe R3.2 reuse;
- applied KAPAIM migrations `contracts_pipeline_r3_clause_enrichment` and `contracts_pipeline_r3_2_clause_persistence` (remote history versions `20260815154010` and `20260815154059`);
- verified all six R3/R3.2 RPCs are `SECURITY INVOKER`, denied to `anon` and `authenticated`, and executable by `service_role` only;
- enabled `CONTRACTS_CLAUSE_PERSISTENCE_APPROVED=TRUE` in the local server environment;
- verified live status `ready=true`, persistence version `contracts-clause-persistence.r3.2.v1`, migration version `20260815180207`, and private bucket `contracts-private`.

### First real-PDF retry hardening

The first UI persistence attempt returned a generic failure before a canonical R3.2 workspace was written. A read-only parser check against the retained private PDF confirmed 18 readable pages, 189 clauses, accepted complete coverage, and zero coverage errors. The local runtime also confirmed that `OPENROUTER_API_KEY` resolves without exposing its value.

The follow-up fix makes the R3 per-call output limit explicitly independent from the global main-agent limit. The second real-PDF UI attempt then reached enrichment but returned `contracts_clause_enrichment_provider_failed`. Three bounded synthetic live diagnostics confirmed that the configured key, `openai/gpt-4o`, strict JSON Schema, the production R3 schema, and the maximum eight-clause batch shape all succeeded at the time of diagnosis.

R3 previously had zero retry tolerance, so one transient transport, timeout, HTTP 429, or provider 5xx response in any of the 24 batches aborted the complete run. It now permits exactly one shared retry across the complete enrichment run, waits 500 ms before retrying, and logs only the safe stage, batch, attempt, HTTP status, error code, and bounded provider message. The 189-clause worst-case plan is now 24 normal calls plus at most five repairs and one transient retry: exactly 48,000 configured output tokens. Regression coverage locks both the 189-clause budget and the single transient retry. The Contracts UI retains specific Hebrew messages for missing-key, token-budget, time-budget, provider, KAPAIM RPC, response-size, and numeric-grounding failures.

The initial provider-health diagnostics made no KAPAIM write and sent only synthetic clauses to OpenRouter. A restarted-server real-PDF retry remained the acceptance gate at that point.

### Google AI Studio structured-output correction

The next real-PDF attempt produced a safe provider log for enrichment batch 2: HTTP 400, `Provider returned error`. A read-only replay downloaded the retained 291,255-byte PDF from private KAPAIM Storage, reproduced the 18-page/189-clause generation, and sent only batch 2 to OpenRouter. The nested provider metadata identified `Google AI Studio` and `INVALID_ARGUMENT`: the dynamic strict schema produced too many serving states. The server-owned Settings resolve the R3 model to `google/gemini-2.5-pro`, whose OpenRouter metadata marks reasoning as mandatory.

The provider schema is now static and shape-only: exact schema version, item count, clause-key membership, Hebrew summary bounds/grounding, controlled tags, and duplicate/missing-key checks remain enforced by BIDoc's existing fail-closed validator after every response. OpenRouter provider metadata is also unwrapped into bounded diagnostic fields, without exposing prompts, contract text, or credentials.

After the schema correction, Gemini's default mandatory reasoning consumed too much of the 1,600-token output allowance and returned truncated JSON. R3 now caps mandatory reasoning at 128 tokens and excludes it from the response, preserving the existing total-token ceiling for the required JSON. The exact real batch 2 then returned once and all 8/8 items passed BIDoc validation. The verification made zero KAPAIM writes.

### Real-PDF persistence closeout and numeric-grounding hardening

A complete read-only production-equivalent run first proved that all 24 batches, 189 clauses, and the 240-second deadline were viable. Repeated real persistence attempts then exposed a nondeterministic Gemini behavior: a Hebrew summary sometimes echoed a clause number derived from `clauseKey` even though that number was absent from the clause's immutable `rawText`. BIDoc correctly rejected those summaries as `contracts_clause_enrichment_ungrounded_numeric_fact`, but the route did not log non-provider persistence failures and the UI did not map that code, so the user saw only the generic error.

The final hardening keeps source grounding strict without retrying the complete batch indefinitely:

- unsupported numeric tokens are deterministically removed from the affected summary before the normal summary and grounding validators run again;
- no unsupported numeric token can enter the accepted clause content or KAPAIM;
- the quality ledger records `groundingSanitizationCount`;
- unknown tags, malformed JSON/schema, missing clauses, and other validation failures remain rejected or use the existing bounded repair path;
- the R3.2 route now emits safe stage checkpoints and logs typed failures without contract text or credentials;
- the Contracts UI maps the relevant typed errors instead of collapsing them to the generic server message.

The approved real save then completed with this evidence:

| Measure | Result |
| --- | ---: |
| Workspace ID | `82345c75-c6f4-468d-b899-1f8407d9a9c1` |
| Source PDF SHA-256 | `0ff80eb28a157e748c02676b3c3897ea1fbbb1ad429f12e8aece0ef062629dda` |
| Pages / clauses | 18 / 189 |
| Processed clauses in KAPAIM | 189/189 |
| Model calls / model repairs | 24 / 0 |
| Numeric grounding sanitizations | 2 |
| Enrichment duration | 93,046 ms |
| Complete persistence duration | 95,954 ms |
| Canonical response size | 358,973 bytes |
| Quality accepted | true |

A separate KAPAIM SQL read confirmed the workspace, exact document hash, 189 processed rows, accepted quality ledger, and two recorded numeric sanitizations. A canonical `findSavedContractsClauseWorkspace` lookup then returned the same workspace with 189 clauses, `persisted=true`, accepted quality, and no model call.

## 8. Acceptance closeout

The server was restarted, workspace `82345c75-c6f4-468d-b899-1f8407d9a9c1` was reopened through **פתח ללא חילוץ חוזר**, and the complete 189-record result was visually inspected without another upload or model call. After the R3.3 Hebrew/structural refinement, the user explicitly accepted the result and approved progression to the Contracts Relationships Agent. R4.0 now owns the next separately bounded checkpoint.
