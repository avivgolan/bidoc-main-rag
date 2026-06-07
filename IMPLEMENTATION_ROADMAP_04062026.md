# Main RAG Backend Implementation Roadmap

Source: `04062026.pdf` meeting summary, dated 04/06/2026.

This roadmap turns the meeting between Noam and Dor into an implementation plan for
`bidoc-main-rag`. It should be read together with `CURRENT_SYSTEM_DOCUMENTATION.md`,
which documents the current backend structure and behavior.

## Executive Direction

The meeting points to one central product goal:

The chat must stop behaving like a plain RAG chat and start behaving like a
construction-aware investigation assistant that uses three layers together:

1. Project retrieval from Supabase.
2. Professional construction knowledge from the Knowledge Base.
3. Project relationship/context graph from the Graph tab and timeline graph.

The safest order is:

1. Make Knowledge Base and graph usage observable and testable.
2. Make sure the expected Knowledge Base documents and graph data exist.
3. Improve chat retrieval and answer synthesis to actively use both.
4. Extend Link Agent from pair suggestions into story/process building.
5. Tune prompts and models against repeatable examples.

Prompt tuning should happen after the evidence pipeline is working. Otherwise we
will tune the model around missing context instead of fixing the missing context.

## Meeting Tasks

| Meeting item | Meaning for implementation | Current status in repo |
| --- | --- | --- |
| Model dropdown with prices exists | Keep using current Settings UI as the model control center. | Present in `public/index.html`, `public/app.js`, `src/openrouter.js`, `src/config.js`. |
| All prompts are one click away | Prompt editing should remain centralized in Settings. | Present through prompt textareas and `src/prompts.js` defaults. |
| Model settings need tuning | Tune classifier, knowledge planner, main agent, reranker, QA, Link Agent. | Settings exist, but no evaluation harness yet. |
| Chat may not activate Knowledge Base correctly | Verify triggers, document availability, planner flow, and answer visibility. | Code path exists in `src/agent.js` and `src/knowledge.js`; baseline Knowledge agents now load from repo Markdown files. |
| Graph tab shows relationships | Use graph as real chat context, not only a visualization. | Graph UI and backend search exist through `src/projectGraph.js`, `src/supabase.js`, and `src/server.js`. |
| Chat should learn semantic relationships from graph | Expand retrieval and final synthesis with graph-connected entities/events. | Basic graph search exists after hybrid retrieval. Needs stronger use and tests. |
| Link Agent should use graph for timeline links | Improve graph fallback, semantic search, and model review for timeline linking. | Smart link suggestions exist in `src/server.js`; story/process mode is not explicit yet. |
| Link Agent should present a story/process | Build ordered event chains by topic/entity, such as a carpentry process. | Not implemented as a first-class endpoint or UI mode. |
| Main Agent prompts need work | Tune prompts after instrumentation and examples are in place. | Defaults in `src/prompts.js`, overrides through settings. |
| Subagents are not relevant now | Keep out of the first implementation scope. | Alert subagent exists, but should not drive this phase. |
| Knowledge Base has 3 domain areas | Schedule, Safety/Quality, and Commercial should seed professional vocabulary and routing. | Agent definitions and searchable content now live in `knowledge-base/agents/*.md`; uploaded docs remain optional extras. |

## Current Reality

### Knowledge Base

Relevant files:

- `src/knowledge.js`
- `knowledge-base/agents/schedule.md`
- `knowledge-base/agents/safety_quality.md`
- `knowledge-base/agents/commercial.md`
- `src/agent.js`
- `src/config.js`
- `src/prompts.js`
- `src/server.js`
- `public/index.html`
- `public/app.js`

What exists now:

- Three built-in Knowledge agents are defined in Markdown:
  - `schedule`
  - `safety_quality`
  - `commercial`
- Markdown frontmatter provides each agent's name, description, tags, and keywords.
- Markdown body content is searchable and passed to the Knowledge Planner.
- Optional uploaded docs are still read from local files under `data/knowledge-base/<agent-id>/`.
- Only `.md` and `.txt` files are accepted.
- Search is local lexical chunk scoring, not vector search and not Supabase-backed.
- Chat can run a Knowledge Planner step when classification is `professional`.
- Local vocabulary triggers can enforce Professional Knowledge mode.
- Settings UI exposes Knowledge Base trigger keywords and planner settings.

