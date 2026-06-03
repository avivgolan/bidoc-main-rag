---
note_type: durable-memory-branch
project: bidoc agent
branch: stack
last_updated: 2026-06-03
tags:
  - stack
  - runtime
---

# Stack

## Current State

- The app is a Node.js >=20 ESM project with no npm dependencies.
- `package.json` exposes `dev`, `start`, and `test`; all run Node directly.
- The HTTP server is implemented with `node:http` in `src/server.js`.
- The frontend is a plain HTML/CSS/JS single-page app in `public/`.
- Deployment routes all requests through `src/server.js` using `vercel.json`.
- Persistent mutable state is expected to live in Supabase, not local data files.
- Runtime config separates App Supabase from optional Content Supabase: App DB stores settings, chat history, QA, timeline links, and graph tables; Content DB serves RAG, timeline event, and alert retrieval.
- Content Supabase can be configured with separate URL/key plus custom hybrid RPC, index table, alerts table, and alerts RPC; when omitted, content retrieval falls back to App Supabase and legacy table/RPC names.
- The current Content `data_index` schema uses `primary_date` for timeline dates and `index_text`/`summary`/`title` for content text, plus `source_url`, `source_table`, `source_id`, `project_id`, `mail_id`, `attachment_id`, and `mentioned_dates` for provenance.
- The current Content `alerts` schema uses `data_date` for timeline dates and `summary`/`alert_description`/`content`/`answer` for alert text, plus `alert_type`, `severity_level`, `data_link`, and `item_status`.
- `.env` and `.env.local` are resolved from the repository root based on `src/config.js`, not from the process working directory.
- Settings UI displays masked secrets only as placeholders; password fields stay empty so masked values are not submitted as real keys.
- Settings UI can export/import a local JSON settings file; export includes full unmasked API keys and connection fields, so the file must be handled as a secret.
- Settings UI model fields are OpenRouter-backed dropdowns that show context tokens and input/output pricing when available.
- Runtime config ignores masked secret values such as `sk-o...abcd` or `********` and falls back to environment variables.
- Supabase requests use `apikey` for `sb_secret_...` keys and add `Authorization: Bearer ...` only for legacy JWT keys that start with `eyJ`.

## Recent Changes

- 2026-05-09 -- Onboarded stack facts from `package.json`, `CLAUDE.md`, and repo layout.
- 2026-05-11 -- Fixed secret handling so masked OpenRouter/Supabase keys are never treated as saved credentials.
- 2026-05-12 -- Updated Supabase headers for new `sb_secret_...` service keys across settings, diagnostics, main Supabase calls, and Alert subagent search.
- 2026-05-12 -- Made env loading independent of the shell's current working directory and improved diagnostics for network-level fetch failures.
- 2026-06-03 -- Added a separate Content Supabase configuration for RAG/timeline/alerts while keeping application state on App Supabase.
- 2026-06-03 -- Mapped timeline/RAG previews to the new `data_index` schema fields (`primary_date`, `index_text`, `summary`, `title`, `source_url`, `mail_id`, `attachment_id`, `mentioned_dates`).
- 2026-06-03 -- Mapped alert timeline events to the new `alerts` schema fields (`data_date`, `alert_description`, `alert_type`, `severity_level`, `data_link`).
- 2026-06-03 -- Added local JSON settings export/import from the Settings page, including full secret values.
- 2026-06-03 -- Changed Settings model fields from free text to OpenRouter model dropdowns with context/pricing labels.

## Gotchas

- On this Windows machine, `npm.ps1` may be blocked by PowerShell execution policy; `node .\test\run-tests.js` runs the test suite directly.
- If Supabase already contains a masked key from an older save, the next settings save will clear that stored masked value; re-enter the real key if there is no env fallback.
- Content Supabase diagnostics expose the decoded key role; `anon` keys can return zero content rows under RLS even when the table exists, so timeline/RAG content should use a service-role key or matching read policies.
