---
note_type: decisions-index
project: bidoc agent
status: active
last_updated: 2026-05-07
tags:
  - bedrock
  - decision
---

# Decisions

## Purpose

Architectural and process decisions that affect this project.

## Decisions

### D-001 — No web framework (plain node:http)
- **Date:** project inception
- **Decision:** Use Node.js built-in `http` module instead of Express/Fastify
- **Rationale:** Minimal dependencies, easier Vercel serverless export

### D-002 — OpenRouter as LLM gateway (not direct OpenAI)
- **Date:** project inception
- **Decision:** All LLM calls go through OpenRouter (`openrouter.ai/api/v1`)
- **Rationale:** Single API key for multiple models; easy model swapping without code changes

### D-003 — Supabase for both vector search and settings persistence
- **Date:** project inception
- **Decision:** Supabase stores chat messages, vector embeddings (pgvector), and agent settings (`agent_settings` table)
- **Rationale:** Single managed Postgres instance covers messages, RAG index, and config

### D-004 — Settings in Supabase with env-var bootstrap fallback
- **Date:** 2026-05-06
- **Decision:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` must come from env vars (`.env.local` or Vercel env). All other settings (OpenRouter key, models, prompts) stored in Supabase `agent_settings`.
- **Rationale:** Prevents circular dependency (can't load Supabase URL from Supabase)

### D-005 — Store only non-default prompt deltas in Supabase
- **Date:** 2026-05-07
- **Decision:** `writeLocalSettings` only persists prompts that differ from current `defaultPrompts()`. Default prompts are never stored.
- **Rationale:** Prevents stale Supabase-cached prompts from overriding new code-level prompt improvements after deploys

### D-006 — UTC offset-based timezone (no Intl API)
- **Date:** 2026-05-07
- **Decision:** `src/clock.js` calculates local time using manual UTC offset math
- **Rationale:** Works in all Node.js environments without locale/timezone database dependencies

### D-007 — max_tokens: 4096 cap on all LLM calls
- **Date:** 2026-05-07
- **Decision:** All `chatCompletion()` calls include `max_tokens: 4096`
- **Rationale:** Expensive models (e.g. gpt-5.5-pro) default to 65536 tokens, causing credit exhaustion

### D-008 — Git branch named `main` (not master)
- **Date:** 2026-05-07
- **Decision:** Renamed local branch from `master` to `main`, tracking `origin/main`
- **Rationale:** Align with GitHub default and remote repo convention

### D-009 — Knowledge Base documents stored in Supabase
- **Date:** 2026-05-07
- **Decision:** Store Professional Knowledge Agent documents in Supabase table `knowledge_documents` instead of local disk.
- **Rationale:** Works across Vercel/serverless deploys and keeps uploaded KB content available beyond one local machine.

### D-010 — Reset page is for local development only
- **Date:** 2026-05-07
- **Decision:** Add `POST /api/system/restart` and a Reset UI tab for local `node src/server.js` testing.
- **Rationale:** Speeds local iteration after code changes. Serverless deployments should be restarted/redeployed through the hosting platform.

### D-011 — Vercel-compatible HTTP handler
- **Date:** 2026-05-07
- **Decision:** `src/server.js` exports `handler` as default and only starts `http.createServer()` when `process.env.VERCEL` is absent.
- **Rationale:** One entrypoint supports both local development and Vercel serverless routing.

### D-012 — Agent boundary enforcement in orchestrator
- **Date:** 2026-05-07
- **Decision:** Keep agent-to-agent information transfer controlled by `src/agent.js`: Knowledge Planner may add search/tool guidance, but final facts must come from project retrieval/tool results; HIGH urgency runs safety precheck before retrieval.
- **Rationale:** Prevents professional KB guidance from becoming uncited project evidence and makes safety routing deterministic in code, not only in prompts.

### D-013 — Lightweight evaluation and evidence quality layer
- **Date:** 2026-05-07
- **Decision:** Add deterministic source quality scoring and regex-based conflict detection before final synthesis, plus `POST /api/evaluations/run` and an Evaluation section inside the Tools screen for repeatable checks.
- **Rationale:** Improves trustworthiness without adding another LLM dependency, and gives local/manual regression testing for routing, tools, sources, and conflicts.

### D-014 — Local Memory Summary and Investigation Mode
- **Date:** 2026-05-07
- **Decision:** Keep a local conversation summary in `src/memory.js` and pass it as non-evidence context; mark complex causal/accountability/comparison questions as Investigation Mode and pass an `investigation_plan` to Main RAG.
- **Rationale:** Improves conversational continuity and forces complex answers to show what was checked without treating memory as project evidence.
