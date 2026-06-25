---
note_type: durable-memory-root
project: bidoc agent
status: active
last_updated: 2026-05-09
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
- Main chat, subagents, timeline, and stack notes are tracked as separate branches.
- Timeline UI behavior is tracked in [timeline.md](timeline.md).
- Workflow QA inspector behavior is tracked in [workflow.md](workflow.md).
- AI project insights are tracked in [insights.md](insights.md); delay claim case infrastructure is tracked separately in [delay-claims.md](delay-claims.md).

## Recent Changes

- 2026-05-08 - Bootstrapped minimal memory root.
- 2026-05-08 - Added timeline branch note after fixing timeline viewport controls.
- 2026-05-09 - Completed initial branch onboarding for stack, chat, and subagents.
- 2026-06-23 - Added Workflow QA inspector memory after MVP node-card implementation.
- 2026-06-24 - Added delay claim infrastructure memory after Stage 1 implementation.
- 2026-06-24 - Added Insights memory after resetting the product direction from claim files to AI project insights.

## Decisions

- [decisions/decisions.md](decisions/decisions.md) - Decision log.

## Open Questions

- Which decisions should be recorded explicitly from existing docs and code?

## Branches

- [stack.md](stack.md) - Runtime, deployment, persistence, and test command notes.
- [chat.md](chat.md) - Main chat pipeline, classifier output, RAG routing, and tool-call flow.
- [subagents.md](subagents.md) - Alert subagent configuration, endpoint, and date-filter behavior.
- [timeline.md](timeline.md) - Timeline page frontend behavior and interaction notes.
- [workflow.md](workflow.md) - Workflow QA inspector UI, run history selection, and node-card debug display.
- [delay-claims.md](delay-claims.md) - Insights tab, delay claim schema, CRUD/API, and Stage 1 constraints.
- [insights.md](insights.md) - AI project insights direction, index-first analysis endpoint, and current UI behavior.
