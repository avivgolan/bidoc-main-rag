# BiDoc Main RAG Agent — Developer Guide

## Project Overview

A Node.js HTTP server (no framework) that powers a construction-project AI assistant.  
It combines hybrid vector/keyword search (Supabase), LLM inference (OpenRouter), optional n8n tool integrations, and a local knowledge base to answer questions about a project.

The frontend is a plain HTML/CSS/JS single-page app served from `public/`.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20, ESM (`"type": "module"`) |
| HTTP server | `node:http` (no Express) |
| Database | Supabase (Postgres + REST API) |
| LLM / Embeddings | OpenRouter |
| Automation tools | n8n webhooks |
| Deployment | Vercel (`@vercel/node`) |

---

## Project Structure

```
src/
  server.js       — HTTP server, all API routes
  agent.js        — Main RAG pipeline
  classifier.js   — Message classifier (CHAT vs RAG)
  config.js       — Settings cache + Supabase persistence
  heuristics.js   — Date/filter heuristics
  knowledge.js    — Knowledge base CRUD (Supabase-backed)
  memory.js       — Session memory helpers
  openrouter.js   — LLM + embedding + reranker calls
  prompts.js      — Agent definitions and default prompts
  runLog.js       — SSE run-event log per request
  sanitize.js     — Input sanitization
  server.js       — HTTP entry point
  supabase.js     — Supabase REST client (chat messages, hybrid search)
  tools.js        — n8n tool invocation
  types.js        — Shared type helpers
  settings.json   — (src/ only, not data/) static src settings reference

public/
  index.html      — SPA shell
  app.js          — All frontend logic
  styles.css      — Design system + component styles

data/
  knowledge-base/ — (empty, kept for local fallback structure)

test/
  run-tests.js    — Integration tests
```

---

## Environment Variables

All configuration is read from environment variables. For local development, place them in `.env.local` (gitignored). For Vercel, set them in the Vercel dashboard.

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `MAIN_MODEL` | Default: `openai/gpt-4o` |
| `LITE_MODEL` | Default: `openai/gpt-4o-mini` |
| `CLASSIFIER_MODEL` | Default: `openai/gpt-4o-mini` |
| `KNOWLEDGE_PLANNER_MODEL` | Default: `openai/gpt-4o` |
| `EMBEDDING_MODEL` | Default: `text-embedding-3-large` |
| `RERANKER_MODEL` | Default: `openai/gpt-4o-mini` |
| `HYBRID_RPC_NAME` | Supabase RPC function name for hybrid search |
| `HYBRID_CANDIDATES` | Number of hybrid search candidates (default: 40) |
| `RERANK_TOP_K` | Results after reranking (default: 10) |
| `HYBRID_VECTOR_WEIGHT` | Default: 0.65 |
| `HYBRID_KEYWORD_WEIGHT` | Default: 0.35 |
| `N8N_BASE_URL` | Base URL for n8n webhooks |
| `N8N_TOOL_<NAME>_URL` | Override URL for a specific tool webhook |
| `PORT` | Server port (default: 4000) |

> **Never commit `.env.local` or `data/settings.json`** — both are in `.gitignore`.

---

## Supabase Database

### Rule: All persistent mutable state lives in Supabase — never on the local filesystem.

The project uses three Supabase tables:

### `agent_settings` — Application settings and agent prompts

```sql
create table if not exists agent_settings (
  id         text primary key default 'default',
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

insert into agent_settings (id, data)
values ('default', '{}')
on conflict (id) do nothing;
```

Stores a single JSON row (`id = 'default'`) containing:
- `models` — model overrides per agent
- `prompts` — prompt overrides per agent
- `retrieval` — hybrid search tuning
- `n8nBaseUrl` + `tools` — n8n webhook URLs
- `secrets` — API key overrides (prefer env vars for these)

### `knowledge_documents` — Local knowledge base

