# Data Query Agent Phase 4A.1 manual regression evidence

Date: 2026-07-24  
Environment: local BiDoc UI at `http://localhost:4000`  
Scope: Phase 4A.1 user-facing regression gate after the local typed-lookup foundation

## Purpose

Phase 4A.1 added a dormant typed lookup foundation. The manual gate therefore had two goals:

1. prove that the existing exact `data_index` metric path still works;
2. prove that business and semantic questions continue through their existing retrieval routes until a matching Data Query table contract is explicitly promoted.

No Supabase object, table, column, row, permission, policy, or saved table selection was changed during these checks. The user independently compared the latest invoice and latest meeting with their source tables.

## Results

| Time | Question | Observed route | Result | Verdict |
|---|---|---|---|---|
| 23:42 | `How many indexed records are there?` | Classifier hint `data_query`; tool list contained only `data_query` | One Data Query plan completed with `status=ok`, one exact metric, no warnings, and answer `1,248` | Pass |
| 23:44 | `What is the latest invoice?` | Classifier hint and tool `financial_transactions`; no Data Query invocation | Answer identified an invoice dated 28 February 2026. The user confirmed directly that it was the latest source-table record | Pass |
| 23:48 | `What was decided in the latest meeting?` | Classifier hint and tool `meetings`; no Data Query invocation | Answer identified the 28 January 2025 meeting and returned its decisions. The user confirmed directly that it was the latest meeting | Pass |
| 23:54 | `Why was the latest invoice rejected?` | Investigation Mode; `financial_transactions` and `emails`; no Data Query invocation | Answer stated that no explicit rejection reason was found, separated confirmed events from possible context, and did not invent a cause | Pass |

## Detailed evidence

### Exact indexed-record count

- Classification: `type=RAG`, `tool_hint=data_query`.
- Main tool selection: `["data_query"]`.
- Data Query completion: `ok=true`, `plans=1`, `status=ok`, `metrics=1`, `warnings=[]`.
- Displayed result: exactly 1,248 indexed records.
- Regression conclusion: the existing `data_index` exact metric path remained functional after Phase 4A.1.

### Latest invoice remains on the retrieval route

- Classification: `tool_hint=financial_transactions`.
- Main tool selection: `["financial_transactions"]`.
- The financial tool completed successfully.
- No `data_query` node or execution appeared.
- The answer placed the 28 February 2026 invoice first.
- The user independently confirmed in the table that this was the latest invoice.
- Regression conclusion: the dormant financial lookup foundation did not prematurely change production routing.

### Latest meeting decision remains semantic retrieval

- Classification: `tool_hint=meetings`.
- Main tool selection: `["meetings"]`.
- The Meetings tool completed successfully.
- No `data_query` node or execution appeared.
- The answer returned actual decisions from the meeting rather than only date/status metadata.
- The user independently confirmed in the table that 28 January 2025 was the latest meeting.
- Regression conclusion: semantic-question precedence remained intact.

### Invoice rejection explanation remains evidence-bound

- Classification selected `financial_transactions,emails`, Professional Mode, and Investigation Mode.
- Main tool selection: `["financial_transactions","emails"]`.
- Both specialist tools completed successfully.
- No `data_query` node or execution appeared.
- The answer explicitly said that the available evidence did not contain a specific rejection reason.
- Possible operational context was presented as a possibility rather than a confirmed cause.
- Regression conclusion: Data Query did not replace retrieval for an explanation question, and the Main Agent did not manufacture an unsupported reason.

## Separate Main Agent performance findings

The functional Data Query regression passed, but the runs exposed a separate Main Agent context/performance problem:

| Question | Main Agent observation |
|---|---|
| Indexed-record count | 73,608 total tokens; simple exact metric still ran Hybrid Search, graph search, and reranking first |
| Latest invoice | 107,243 total tokens; approximately 83 seconds in the Main Agent; answer listed several invoices instead of leading with only the requested latest record |
| Latest meeting | 81,363 total tokens; approximately 82 seconds in the Main Agent |
| Invoice rejection reason | Initial Main Agent request timed out after 90 seconds; reduced-context retry succeeded with 137,127 total tokens |

These are not Phase 4A.1 correctness failures. They are tracked as a separate Main Agent context-compaction/routing-efficiency concern and must not be silently mixed into a Data Query table-promotion phase.

## Acceptance conclusion

Phase 4A.1 passed its manual user-facing regression gate:

- exact `data_index` metrics still execute through Data Query;
- invoice lookup remains on `financial_transactions` while the Data Query financial policy is dormant;
- meeting decisions remain on meeting retrieval;
- explanation questions remain evidence-bound and do not invoke Data Query;
- no raw JSON/truncation regression was observed;
- the user independently verified the latest invoice and meeting against the source tables.

This four-question route matrix is the manual baseline for Phase 4A.2. Until a live financial exact contract is separately approved, all four routes are expected to remain unchanged.