Resolved foundation:

- The three domain areas are no longer hardcoded in `src/knowledge.js`.
- `searchKnowledgeBase()` searches built-in Markdown agent content even when no
  uploaded docs exist.
- Search results distinguish `source: "agent"` from `source: "upload"`.

### Graph Context

Relevant files:

- `src/projectGraph.js`
- `src/supabase.js`
- `src/agent.js`
- `src/server.js`
- `supabase/project-graph.sql`
- `public/index.html`
- `public/app.js`

What exists now:

- Project graph nodes and edges are stored in Supabase tables:
  - `graph_nodes`
  - `graph_edges`
- `graph_search` RPC is expected, with fallback logic in `src/supabase.js`.
- Chat builds a graph search payload from retrieved records.
- Chat summarizes graph results and passes `graph_context` into final synthesis.
- The final prompt already tells the model to use graph context actively.
- Graph tab can list, filter, and visualize project relationships.

Important gap:

- Current graph use is dependent on initial hybrid search results. If hybrid
  retrieval misses the right records, graph search may never see the right
  entities.
- There is no dedicated evaluation proving that graph context changes answers.
- Graph context is supplied to the model, but the product expectation is stronger:
  graph relationships should guide retrieval, reasoning, and timeline linking.

### Link Agent And Timeline

Relevant files:

- `src/server.js`
- `src/timelineGraph.js`
- `src/timelineLinks.js`
- `src/supabase.js`
- `supabase/timeline-knowledge-graph.sql`
- `public/index.html`
- `public/app.js`

What exists now:

- Link suggestions endpoint exists at `/api/timeline/link-suggestions`.
- It supports smart suggestions, semantic search, graph fallback, and model review.
- Timeline graph data is loaded through `listTimelineGraphData`.
- `createTimelineGraphScorer` scores candidate event links.
- UI exposes Link Agent settings:
  - model
  - prompt
  - suggestion limit
  - semantic top K
  - time window
  - minimum confidence
  - graph fallback toggle
  - ignored terms

Important gap:

- Link Agent is currently centered on suggesting pairwise links.
- The meeting asks for story/process presentation, for example showing the full
  process around carpentry. That requires an ordered chain view, not just pairs.

### Prompt And Model Tuning

Relevant files:

- `src/prompts.js`
- `src/config.js`
- `src/openrouter.js`
- `public/index.html`
- `public/app.js`

What exists now:

- Defaults are in code.
- Overrides are stored through settings.
- OpenRouter model list is available, including pricing metadata.
- Sampling settings exist per agent.

Important gap:

- There is no repeatable evaluation suite for the CTO examples.
- Tuning without tests will make changes hard to trust and hard to compare.

## Implementation Principles

1. Observability first.
   Every major step should be visible in the workflow/run trace: classifier,
   Knowledge vocabulary, Knowledge Planner, hybrid search, graph search, rerank,
   Link Agent graph fallback, model review, and final answer.

2. Seed data first.
   Knowledge Base cannot be evaluated until the three domain documents exist in
   the environment being tested.

3. Evaluate before tuning.
   Each prompt/model change should be checked against stable questions.

4. Separate domain knowledge from project facts.
   Knowledge Base should teach the model what terms mean and what to look for.
   Supabase retrieval and graph context should provide project-specific facts.

5. Use graph as evidence and retrieval expansion.
   Graph context should not only decorate the final prompt. It should help find
   additional entities, connected events, suppliers, senders, recipients, risks,
   documents, and timeline links.

6. Keep Subagents out of this phase.
   The meeting explicitly says Subagents are not relevant right now.

## Recommended Phases

### Phase 0: Baseline And Diagnostics

Goal: prove what currently works before changing behavior.

Tasks:

- [ ] Run the existing test suite with `npm test`.
- [ ] Start the backend locally with `npm run dev`.
- [ ] Call `/api/diagnostics/connections` and capture current Supabase/OpenRouter status.
- [x] Confirm the Markdown-backed Knowledge agents are loaded:
  - `schedule`
  - `safety_quality`
  - `commercial`
