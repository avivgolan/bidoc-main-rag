---
note_type: durable-memory-branch
project: bidoc agent
branch: stack
last_updated: 2026-05-11
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
- `.env` and `.env.local` are resolved from the repository root based on `src/config.js`, not from the process working directory.
- Settings UI displays masked secrets only as placeholders; password fields stay empty so masked values are not submitted as real keys.
- Runtime config ignores masked secret values such as `sk-o...abcd` or `********` and falls back to environment variables.
- Supabase requests use `apikey` for `sb_secret_...` keys and add `Authorization: Bearer ...` only for legacy JWT keys that start with `eyJ`.

## Recent Changes

- 2026-05-09 -- Onboarded stack facts from `package.json`, `CLAUDE.md`, and repo layout.
- 2026-05-11 -- Fixed secret handling so masked OpenRouter/Supabase keys are never treated as saved credentials.
- 2026-05-12 -- Updated Supabase headers for new `sb_secret_...` service keys across settings, diagnostics, main Supabase calls, and Alert subagent search.
- 2026-05-12 -- Made env loading independent of the shell's current working directory and improved diagnostics for network-level fetch failures.

## Gotchas

- On this Windows machine, `npm.ps1` may be blocked by PowerShell execution policy; `node .\test\run-tests.js` runs the test suite directly.
- If Supabase already contains a masked key from an older save, the next settings save will clear that stored masked value; re-enter the real key if there is no env fallback.
