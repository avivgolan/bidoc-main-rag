---
note_type: durable-memory-root
project: bidoc agent
status: active
last_updated: 2026-05-07
tags:
  - bedrock
  - memory
---

# Memory: bidoc agent

## Purpose

bidoc-agent is a Hebrew-language RAG (Retrieval-Augmented Generation) AI assistant for the **JFrog construction project**. It answers project-management questions by searching a Supabase vector database and calling n8n tool webhooks, then synthesising answers via OpenRouter LLMs.

## Stack

- **Runtime:** Node.js ≥ 20, ES modules (`"type": "module"`)
- **Server:** Plain `node:http` on port 4000 locally; default-exported handler for Vercel
- **LLMs:** OpenRouter API — classifier (`gpt-4o-mini`), lite (`gpt-4o-mini`), main (`gpt-4o`), reranker (`gpt-4o-mini`), knowledge-planner (`gpt-4o`)
- **Vector DB:** Supabase (PostgreSQL + pgvector) via REST; RPC `hybrid_match_data_index_embeddings_gf_dor_agent`
- **Knowledge Base:** Supabase table `knowledge_documents` with `.txt`/`.md` content, text chunking, tag/keyword scoring
- **Tool integrations:** n8n webhooks — 10 tools: alert, meetings, emails, whatsapp_messages, financial_transactions, consultants_reports, exceptions_report, quality_control, safety_report, submittals
- **Frontend:** Vanilla JS + CSS, RTL Hebrew UI, SSE live run log, workflow graph, agents editor, KB manager, tools/evaluation screen, reset page, tab routing via URL hash
- **Deployment:** Vercel (serverless) + local dev `node src/server.js`
- **Settings persistence:** Supabase `agent_settings` table (id=`default`, JSON `data` column); 30s TTL cache

## Request Flow

```
User message
  → sanitize.js
  → save to Supabase (chat_messages_gf)
  → load memory + local conversation summary
  → classify (classifier.js → OpenRouter)
      ├── CHAT  → runLiteAgent  (greetings, time/date, small talk)
      └── RAG   → runRagAgent
                    → if HIGH urgency: safety_report + alert precheck
                    → if investigation: build investigation plan
                    → if professional: runKnowledgePlanner (Supabase KB)
                    → hybridSearch raw query first; optional planner queries after
                    → reranker (OpenRouter)
                    → n8n tool calls (skipped if webhooks not configured)
                    → source quality scoring + conflict detection
                    → synthesizeAnswer (Main RAG Agent)
  → update Supabase with answer
  → emit SSE run events to frontend
```

## Key Files

| File | Role |
|------|------|
| `src/server.js` | HTTP server, all `/api/*` routes |
| `src/agent.js` | Full pipeline: classify → lite/RAG → synthesize |
| `src/config.js` | Settings cache, Supabase persistence, `getConfig()` |
| `src/classifier.js` | LLM classifier + normalisation |
| `src/heuristics.js` | Fallback classifier (no API needed) |
| `src/prompts.js` | All 5 agent prompts + `renderPrompt()` |
| `src/knowledge.js` | Supabase-backed Knowledge Base CRUD + text search |
| `src/clock.js` | Timezone-aware datetime (`getProjectDateTime()`) |
| `src/openrouter.js` | `chatCompletion()`, `rerankWithLlm()`, `createEmbedding()` |
| `src/supabase.js` | `hybridSearch()`, messages CRUD, memory |
| `src/tools.js` | n8n webhook calls |
| `src/memory.js` | Local fallback memory plus conversation summary |
| `src/sourceQuality.js` | Source reliability scoring and lightweight conflict detection |
| `public/app.js` | Frontend: tabs, chat, workflow, agents, settings |
| `public/index.html` | RTL Hebrew SPA shell |

## Current State

- All core features working
- Git branch: `main` (renamed from master 2026-05-07)
- Remote: `https://github.com/avivgolan/bidoc-main-rag`
- `/api/system/restart` exists for local Node restart only; it is not meaningful on Vercel serverless
- Known issue: Supabase "User not found" on hybrid_search — likely wrong service role key stored in settings; workaround: re-enter key in Settings → Save

## Recent Changes

- 2026-05-07 — Workflow tab redesigned as a Bedrock-like graph canvas with visible cable arrows and click-to-inspect Input/Output panel
- 2026-05-07 — Added local Memory Summary and Investigation Mode for complex causal/accountability questions
- 2026-05-07 — Added source quality scoring, conflict detection, and Evaluation Mode under the Tools screen (`POST /api/evaluations/run`)
- 2026-05-07 — Agent boundary enforcement added: safety precheck before retrieval, Knowledge Planner safe skip, planner RAG queries/tools, and explicit Knowledge Plan evidence boundary
- 2026-05-07 — Reset tab and `POST /api/system/restart` added for local test restarts
- 2026-05-07 — Knowledge Base moved to Supabase `knowledge_documents`; UI supports upload/list/view/delete/search
- 2026-05-07 — Professional Knowledge Agent runs before RAG when classifier sets `professional: true`
- 2026-05-07 — Vercel-compatible `export default handler` added in `src/server.js`
- 2026-05-07 — URL hash tab routing added; browser Back/Forward follows UI tabs
- 2026-05-07 — `src/clock.js` unified timezone module; timezone selector in Settings UI
- 2026-05-07 — Run log moved to Workflow tab; full-log/copy/clear buttons added
- 2026-05-07 — Classifier routing fixed (time/date → CHAT; project queries → RAG)
- 2026-05-07 — Stale Supabase prompts migration (`__prompts_clean_v1`): clears old cached defaults on first boot
- 2026-05-07 — `writeLocalSettings` now stores only non-default prompt deltas
- 2026-05-07 — Ctrl+Enter keyboard shortcut for chat submit
- 2026-05-07 — `max_tokens: 4096` cap on all OpenRouter calls (prevents credit overrun)
- 2026-05-07 — Startup logs: OpenRouter/Supabase/Timezone status printed on every boot

## Branches

- [agents.md](agents.md) — All 5 agents: prompts, models, routing logic
- [decisions/decisions.md](decisions/decisions.md) — Architectural decisions log
- [known-issues.md](known-issues.md) — Active bugs and workarounds
