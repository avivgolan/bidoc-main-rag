# Data Query Agent - pre-Phase 4C semantic regression checkpoint

Executed: 2026-07-26

Status: **critical semantic smoke check passed; comprehensive quality regression deferred**

Phase boundary at smoke-check closeout: test and documentation only; Phase 4C.1
had not started. Phase 4C subsequently completed all three checkpoints on
2026-07-26 without changing this point-in-time semantic evidence.

## Purpose

Before promoting `public.alerts`, run a limited critical smoke check to verify
that the Data Query Agent changes did not take broad semantic questions away
from the established retrieval path, crash the core pipeline, or cause Main to
truncate. This checkpoint is not the final semantic-quality certification.

This checkpoint did not change runtime code, Content data, schema, RPCs,
permissions, RLS, credentials, settings, or saved table-selection state.
Authenticated testing created only ordinary application chat and run-history
records.

## Gate split

### Current critical smoke gate

For every pure semantic question:

- no `data_query` workflow node, execution event, or tool result may appear;
- Hybrid Search must run and must not be skipped as an exact structured route;
- graph search and reranking must remain available;
- the relevant semantic source tools and Main must run;
- Main must finish with `stop`, not `length` or `MAX_TOKENS`;
- the visible answer must be non-empty, end naturally, and preserve a critical
  uncertainty when the evidence does not establish an answer; and
- no exact-route bypass may suppress the established semantic retrieval chain.

### Deferred comprehensive semantic gate

After the remaining Data Query Agent work is complete, run a broader
representative matrix across every supported semantic family and exact/semantic
interaction. That final gate will evaluate claim-level citation accuracy,
Knowledge Planner reliability, Meeting Evidence selection, bilingual behavior,
cross-domain synthesis, context size, latency, conflict quality, and answer
completeness. The quality observations in this report are retained as baseline
regression targets for that final pass; they are not Phase 4C blockers.

## Automated focused regression

Result: **21/21 selected tests passed**.

| Slice | Result | Covered behavior |
|---|---:|---|
| Data Query semantic precedence across Phases 3, 4A, and 4B | 5/5 | Semantic and mixed questions keep the intended route boundaries |
| Semantic tool routing and retrieval merge | 6/6 | Safety, meeting, WhatsApp, financial, fallback, and merged retrieval behavior |
| Retrieval evidence and QA workflow fixtures | 4/4 | Knowledge retrieval and evidence preservation |
| Professional classification, planner repair, knowledge routing, and chat rendering | 6/6 | Planner enforcement, merged sources, and successful-answer rendering |

The focused suite confirms that semantic/citation delay questions, invoice
rejection explanations, and meeting-decision questions do not schedule Data
Query. Safety descriptions remain semantic, while genuinely mixed safety
questions retain both exact and semantic behavior.

The automated suite does not execute the authenticated `runChatPipeline`
workflow, the live Hybrid Search -> graph -> reranker -> Main chain, Meeting
Evidence, or live citation rendering. The authenticated pipeline and citation
rendering were inspected manually below; dedicated Meeting Evidence remained an
observed coverage gap because it was not selected by the meeting run.

Commands:

```powershell
npm.cmd test -- --filter "data query Phase 3 routes semantic|data query Phase 4A\.1 routes and plans bilingual|data query Phase 4A\.2 preserves mixed-question routing|data query Phase 4A\.3 anchors|data query Phase 4B routes English and Hebrew"
npm.cmd test -- --filter "high urgency forces safety_report|general fallback uses alert|internal content tools are gated|financial and safety analyzers|meetings, whatsapp and generic analyzers|retrieval merge unions"
npm.cmd test -- --filter "QA run summary includes nodes metrics retrieval evidence|delay claim evidence collection keeps existing evidence without meeting search|knowledge search returns relevant local chunks|knowledge search returns built-in markdown chunks"
npm.cmd test -- --filter "heuristicClassification treats project blockers|professional enforcement fixes model misses|knowledge planner enforces JSON|knowledge routing uses markdown keywords|knowledge search combines built-in and uploaded|chat UI preserves successful answers when workflow rendering fails"
```

No full repository suite or build was claimed by this focused checkpoint.

## Authenticated broad-question matrix

Every question was run in a fresh chat against the restarted current workspace
server. This is a point-in-time sample of delay, meeting, invoice, and safety
questions, not exhaustive proof for every semantic or cross-domain question.

