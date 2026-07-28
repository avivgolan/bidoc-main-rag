# Agent Routing Flow With Data Query Agent

Current runtime snapshot based on `src/agent.js`,
`src/subagents/dataQuery.js`, and `src/subagents/meeting.js` as of the completed
Phase 4D closeout on 2026-07-26.

This document describes live routing through the reviewed `meetings` capability.
Phase 4E and later table ideas remain deferred.

## 1. Main chat routing

```mermaid
flowchart TD
  U["User message"] --> API["POST /api/chat"]
  API --> PIPE["runChatPipeline()"]
  PIPE --> CLASS["Classifier + local enforcement"]

  CLASS -->|CHAT| LITE["Lite Agent"]
  LITE --> SAVE1["Save final answer"]

  CLASS -->|RAG| PRE["Safety precheck if urgency = HIGH"]
  PRE --> PLAN{"Professional / investigation context?"}
  PLAN -->|Yes| KP["Knowledge Planner / investigation plan"]
  PLAN -->|No| DQCHECK
  KP --> DQCHECK{"Exact structured Data Query route?"}

  DQCHECK -->|Yes| BYPASS["Skip hybrid search, graph search, reranker"]
  DQCHECK -->|No| HYB["Hybrid Search"]
  HYB --> HYB2["Optional planner RAG queries"]
  HYB2 --> GRAPH["Graph Search"]
  GRAPH --> RERANK["Reranker"]

  BYPASS --> TOOLS["Project tool stage"]
  RERANK --> TOOLS

  TOOLS --> DQ["Data Query Agent when supported"]
  TOOLS --> MEET["Meeting Evidence Agent when needed"]
  TOOLS --> ALERT["Alert Agent when hinted/enabled"]
  TOOLS --> N8N["Other internal or n8n tools"]

  DQ --> ANSWER{"Deterministic Data Query answer eligible?"}
  ANSWER -->|Yes| SAVE2
  ANSWER -->|No| QUALITY["Source quality + conflict detection"]
  MEET --> QUALITY
  ALERT --> QUALITY
  N8N --> QUALITY

  QUALITY --> MAIN["Main Agent answer synthesis"]
  MAIN --> SAVE2["Save final answer"]
```

## 2. Data Query routing decision

```mermaid
flowchart TD
  Q["Incoming RAG question"] --> CAP["classifyDataQueryCapability()"]

  CAP -->|Semantic / citation / why / who said| SEM["Do not use exact Data Query"]
  SEM --> ROUTE1{"Suggested route"}
  ROUTE1 -->|delay, claim, responsibility| DELAY["Delay Claim flow"]
  ROUTE1 -->|meeting quotes / decisions| MEET["Meeting Evidence Agent"]
  ROUTE1 -->|general evidence| RET["Hybrid retrieval flow"]

  CAP -->|Financial amount math with unpopulated numeric fields| NC1["Return not_computable"]

  CAP -->|Latest / earliest / last N lookup on approved typed table| LOOK["content_structured_lookup"]
  LOOK --> BYPASS["Bypass generic retrieval"]
  BYPASS --> RUN["runDataQueryAgent()"]

  CAP -->|Exact count / breakdown / trend on approved table| METRIC["content_metadata_metrics"]
  METRIC --> BYPASS

  CAP -->|Lookup target ambiguous| NC2["Route rejected: ambiguous target"]
  CAP -->|Recognized table but contract not enabled| NC3["Route rejected: structured contract not available"]
  CAP -->|Not quantitative| RET2["Use normal retrieval/tool routing"]

  RUN --> RESULT{"Data Query result"}
  RESULT -->|Reviewed exact / guarded mixed| MACHINE["Deterministic answer; Main may be skipped"]
  RESULT -->|Semantic-compatible multi-source path| MAIN["Main Agent synthesis"]
  RESULT -->|needs_clarification / skipped / not_computable| GUARD["Deterministic guarded response or explicit fallback"]
  MACHINE --> SAVE["Save final answer"]
  GUARD --> SAVE
  MAIN --> SAVE
```

## 3. Practical route rules

