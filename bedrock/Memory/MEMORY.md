---
note_type: durable-memory-root
project: bidoc agent
status: active
last_updated: 2026-08-22
tags:
  - bedrock
  - memory
---

# Memory: bidoc agent

## Purpose

Landing page for curated project memory. Keep this file short and use it to route into
the right branch notes.

## Current State

- Node.js HTTP server and plain SPA for a construction-project RAG assistant.
- STRATEGIC DIRECTION (2026-07-03, from the user): the n8n agents/tools are being phased out in favor of internal in-code agents (src/subagents/*). New agent work must be implemented internally, not as n8n workflows.
- Main chat, subagents, timeline, and stack notes are tracked as separate branches.
- Timeline UI behavior is tracked in [timeline.md](timeline.md).
- Workflow QA inspector behavior is tracked in [workflow.md](workflow.md).
- AI project insights are tracked in [insights.md](insights.md); delay claim case infrastructure is tracked separately in [delay-claims.md](delay-claims.md).
- The Phase 1 QA & Tuning MCP harness is tracked in [qa-tuning.md](qa-tuning.md).

## Recent Changes

- 2026-05-08 - Bootstrapped minimal memory root.
- 2026-05-08 - Added timeline branch note after fixing timeline viewport controls.
- 2026-05-09 - Completed initial branch onboarding for stack, chat, and subagents.
- 2026-06-23 - Added Workflow QA inspector memory after MVP node-card implementation.
- 2026-06-24 - Added delay claim infrastructure memory after Stage 1 implementation.
- 2026-06-24 - Added Insights memory after resetting the product direction from claim files to AI project insights.
- 2026-08-22 - Added and deployed the Phase 1 QA & Tuning MCP service, schema, local stdio tools, and isolated execution memory.

## Decisions

- [decisions/decisions.md](decisions/decisions.md) - Decision log.

## Open Questions

- Which decisions should be recorded explicitly from existing docs and code?

## Branches

- [stack.md](stack.md) - Runtime, deployment, persistence, and test command notes.
- [chat.md](chat.md) - Main/Lite chat pipeline, persistent session and user memory, standalone-query rewriting, RAG routing, and tool-call flow.
- [subagents.md](subagents.md) - Alert behavior plus the Data Query Agent security, exactness, reusable caller contract, and managed service-account authentication.
- [timeline.md](timeline.md) - Timeline page frontend behavior and interaction notes.
- [workflow.md](workflow.md) - Workflow QA inspector UI, run history selection, and node-card debug display.
- [delay-claims.md](delay-claims.md) - Insights tab, delay claim schema, CRUD/API, and Stage 1 constraints.
- [insights.md](insights.md) - AI project insights direction, index-first analysis endpoint, and current UI behavior.
- [n8n-migration.md](n8n-migration.md) - n8n phase-out mapping, migration spec, and the internal indexing agent.
- [schedule.md](schedule.md) - Schedule engine, contractual milestones, pending-condition resolution through chat RAG, and evidence gates.
- [qa-tuning.md](qa-tuning.md) - Phase 1 QA harness, local MCP tools, isolated execution, traces, evaluation, and deferred experiment/promotion phases.