| # | Semantic question family | Route and completion evidence | Answer evidence | Verdict |
|---|---|---|---|---|
| 1 | Hebrew March delay causes and impact | Data Query absent; Investigation, Hybrid Search, graph, reranker, semantic tools, conflict detection, and Main ran. Main used 77,789 input / 3,237 output tokens and finished `stop`. | The answer separated explicit cause from inference and preserved missing schedule-impact evidence. The Knowledge Planner failed JSON repair and used fallback. No clickable citations were rendered. | Smoke pass; deferred citation warning |
| 2 | Meeting decisions versus later email/WhatsApp follow-through | Data Query absent; Hybrid Search, graph, reranker, Meetings, Email, WhatsApp, conflict detection, and Main ran. Main used 103,660 / 8,078 tokens and finished `stop`. | The answer distinguished decisions from later facts and rendered six clickable source cards. The cards were collected after the answer rather than attached to claims. The Knowledge Planner used fallback, and dedicated Meeting Evidence search did not run. | Smoke pass; deferred evidence warning |
| 3 | Latest invoice rejection reason and evidence trail | Semantic precedence held despite `latest invoice`: Data Query was absent; Hybrid Search, graph, reranker, Financial Transactions, Email, conflict detection, and Main ran. The Knowledge Planner completed after one JSON-repair retry. Main used 165,177 / 3,425 tokens and finished `stop`. | The answer correctly said that no explicit rejection reason was found and did not invent one. Inline citations rendered as `(unavailable)`, while separate source cards were not reliably paired with the cited claims. | Smoke pass; deferred citation failure |
| 4 | Safety defects, causes, corrective actions, and recurring themes | The preliminary classifier hint included `data_query`, but the capability gate did not execute it or create a Data Query workflow node/event. Hybrid Search, graph, reranker, Safety Report, source quality, and Main ran. Main used 71,434 / 3,287 tokens and finished `stop`. | The answer separated reported facts from missing root-cause evidence. The Knowledge Planner timed out and used fallback. Four clickable cards were unrelated exception/email records, while the named safety-report sources were not clickable. | Smoke pass with classifier warning; deferred citation mismatch |

## Findings

### Critical smoke-check results

- Data Query did not execute for any of the four pure semantic questions and did
  not steal them from retrieval.
- Hybrid Search, graph search, reranking, and Main ran in all four workflows.
- Main finished `stop` in all four runs; no `length` or `MAX_TOKENS` completion
  occurred.
- The invoice question preserved the most important uncertainty rather than
  inventing an unstated rejection reason.
- No Data Query node, execution event, tool result, or exact-route bypass
  appeared. The safety run's preliminary classifier hint is recorded separately
  above.

### Deferred quality observations

- Strict citation grounding failed in all four runs: no links, claim-detached
  links, unavailable inline links, or unrelated links were observed.
- The Knowledge Planner required repair or fallback in every run and ended in
  fallback in three of four runs. The safety planner attempt added roughly 90
  seconds before fallback.
- The meeting question used the ordinary Meetings, Email, and WhatsApp tools but
  did not invoke the dedicated Meeting Evidence search.
- Main context remained very large, from 71,434 to 165,177 input tokens per
  question, making latency and output reliability fragile even though these
  four generations finished normally.

## Causality and gate decision

The tested evidence supports a narrow conclusion: **no semantic route-isolation
regression was observed across the four authenticated questions and 21 selected
checks**. Data Query execution stayed absent and generic retrieval stayed active
throughout this sampled matrix.

It does not support the broader statement that the semantic experience is fully
healthy. Planner reliability and citation mapping/rendering remain below the
future comprehensive acceptance standard. These issues occurred after the
semantic branch had already bypassed Data Query, so this checkpoint does not
attribute them to the new exact-query capability.

Decision for the requested limited scope: **critical smoke check passed**. No
critical route theft, retrieval bypass, empty answer, or Main truncation was
observed. At this historical checkpoint, Phase 4C.1 could therefore become the
next approval gate and had not started automatically. Phase 4C later completed
through authenticated closeout; Phase 4D is now the next separate approval gate
and has not started.

After the final approved Data Query table phase is complete, rerun the four
questions, the 21 focused checks, and the expanded comprehensive semantic matrix
defined above. Any semantic remediation remains a separate approval-gated slice.