- [ ] Check whether `data/knowledge-base/` also exists in the real runtime environment.
- [ ] Run Knowledge Base search and capture both concepts separately:
  - built-in agent document count
  - uploaded document count
  - chunk count
  - match count
- [ ] Check whether Supabase graph tables exist and contain rows.
- [ ] Check whether `graph_search` RPC exists and returns rows for a known topic.
- [ ] Run one manual chat question from the meeting:
  - "Who was the delayed supplier?"
- [ ] Save the run trace and identify which steps fired.

Acceptance criteria:

- We know whether failures come from missing data, missing config, weak routing,
  graph retrieval, prompts, or model behavior.
- We have at least three baseline traces before code changes.

### Phase 1: Knowledge Base Foundation

Goal: make Professional Knowledge Agent reliable and visible.

Tasks:

- [x] Decide Knowledge Base persistence for the baseline implementation:
  - repo-tracked Markdown files in `knowledge-base/agents/` are the source of
    truth for built-in agents.
  - uploaded local docs under `data/knowledge-base` remain optional extras.
  - Supabase-backed editable docs can be considered later for production.
- [x] Convert the three domain areas into searchable Markdown agent documents:
  - Schedule: delays, blockers, dependencies, critical path, supplier delay terms.
  - Safety/Quality: safety defects, quality control, stop-work signals, risk terms.
  - Commercial: contracts, claims, change orders, approvals, responsibility, cost.
- [x] Extend existing Knowledge responses to show:
  - agents
  - built-in agent document counts
  - document counts
  - chunk counts
  - source counts for `agent` and `upload`
  - whether matches came from built-in Markdown or uploaded docs
- [ ] Make the chat workflow trace show when Knowledge Base is empty.
- [ ] Improve activation triggers for construction terms from the meeting:
  - delayed supplier
  - delay
  - supplier
  - subcontractor
  - blocker
  - dependency
  - approval
  - claim
  - change order
  - defect
  - safety
- [ ] Add tests for:
  - routing "delayed supplier" to `schedule` and/or `commercial`
  - built-in Markdown Knowledge Base search
  - empty uploaded-doc reporting
  - Knowledge Planner fallback when OpenRouter is unavailable

Acceptance criteria:

- A meeting-style question activates Professional Knowledge mode.
- The run trace shows which Knowledge agent was selected and what it returned.
- Empty uploaded docs are visible as a clear diagnostic, not a silent failure.
- Built-in Markdown knowledge produces useful planning terms and search queries.

### Phase 2: Graph-Powered Chat

Goal: make graph relationships improve chat answers.

Tasks:

- [ ] Verify graph rebuild/population route and document how graph rows are created.
- [ ] Add or improve diagnostics for:
  - graph nodes count
  - graph edges count
  - top node types
  - top edge types
  - graph search availability
  - fallback usage
- [ ] Improve `buildGraphSearchPayload` so graph search gets more than source refs:
  - entities from classifier/Knowledge Planner
  - extracted supplier/person/company/document terms
  - hashtags and professional terms
  - sender/recipient/date terms when relevant
- [ ] Use graph search before or alongside hybrid search for relationship questions.
- [ ] Add graph-connected query expansion:
  - retrieve records connected to matching graph nodes
  - include connected alerts/events/documents as candidate evidence
  - preserve citation/source boundaries
- [ ] Strengthen answer synthesis rules:
  - graph can support relationships
  - project facts still need connected retrieval/tool evidence
  - uncertainty should be explicit when graph suggests but records are missing
- [ ] Add tests/evaluations for:
  - "Who sent X to whom?"
  - "Which supplier is connected to the delay?"
  - "What events are related to this approval?"
  - list-style graph questions

Acceptance criteria:

- Graph context is present in traces for relationship questions.
- At least one evaluation answer changes correctly because graph context is used.
- Answers identify relationships without inventing facts outside retrieved/graph
  evidence.

### Phase 3: Link Agent Story And Process Mode

Goal: move Link Agent from pair suggestions to coherent story/process chains.

Tasks:

- [ ] Define "story" output shape:
  - topic
  - main entities
  - ordered events
  - link reasons
  - missing evidence
  - confidence
  - suggested next checks
- [ ] Add a story/process endpoint, for example:
  - `GET /api/timeline/story?source=index&topic=carpentry`
  - or extend `/api/timeline/link-suggestions` with `mode=story`
