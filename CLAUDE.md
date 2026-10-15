# BiDoc Main RAG Agent — Developer Guide

## Project Overview

A Node.js HTTP server (no framework) that powers a construction-project AI assistant.  
It combines hybrid vector/keyword search (a Project's Company DB on Supabase), LLM inference (OpenRouter), optional n8n tool integrations, and a knowledge base of files shipped with the code to answer questions about a project. It serves two kinds of request, never mixed (see "Two request modes"): Project requests from BiDoc and the ingest engine, and Lab requests from a signed-in Superadmin.

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
  requestMode.js  — Request mode (Project or Lab), route access, per-mode config connections
  labDataset.js   — The Lab dataset (MAIN's copy of the Company DB tables): Lab Project id, empty-state error
  companyDb.js    — Company DB connection of a Project request + Meta cross-check
  metaSettings.js — Meta DB read + save_agent_settings RPC
  settingsSchema.js — schema check of a Lab settings save
  contracts/switches.js — Contracts approval switches + bucket (settings, then env)
  heuristics.js   — Date/filter heuristics
  knowledge.js    — Knowledge base: agent documents from files in knowledge-base/agents/ (shipped with the code), plus local uploads
  memory.js       — Session memory helpers (Lab only: the memory tables live in MAIN)
  chatMemory.js   — Lab chat memory (MAIN); projectChatHistory.js builds a Project's history from its Company DB
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

knowledge-base/
  agents/         — Knowledge agent documents (.md), committed and shipped with the code (read-only on Vercel)

data/
  knowledge-base/ — local uploads (gitignored, ephemeral on Vercel)

test/
  run-tests.js    — Integration tests
```

---

## Environment Variables

Secrets and connections are read from environment variables; everything else (prompts, models, presets, search tuning, time zone, Contracts approval switches and bucket) lives in the agent settings in the Meta DB (see "How Settings Work"), with the env var below as a fallback until it is removed. For local development, place them in `.env.local` (gitignored). For Vercel, set them in the Vercel dashboard.

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `SUPABASE_URL` | MAIN: main-agent's own database, the Lab's. Reachable only by a Lab request; a Project request has no MAIN connection |
| `SUPABASE_SERVICE_ROLE_KEY` | MAIN service role key (bypasses RLS) |
| `BIDOC_API_SECRET` / `INGEST_API_SECRET` | The machine secrets of a Project request (`x-bidoc-api-secret`): the BiDoc web app and the ingest engine |
| `MAIN_AGENT_SESSION_SECRET` | Signs the Lab's Superadmin session cookie (falls back to `BIDOC_API_SECRET`) |
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

### Two request modes

Every request is exactly one mode, decided once in `handleApi` from its credentials (`src/requestMode.js`, ADR 0012). The mode decides which database connections exist in the request config, so the other mode's paths fail closed.

| | Project mode | Lab mode |
|---|---|---|
| Who | BiDoc web app, ingest engine | A Superadmin signed in to main-agent's own screens |
| Credentials | machine secret in `x-bidoc-api-secret` (`BIDOC_API_SECRET` / `INGEST_API_SECRET`), plus `x-project-id`, `x-content-supabase-url` and `x-content-supabase-key` | Superadmin session cookie (BiDoc login) |
| Connections | that Project's own Company DB, plus the Meta settings read | MAIN (its own Lab tables and the Lab dataset in it), plus the Meta settings save route (`PUT /api/settings`) |
| MAIN | none: `supabaseUrl` / `supabaseServiceRoleKey` are stripped from the request config and every MAIN reader or writer throws `main_unavailable_in_project_mode` | its database |
| Company DB headers | required | refused (400 `lab_mode_has_no_company_db`) |

- A request that carries the machine secret is a Project request even if it also carries a session cookie (the cookie is ignored; it never opens MAIN). A wrong secret is refused (401), never rescued by a cookie.
- `routeAccess()` sorts every `/api` route: `project` (default: new routes need a Company DB), `lab` (MAIN: sessions, run history, QA, AI reports, delay claims, schedule assignment reviews, memory, the Lab dataset status, Contracts, dashboard), `shared` (settings, agents, knowledge files, model list, run stream: no data connection of their own) or `both` (annotate, and the screens that read a Project's content: chat, insights, timeline, graph, schedule, indexing, tools, alert and data-query agents). A route of the other mode is refused (403 `route_requires_lab_mode` / `route_requires_project_mode`) before any database call. The Contracts lab keeps its own fixed connection (`contractsServerConfig`) and stays on the Lab side.
- **Project mode** stores nothing of its own: no chat copy, no memory summary, no long-term memory item, no annotate vote, no local memory log. The conversation history is read from BiDoc's `chat_sessions` / `chat_messages` in the Company DB (`src/projectChatHistory.js`); the compact `runTrace` travels with the answer for BiDoc to save in the message metadata; `messageId` in the answer is `null`. `POST /api/messages/:id/annotate` is accepted and ignored (`{ ok: true, ignored: true }`): BiDoc keeps the vote in its own `chat_messages.annotation`.
- Project data (chat, insights, search, data query, alerts, indexing, schedule, graph, timeline) lives only in the named Company DB. There is no global content DB and no MAIN fallback: a Project route without Company DB headers and a Project is refused (400 `company_db_required`) before any database call. Insight runs (`project_insight_runs`) are read and written by run id AND Project.
- **Lab mode** works only on MAIN. Company DB headers on it are refused, and no Lab request contacts a Company DB (the Contracts lab keeps its own fixed `contractsServerConfig` connection). The screens that read a Project's content (chat, insights, dashboard, timeline, graph, schedule, indexing, QA runs, tools) read the **Lab dataset**: the Company DB template tables (same table and RPC names, from the settings' `contentSource`) in MAIN, labelled with the Lab Project id (`LAB_PROJECT_ID` in `src/labDataset.js`) unless the request names a Project. A Lab chat keeps its messages and memory in MAIN, and its votes. While those tables are missing or empty (until ticket 06 seeds them) a read answers the empty state "אין נתוני Lab — טען מערך בדיקה" (`GET /api/lab/dataset` reports it, the screens show a notice). The Lab sign-in is the BiDoc login (`POST /api/auth/login`, Superadmin profiles only, `BIDOC_META_SUPABASE_URL` / `BIDOC_META_SUPABASE_ANON_KEY`). There is no Reset menu item or route.

> **Never commit `.env.local` or `data/settings.json`** — both are in `.gitignore`.

---

## Databases

### Rule: persistent mutable state lives in a database, never on the local filesystem (Vercel's filesystem is ephemeral).

main-agent touches three kinds of database, and a request touches only the ones of its mode:

| Database | Holds | Project request | Lab request |
|---|---|---|---|
| **Company DB** (one per Company, named by the request headers) | Project content: emails, files, index rows, alerts, graph, timeline, BiDoc's chat sessions and messages, insight runs | its own, read (and its insight runs and indexing writes) | never |
| **MAIN** (`SUPABASE_URL`) | Lab data only: test chats (`chat_messages_gf`), chat memory (`chat_session_memory`, `chat_memory_items`, see `supabase/chat-agent-memory.sql`), QA suites and reports (`qa_*`), delay claims, schedule assignment reviews, and the Lab dataset (the Company DB template tables, copied in by ticket 06) | never | yes |
| **Meta DB** (`META_SUPABASE_*`) | the agent settings (`agent_settings`) and their change log | read | the narrow settings save route only |

Memory locations: in Project mode there is no memory store; history comes from the Company DB chat messages and older turns are summarised on the fly for that request. In Lab mode the memory tables are in MAIN.

Old Project chat copies and memory summaries that earlier versions wrote to MAIN (keyed by `bidoc:<projectId>:` sessions) are no longer written; a separate one-off cleanup removes the ones already there.

### `agent_settings` — agent settings (Meta DB, not MAIN)

The settings are one row of the **Meta DB** table `agent_settings` (`key = 'main-agent'`, `value` jsonb); migration `supabase/migrations/20261016140000_agent_settings_change_log.sql` in the BiDoc repo. Only a Superadmin (or the service role) reads or writes it. The row holds:
- `models` — model overrides per agent (never `embedding`: env only)
- `prompts` — prompt overrides per agent
- `retrieval`, `ai`, `rag`, `graph`, `insights`, `cache`, `memory`, `knowledge`, `subagents`, `presets`, `timezone` — tuning
- `tools` + `toolsRuntime` — n8n tool webhook URLs and runtime
- `contracts` — `approvals` (13 booleans, see `src/contracts/switches.js`) and `storageBucket`; a switch that is absent follows its `CONTRACTS_*_APPROVED` env var

It never holds `secrets`, `contentSource` or `n8nBaseUrl` (the Meta DB refuses them): the OpenRouter key and database keys are env only, the n8n base URL is `N8N_BASE_URL`. Every change is appended to `agent_settings_log` (who, when, diff); the table is append-only.

MAIN's own `agent_settings` table is no longer read. It was copied once to Meta with `scripts/seed-main-agent-settings.mjs` in the BiDoc repo.

### Knowledge base is files, not a table

There is no `knowledge_documents` table. The Knowledge agents' documents are `.md` files under `knowledge-base/agents/` that ship with the code; uploads written from the UI go to `data/knowledge-base/` on the local filesystem (gitignored; ephemeral on Vercel, so effectively read-only there).

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
**To override at runtime without a deploy:** use the Agents tab in the UI (a Superadmin Lab save) — stored in the Meta DB. A save changes production at once, with no draft step and no reset-to-defaults; every save is logged (who, when, diff), and the settings screens (סוכן ראשי, סוכני משנה, זרימת עבודה, בדיקת כלים, הגדרות) say so.

---

## How Knowledge Base Works

Documents are files: the built-in Knowledge agent documents in `knowledge-base/agents/<agent>/` (committed, read-only) and local uploads in `data/knowledge-base/` (gitignored). `src/knowledge.js` reads them from disk; nothing is read from a database. On Vercel (`VERCEL` set) the Knowledge Base is read-only: upload and delete answer 405 `knowledge_read_only` and the screen says so; to change a document, commit it to `knowledge-base/agents/`.

`searchKnowledgeBase()` loads the documents and does local tokenized scoring — no vector embedding is used for the knowledge base.

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

**Vercel filesystem is ephemeral** — never write anything important to disk. Use the database of the request's mode (see "Databases").

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
- `data/knowledge-base/` — gitignored (local uploads only; the built-in documents are in `knowledge-base/agents/`)
- Migrations are **never run from code** — always manual via Supabase SQL Editor
- All environment-specific config goes in Vercel env vars or `.env.local`
