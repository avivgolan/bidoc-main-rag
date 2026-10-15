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
  config.js       — Settings cache (read from / saved to the Meta DB) + env fallbacks
  metaSettings.js — Meta DB read + save_agent_settings RPC
  settingsSchema.js — schema check of a Lab settings save
  contracts/switches.js — Contracts approval switches + bucket (settings, then env)
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

Secrets and connections are read from environment variables; everything else (prompts, models, presets, search tuning, time zone, Contracts approval switches and bucket) lives in the agent settings in the Meta DB (see "How Settings Work"), with the env var below as a fallback until it is removed. For local development, place them in `.env.local` (gitignored). For Vercel, set them in the Vercel dashboard.

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `MAIN_MODEL` | Default: `openai/gpt-4o` |
| `LITE_MODEL` | Default: `openai/gpt-4o-mini` |
| `CLASSIFIER_MODEL` | Default: `openai/gpt-4o-mini` |
| `KNOWLEDGE_PLANNER_MODEL` | Default: `openai/gpt-4o` |
| `EMBEDDING_MODEL` | Default: `text-embedding-3-large`. Env only and read-only: never read from or saved to the settings, so stored embeddings keep matching |
| `RERANKER_MODEL` | Default: `openai/gpt-4o-mini` |
| `HYBRID_RPC_NAME` | Supabase RPC function name for hybrid search |
| `HYBRID_CANDIDATES` | Number of hybrid search candidates (default: 40) |
| `RERANK_TOP_K` | Results after reranking (default: 10) |
| `HYBRID_VECTOR_WEIGHT` | Default: 0.65 |
| `HYBRID_KEYWORD_WEIGHT` | Default: 0.35 |
| `N8N_BASE_URL` | Base URL for n8n webhooks |
| `N8N_TOOL_<NAME>_URL` | Override URL for a specific tool webhook |
| `CONTRACTS_INGESTION_SECRET` | Dedicated secret accepted in `X-Contracts-Ingestion-Secret` when n8n calls the dry-run Contracts extraction API |
| `META_SUPABASE_URL` / `META_SUPABASE_SERVICE_ROLE_KEY` | BiDoc's Meta DB. Both set: the agent settings are read from it (and saved to it by the Lab), and every Project request's Company DB headers are cross-checked (read-only) against it (`projects.company_id` → `companies.supabase_url`, `company_credentials`); a mismatch is refused (403). Not set: built-in defaults with a logged warning |
| `CONTRACTS_*_APPROVED` (13 switches), `CONTRACTS_STORAGE_BUCKET` | Fallback only: the settings section `contracts` wins when it names a switch (see `src/contracts/switches.js` for the list) |
| `CONTENT_SUPABASE_URL` / `CONTENT_SUPABASE_SERVICE_ROLE_KEY` | Superadmin Contracts tooling only (server-owned KAPAIM connection). Never used for a Project request |
| `PORT` | Server port (default: 4000) |

### Company DB rule

Everything main-agent does for a Project (chat, insights, search, data query, memory, alerts, indexing, schedule, graph, timeline) reads and writes only that Project's own Company DB, named by the authenticated caller in `x-content-supabase-url` / `x-content-supabase-key` plus `x-project-id` (see `src/companyDb.js`). There is no global content DB and no App DB fallback: a Project route without them is refused (400 `company_db_required`) before any database call. The App DB (MAIN) holds only main-agent's own tables (chat history keyed by `bidoc:<projectId>:` sessions, QA reports, delay claims with `project_id`). It no longer holds the settings: those are in the Meta DB, and a Project request never reads settings from MAIN (ADR 0012).

> **Never commit `.env.local` or `data/settings.json`** — both are in `.gitignore`.

---

## Supabase Database

### Rule: All persistent mutable state lives in Supabase — never on the local filesystem.

The project uses three Supabase tables:

### `agent_settings` — agent settings (Meta DB, not MAIN)

The settings are one row of the **Meta DB** table `agent_settings` (`key = 'main-agent'`, `value` jsonb); migration `supabase/migrations/20261016140000_agent_settings_change_log.sql` in the BiDoc repo. Only a Superadmin (or the service role) reads or writes it. The row holds:
- `models` — model overrides per agent (never `embedding`: env only)
- `prompts` — prompt overrides per agent
- `retrieval`, `ai`, `rag`, `graph`, `insights`, `cache`, `memory`, `knowledge`, `subagents`, `presets`, `timezone` — tuning
- `tools` + `toolsRuntime` — n8n tool webhook URLs and runtime
- `contracts` — `approvals` (13 booleans, see `src/contracts/switches.js`) and `storageBucket`; a switch that is absent follows its `CONTRACTS_*_APPROVED` env var

It never holds `secrets`, `contentSource` or `n8nBaseUrl` (the Meta DB refuses them): the OpenRouter key and database keys are env only, the n8n base URL is `N8N_BASE_URL`. Every change is appended to `agent_settings_log` (who, when, diff); the table is append-only.

MAIN's own `agent_settings` table is no longer read. It was copied once to Meta with `scripts/seed-main-agent-settings.mjs` in the BiDoc repo.

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

Settings are read from the Meta DB (`src/metaSettings.js`) and cached in memory for **3 minutes** (`SETTINGS_TTL_MS`):

- A change saved from the Lab reaches the instance that saved it at once and every other instance within 3 minutes.
- `getConfig()` is synchronous — it always reads from the in-memory cache, with env fallbacks for moved values.
- On Vercel cold starts, `initSettings()` runs before the first request is handled.
- If the Meta DB cannot be read (not configured, down, or no row yet) main-agent uses the built-in defaults plus env fallbacks and logs a warning; it never falls back to MAIN. A failed *refresh* keeps the last good settings and retries after 30 seconds.

**Read flow:** `getConfig()` → `readLocalSettings()` → `_settingsCache`  
**Write flow:** Lab `PUT /api/settings` (Superadmin session only, schema-checked by `src/settingsSchema.js`) → fresh strict read → `writeLocalSettings()` → the `save_agent_settings` RPC (row + change log in one transaction) → cache updated. There is no reset-to-defaults.  
**Refresh:** `refreshSettingsIfStale()` is called on every request.

---

## How Agent Prompts Work

Default prompts are defined in `src/prompts.js` in `AGENT_DEFINITIONS`. These are the source of truth committed to git.

At runtime, `getConfig()` merges defaults with any overrides from the Meta settings row (`prompts`). Overrides win.

**To change a prompt permanently (for all environments):** edit `src/prompts.js` and push.  
**To override at runtime without a deploy:** use the Agents tab in the UI (a Superadmin Lab save) — stored in the Meta DB.

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