- [ ] Build candidate chains by combining:
  - timeline events
  - saved timeline links
  - timeline graph entities
  - graph scorer
  - semantic search
  - model review
- [ ] Support focus modes:
  - by topic text, such as "carpentry"
  - by event id
  - by supplier/entity
  - by date range
- [ ] Add UI in Link Agent or Timeline:
  - search topic/entity
  - generate story
  - show ordered chain
  - show confidence and missing links
  - allow saving suggested links from the chain
- [ ] Add evaluation examples:
  - "Show the carpentry process"
  - "What happened before this approval?"
  - "Which events caused or followed this delay?"

Acceptance criteria:

- User can request a process/story and get ordered events instead of only link pairs.
- Story output explains why events are connected.
- Suggested missing links can still be reviewed before saving.

### Phase 4: Prompt And Model Calibration

Goal: tune models/settings with controlled examples.

Tasks:

- [ ] Create an evaluation file with fixed prompts and expected behavior.
- [ ] Include at least these categories:
  - Knowledge activation
  - delayed supplier
  - graph relationship
  - timeline story
  - sender/recipient
  - commercial claim
  - safety/quality defect
- [ ] Add a simple evaluation runner or manual checklist.
- [ ] Tune in this order:
  - classifier
  - Knowledge Planner
  - graph-aware main prompt
  - reranker
  - timeline link agent prompt
  - QA agent
- [ ] Track tested model/settings combinations:
  - model id
  - temperature
  - max tokens
  - top P
  - cost note
  - pass/fail notes
- [ ] Keep default prompts conservative and override experiment prompts through Settings.

Acceptance criteria:

- We can compare model/prompt changes against the same examples.
- Prompt changes are no longer based only on one chat attempt.
- Settings UI remains the operational place for tuning.

### Phase 5: Reliability, Security, And Repo Hygiene

Goal: make the backend safer to own long-term.

Tasks:

- [ ] Add API auth or admin protection for mutation/settings/export routes.
- [ ] Decide how environment secrets are managed locally and in deployment.
- [ ] Remove or ignore generated artifacts from git:
  - `.venv`
  - `.npm-cache`
  - local run logs if generated
  - runtime `data/` if it is not meant to be source-controlled
- [ ] Decide whether editable Knowledge Base docs are source-controlled fixtures,
  Supabase records, or deployment-managed content. Built-in Markdown knowledge should
  remain enough for a baseline startup check.
- [ ] Add migration documentation for:
  - project graph
  - timeline graph
  - settings tables
  - Knowledge Base if moved to Supabase
- [ ] Vendor or pin frontend CDN dependencies if needed for offline/local stability.
- [ ] Add runbook docs for:
  - local setup
  - Supabase setup
  - graph rebuild
  - Knowledge Base upload/seed
  - evaluation checklist

Acceptance criteria:

- New owner can set up the backend without hidden CTO/developer knowledge.
- Production-sensitive endpoints are not exposed without protection.
- Generated local artifacts do not keep polluting source control.

## Prioritized Backlog

### P0: Knowledge Base Is Missing Or Silent

Files:

- `src/knowledge.js`
- `src/agent.js`
- `src/server.js`
- `public/app.js`
- `public/index.html`
- `test/run-tests.js`

Tasks:

- [x] Add Knowledge Base source reporting in document/search payloads.
- [x] Distinguish built-in Markdown agent docs from uploaded searchable documents.
- [x] Make built-in Markdown agent files searchable.
- [ ] Make empty uploaded docs visible in UI and run trace.
- [x] Add tests for routing and search.

Acceptance:

- Asking "Who was the delayed supplier?" visibly triggers Knowledge Base logic.
- The search result shows whether results came from built-in Markdown, uploaded
  docs, or both.

### P0: Baseline Evaluation Questions

Files:

- `test/run-tests.js`
- new evaluation fixture/checklist file

Tasks:

- [ ] Add fixed test/evaluation questions from the meeting.
- [ ] Capture expected tool behavior, not only final answer text.
- [ ] Add manual checklist for DB-dependent checks.

Acceptance:

- We can rerun the same checks after each change.

### P1: Graph Context Retrieval Expansion

Files:

