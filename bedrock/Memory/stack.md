---
note_type: durable-memory-branch
project: bidoc agent
branch: stack
last_updated: 2026-05-09
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

## Recent Changes

- 2026-05-09 -- Onboarded stack facts from `package.json`, `CLAUDE.md`, and repo layout.

## Gotchas

- On this Windows machine, `npm.ps1` may be blocked by PowerShell execution policy; `node .\test\run-tests.js` runs the test suite directly.
