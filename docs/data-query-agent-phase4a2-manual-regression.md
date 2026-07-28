# Data Query Agent Phase 4A.2 manual regression checklist

Date prepared: 2026-07-25

Scope: repeat the established four-question UI baseline after the local, dormant `financial_transactions` policy was added.

## Important boundary

Phase 4A.2 did not deploy a financial exact RPC or activate financial Data Query routing. The expected UI behavior is intentionally unchanged from Phase 4A.1. Do not interpret a local fixture test as production proof.

## Preconditions

1. Start the application through the normal local workflow.
2. Confirm that the Data Query Agent is enabled for the existing `data_index` exact path.
3. Do not change the saved Data Query table selection.
4. Do not deploy or edit any Supabase object.
5. Open Workflow History after each question and inspect the selected tools and Data Query nodes.

## Four-question regression matrix

| # | Question | Expected route | Expected evidence |
|---|---|---|---|
| 1 | `How many indexed records are there?` | Data Query | A Data Query workflow runs against the existing `data_index` exact contract. The answer is an exact count with no lookup records. Compare the value with the previously observed baseline of 1,248 only as a regression reference; current live data may legitimately differ. |
| 2 | `What is the latest invoice?` | `financial_transactions` retrieval | No Data Query workflow is scheduled. The answer continues through the existing financial retrieval tool. If desired, verify the returned record directly against the source table; 28 February 2026 was the prior verified baseline, not a permanent expected value. |
| 3 | `What was decided in the latest meeting?` | `meetings` retrieval/evidence | No Data Query workflow is scheduled. The answer uses meeting retrieval because the question asks for semantic decision content. The prior verified latest meeting was 28 January 2025, but current live data may differ. |
| 4 | `Why was the latest invoice rejected?` | `financial_transactions` plus `emails` retrieval | No Data Query workflow is scheduled. The answer must distinguish found evidence from missing evidence and must not infer a rejection reason from structured metadata. The prior baseline correctly reported that no explicit reason was found. |

## Pass criteria

- Question 1 still uses the existing exact `data_index` Data Query path.
- Questions 2 through 4 do not schedule Data Query.
- The latest-invoice route remains the existing retrieval route while the financial exact deployment contract is unavailable.
- The meeting and invoice-explanation questions retain semantic/retrieval precedence.
- Workflow History contains no raw Data Query record values.
- No new warning, timeout, or route regression attributable to Phase 4A.2 appears.

## Evidence to record

For each question, record:

- timestamp;
- classifier/tool hint;
- selected tools;
- whether a Data Query workflow ran;
- answer status and warnings;
- optional direct source-table verification for the latest invoice or meeting;
- screenshots only if they do not expose sensitive record content.

## Deferred proof

After separate approval for a trusted financial execution contract, a new live gate must compare financial Data Query results with trusted SQL for latest/earliest/last-N, exact invoice filtering, counts, date boundaries, null dates, and tie ordering. That live proof is not part of Phase 4A.2.
