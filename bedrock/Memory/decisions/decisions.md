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