```sql
create table if not exists knowledge_documents (
  filename   text primary key,
  content    text not null default '',
  updated_at timestamptz not null default now()
);
```

Stores `.md` and `.txt` knowledge documents used by the Professional Knowledge Agent.

### `chat_messages_gf` — Chat history (pre-existing)

Stores user/AI messages per session. Used for memory and history tab.  
Schema is managed separately — do not modify without understanding the hybrid search RPC dependencies.

---

## How Settings Work (In-Memory Cache)

Settings are loaded from Supabase once at startup and cached in memory with a **30-second TTL**. This means:

- Changes made on Vercel appear locally within 30 seconds (no restart needed).
- Every write updates both the in-memory cache and Supabase atomically.
- `getConfig()` is synchronous — it always reads from the in-memory cache.
- On Vercel cold starts, `initSettings()` runs before the first request is handled.

**Read flow:** `getConfig()` → `readLocalSettings()` → `_settingsCache`  
**Write flow:** `writeLocalSettings()` → update `_settingsCache` + upsert `agent_settings` in Supabase  
**Refresh:** `refreshSettingsIfStale()` is called on every request; re-fetches from Supabase if cache is older than 30s

---

## How Agent Prompts Work

Default prompts are defined in `src/prompts.js` in `AGENT_DEFINITIONS`. These are the source of truth committed to git.

At runtime, `getConfig()` merges defaults with any overrides from `agent_settings.data.prompts`. Overrides win.

**To change a prompt permanently (for all environments):** edit `src/prompts.js` and push.  
**To override at runtime without a deploy:** use the Agents tab in the UI — saved to Supabase.

---

## How Knowledge Base Works

Documents are stored in the `knowledge_documents` Supabase table. All CRUD operations in `src/knowledge.js` are async and use the Supabase REST API directly via `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` (never from the settings cache, to avoid circular dependency).

`searchKnowledgeBase()` fetches all documents from Supabase and does local tokenized scoring — no vector embedding is used for the knowledge base.

---

## Vercel Deployment

The project uses `vercel.json` to route all requests through `src/server.js` via `@vercel/node`.

```json
{
  "version": 2,
  "builds": [{ "src": "src/server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/src/server.js" }]
}
```

`server.js` detects the Vercel environment via `process.env.VERCEL`:
- On Vercel: exports `default handler` (serverless)
- Locally: starts `http.createServer(handler).listen(port)`

**Vercel filesystem is ephemeral** — never write anything important to disk. Always use Supabase.

---

## Making Database Changes

**Never run migrations directly from code.** When a schema change is needed:

1. Write the migration SQL.
2. Include it in the PR description or task notes.
3. The developer runs it manually in the **Supabase Dashboard → SQL Editor**.

Example pattern for adding a column:
```sql
alter table agent_settings add column if not exists version int default 1;
```

Example pattern for a new table:
```sql
create table if not exists my_new_table (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

---

## Frontend Routing

The SPA uses URL hash routing (`#chat`, `#agents`, `#settings`, etc.).

- Tab navigation updates `location.hash` and pushes to `history`.
- On page refresh, the hash is read and the correct tab is restored.
- Browser back/forward navigate between tabs via `popstate`.
- Each tab triggers its own data loader on navigation to avoid stale data.

| Hash | Data loader triggered |
|---|---|
| `#settings` | `loadSettings()` |
| `#agents` | `loadOpenRouterModels()` |
| `#knowledge` | `loadKnowledgeDocuments()` |
| `#history` | `loadHistory()` |

---

## Running Locally

```bash
node src/server.js
# → http://localhost:4000
```

No build step, no npm install needed — zero npm dependencies.

---

## Git Conventions

- `data/settings.json` — gitignored, never commit
- `.env.local` — gitignored, never commit
- `data/knowledge-base/` — gitignored (content lives in Supabase)
- Migrations are **never run from code** — always manual via Supabase SQL Editor
- All environment-specific config goes in Vercel env vars or `.env.local`