- `src/agent.js`
- `src/projectGraph.js`
- `src/supabase.js`
- `supabase/project-graph.sql`

Tasks:

- [ ] Feed Knowledge Planner terms into graph search.
- [ ] Feed extracted entity terms into graph search.
- [ ] Retrieve graph-connected source records when useful.
- [ ] Add graph diagnostics.

Acceptance:

- Relationship questions produce meaningful `graph_context`.
- Final answers use graph context as evidence, with boundaries.

### P1: Link Agent Graph Integration

Files:

- `src/server.js`
- `src/timelineGraph.js`
- `src/timelineLinks.js`
- `public/app.js`
- `public/index.html`

Tasks:

- [ ] Improve graph fallback scoring and ignored-term filtering.
- [ ] Add topic/entity focus to smart suggestions.
- [ ] Add trace details showing graph contribution to each suggestion.

Acceptance:

- Link suggestions explain which shared entities/tags caused the suggestion.

### P2: Timeline Story Mode

Files:

- `src/server.js`
- `src/timelineGraph.js`
- `public/app.js`
- `public/index.html`

Tasks:

- [ ] Add story/process endpoint.
- [ ] Build ordered event chains.
- [ ] Add UI for topic/entity story generation.
- [ ] Let user save reviewed links from story output.

Acceptance:

- User can ask for a story like "carpentry" and see a coherent sequence of
  related events with evidence.

### P2: Prompt And Model Tuning

Files:

- `src/prompts.js`
- `src/config.js`
- `public/app.js`
- evaluation fixtures

Tasks:

- [ ] Tune classifier and Knowledge Planner after P0 checks pass.
- [ ] Tune main prompt for graph-aware reasoning.
- [ ] Tune Link Agent prompt for story/process chains.
- [ ] Record model/cost tradeoffs.

Acceptance:

- Prompt changes pass the baseline examples more reliably than current defaults.

## Suggested First Sprint

Sprint goal:

Make the system prove whether Knowledge Base and graph context are working before
changing major prompts.

Recommended tasks:

1. Run baseline checks.
2. Add Knowledge Base status/empty-state diagnostics.
3. Review and enrich the three Markdown agent files with more CTO/domain content.
4. Keep adding tests for meeting-style Knowledge routing and local search.
5. Add graph diagnostics and one graph-driven evaluation question.
6. Only then tune classifier and Knowledge Planner prompts.

Expected deliverables:

- `Knowledge Base` tab clearly shows missing/present docs.
- The system clearly distinguishes built-in Markdown knowledge from uploaded docs.
- Chat run trace clearly says whether Knowledge Base fired and what it found.
- Baseline question "Who was the delayed supplier?" has a trace that shows:
  - classifier decision
  - Knowledge vocabulary decision
  - Knowledge Planner result
  - hybrid search result count
  - graph search result count
  - reranker result count
  - final source list
- A small evaluation checklist exists for future prompt/model changes.

## Open Decisions

1. Should editable production Knowledge Base docs eventually move to Supabase?
   Built-in agent docs are now repo Markdown files, while uploaded local docs are
   still not durable on serverless deployments.

2. How detailed should the first three Markdown agents become before graph work?
   The structure is implemented, but the domain content can keep improving.

3. Should graph rebuilds happen manually, on schedule, or after content import?
   The current code supports graph storage/search, but ownership of rebuild timing
   should be explicit.

4. Should story/process mode be part of Timeline or Link Agent UI?
   Product-wise it belongs near Link Agent, but users may expect it inside
   Timeline because the output is an ordered event chain.

5. What is the minimum acceptable evidence rule?
   Recommendation: graph can suggest relationships, but final factual claims need
   project evidence from retrieval, tool results, timeline events, or graph edges
   that point back to source records.

## First Implementation Recommendation

Start with P0:

1. Enrich the three Markdown Knowledge agents with deeper domain guidance.
2. Add run-trace visibility for built-in versus uploaded Knowledge matches.
3. Add one DB-dependent manual evaluation for "Who was the delayed supplier?"
4. Add graph diagnostics and one graph-driven evaluation question.

This directly addresses the CTO concern that Knowledge Base "does not really
work" and creates the foundation needed before improving chat, graph reasoning,
Link Agent, or prompt/model tuning.
