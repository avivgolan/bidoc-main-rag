# AI Project Insights Roadmap

Date: 2026-06-24

Purpose: build the `Insights` page as an AI layer over the project index. This is not a claim file, not a legal workflow, and not a delay-claim case manager. The first product promise is: read the indexed project data, surface useful project insights, and show the evidence behind each insight.

## Product Direction

The page should answer:

- What is happening in the project?
- What looks stuck, risky, repeated, missing, or important?
- Which decisions or approvals need attention?
- Which people, suppliers, documents, or topics appear central?
- What should the project team look at next?

Every insight must be grounded in source evidence from the index.

## Principles

- Start from the existing Content Index.
- Do not create a separate claim/case workflow.
- Do not make legal, financial entitlement, or critical-path conclusions.
- Every insight must include evidence references.
- Separate observation from recommendation.
- Keep human review in the loop with a simple status.
- Use Workflow logs so the user can see what the agent did.

## Stage 1 - Index-First AI Insights MVP

### Goal

Create a usable `Insights` page where the user can run an AI project scan over indexed data and receive evidence-backed insight cards.

### Inputs

- Optional focus query.
- Optional date range.
- Source limit.
- Existing Content Index rows.
- Hybrid retrieval when a focus query is provided.

### Output

Each insight card must include:

- Title.
- Category.
- Severity.
- Confidence.
- What the agent noticed.
- Why it matters.
- Recommended next action.
- Human status: new, reviewing, accepted, dismissed.
- Evidence from index rows.

### Stage 1 Categories

- Blockers and stuck items.
- Open decisions and approvals.
- Missing information.
- Repeated topics.
- Commercial or budget signals.
- Quality and safety signals.
- Key entities or active participants.

### Technical Components

- `src/subagents/projectInsights.js`
  - Load records from Content Index.
  - Use hybrid search when focus query exists.
  - Run AI synthesis when OpenRouter is configured.
  - Fall back to deterministic signal detection when AI is unavailable.
  - Build Workflow log.

- `POST /api/insights/analyze`
  - Accept `focusQuery`, `dateFrom`, `dateTo`, `limit`.
  - Return summary, insights, evidence, runId, workflowLog.

- `#insights` UI
  - Primary action: analyze project.
  - Display insight cards.
  - Allow local human status per insight.
  - Link to Workflow run.

### Boundaries

- No claim file.
- No delay-event tables.
- No schedule calculations.
- No cost entitlement calculations.
- No new Supabase tables in Stage 1.

## Stage 2 - Insight Workspace

- Persist reviewed insights only after the MVP is useful.
- Add filters by category, severity, source, date, and status.
- Add drill-down per insight with grouped evidence.
- Add ability to ask follow-up questions about a single insight.

## Stage 3 - Proactive Monitoring

- Save insight runs.
- Detect newly emerging or worsening insights.
- Compare current run to previous run.
- Highlight changes since last review.

## Stage 4 - Domain Agents

Only after the general insights loop works:

- Schedule insight agent.
- Commercial insight agent.
- Safety and quality insight agent.
- Procurement and supplier insight agent.
- Document/compliance insight agent.

These agents produce insights, not claim packages.