- `CHAT` questions go straight to `Lite Agent`.
- `RAG` questions always go through the main pipeline, but exact structured Data Query can short-circuit retrieval.
- `shouldBypassGenericRetrieval()` bypasses `hybrid_search`, `graph_search`, and
  `reranker` for reviewed exact structured lookup/metadata routes, their
  deterministic guarded variants, the approved alert/meeting mixed routes, and
  the pure Meeting Evidence route.
- Reviewed deterministic financial, safety, alert, and meeting exact routes still reach
  the shared tool stage, then can finish through their deterministic answer or
  postcondition path and skip Main. Semantic or compatible multi-source routes
  continue to Main when required.
- Investigation and Knowledge Planner are skipped for every reviewed structured
  bypass route. They remain available on non-structured professional or
  investigation questions; planning activity alone is not project evidence.
- Semantic questions are intentionally not Data Query questions, even if they mention invoices, meetings, alerts, or reports.
- Current semantic redirect behavior from `classifyDataQueryCapability()` is:
  - delay / claim / responsibility -> `delay_claim`
  - meeting quotes / decisions -> `meeting_evidence`
  - other evidence questions -> `hybrid_search`

## 4. Current tool-stage order

```mermaid
flowchart LR
  START["Tool stage starts"] --> ORDER["buildMainProjectTools()"]
  ORDER --> DQ["data_query first if supported"]
  DQ --> EXT["Other hinted / planner / meeting tools"]
  EXT --> LIMIT["External tools capped by parallelLimit"]
  LIMIT --> RUN["Run selected tools in parallel"]
  RUN --> FINAL{"Deterministic response eligible?"}
  FINAL -->|Yes| DIRECT["Render exact / guarded answer"]
  FINAL -->|No| SYNTH["Source quality -> conflict detection -> Main Agent"]
```

- `data_query` is kept ahead of external tools.
- `data_query` does not consume the external `parallelLimit`.
- Meeting Evidence is included when the typed semantic redirect selects it, when
  meeting signals exist, or when an eligible non-structured investigation needs it.
- Safety precheck tools are handled earlier and are filtered out from the later shared tool list.

## 5. Current exact-route boundary

- Exact route now:
  - approved structured metadata metrics
  - approved latest / earliest / last-N lookups
- Exact route does not do:
  - semantic explanations
  - citations / quotes
  - responsibility / root cause
  - unsupported financial amount math
- For those cases, the system must combine or redirect to retrieval/evidence agents instead of forcing Data Query to answer alone.

## 6. Phase 4D meeting route supersession

The general parallel tool-stage diagram above does not apply to the approved
mixed meeting handoff. Current meeting routing is:

```mermaid
flowchart TD
  Q["Meeting question"] --> R{"Route family"}
  R -->|"Exact count, status/date metric, bounded lookup"| DQ["Data Query only"]
  DQ --> DET["Deterministic date/status answer; Main skipped"]
  R -->|"Decision, quote, participant, rationale"| ME["Meeting Evidence only"]
  ME --> MAIN1["Grounded Main synthesis or evidence boundary"]
  R -->|"Approved latest meeting plus same-meeting evidence"| ANCHOR["Data Query exact anchor"]
  ANCHOR --> VERIFY["Verify meeting + project + attachment"]
  VERIFY --> SAME["Exact same-meeting evidence read"]
  SAME --> MAIN2["Grounded Main synthesis"]
```

- All three branches skip Hybrid Search, graph search, reranking, investigation
  planning, and knowledge planning.
- Exact output contains only canonical meeting date and opaque stored status;
  no exact source link is available.
- Pure semantics never use Data Query as evidence. Mixed execution is sequential,
  never a parallel broad retrieval, and accepts chunks only after exact source,
  project, attachment, date, and status attestation.
- The semantic RPC remains first. Only structural HTTP 400/404 failures may use
  the temporary fixed, bodyless, 500-row-capped compatibility read. It performs
  no adjacency expansion and redacts identifiers, filenames, URLs, embeddings,
  scores, and provider errors.
- Main retry input is sanitized. Missing or mismatched evidence produces an
  explicit boundary without replacing the exact metadata.
- Local unscoped acceptance relies on the audited single-project shape.
  Production/multi-project use remains blocked on authorization-bound project
  scope; SEC-001 remains deferred.
