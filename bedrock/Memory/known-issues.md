---
note_type: branch-note
project: bidoc agent
branch: known-issues
status: active
last_updated: 2026-05-07
tags:
  - bugs
  - workarounds
  - supabase
  - openrouter
---

# Branch: Known Issues

## Active Issues

### 1. Supabase "User not found" on hybrid_search
- **Symptom:** RAG response shows `hybrid_search: User not found` in "מה לא נמצא" section
- **Cause:** Supabase service role key stored in settings is wrong, expired, or masked
- **Workaround:** Go to Settings → re-enter the correct Supabase Service Role Key → Save
- **Note:** The key must start with `eyJ` (JWT format). If it shows as `sb_secret...` it may be a management key, not the PostgREST service role key.

### 2. Main agent returns fallback when no retrieval data
- **Symptom:** Structured fallback response with "לא הצלחתי לאחזר מידע" even though OpenRouter is configured
- **Cause:** When hybrid_search fails, the model received no context. Old prompt said "answer only from data" → model returned empty string → fallback triggered.
- **Fix applied (2026-05-07):** `noDataNote` appended to system message when `hasNoData`. Main agent prompt rewritten with CRITICAL RULES to always return a formatted response.

### 3. Expensive models exhaust OpenRouter credits
- **Symptom:** `Main Agent failed` with "requires more credits, You requested up to 65536 tokens"
- **Cause:** Models like `gpt-5.5-pro` have very high default context windows
- **Fix applied (2026-05-07):** `max_tokens: 4096` cap added to all `chatCompletion()` calls
- **Workaround:** Change main agent model to `openai/gpt-4o` in Agents tab → Save

### 4. Classifier routes all messages to CHAT (historical)
- **Symptom:** Every message answered by Lite Agent, RAG pipeline never runs
- **Root cause:** Old classifier prompt saved in Supabase overrode new `prompts.js` defaults
- **Fix applied (2026-05-07):** One-time migration `migratePromptsIfNeeded()` in `config.js` clears stored prompts on first boot after deploy. `writeLocalSettings` now stores only non-default prompt deltas.

### 5. Agents tab shows "טוען סוכנים..." indefinitely (historical)
- **Root cause:** `loadSettings()` threw `TypeError: Cannot set properties of null` on `$("timezone").value` when HTML didn't have the timezone `<select>` element (browser cached old HTML)
- **Fix applied:** Null-check `if ($("timezone"))` before setting value

### 6. Reset endpoint is local-only
- **Symptom:** Reset tab works for local `node src/server.js`, but should not be relied on in Vercel.
- **Cause:** `scheduleServerRestart()` only restarts when `httpServer` exists. In Vercel, `src/server.js` exports a serverless handler and does not own a long-running HTTP server.
- **Workaround:** For Vercel, redeploy/restart through the platform. For local testing, use the Reset tab or restart `node src/server.js` manually.

### 7. Knowledge Base requires Supabase table
- **Symptom:** Knowledge Base page/search can fail with "Supabase is not configured" or a table/RLS error.
- **Cause:** `src/knowledge.js` persists KB documents in Supabase `knowledge_documents`, not local files.
- **Workaround:** Ensure `.env.local`/Vercel env has valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and table `knowledge_documents(filename, content, updated_at)` exists and is accessible by the service role.
- **Test impact:** `node test/run-tests.js` includes a KB search test that requires Supabase env vars; without them, that test fails even though non-Supabase tests pass.

## Resolved Issues

| Date | Issue | Fix |
|------|-------|-----|
| 2026-05-07 | All messages → CHAT (stale Supabase prompt) | Migration clears stored defaults |
| 2026-05-07 | Time questions answered incorrectly | `SYSTEM TIME:` prefix hardcoded in Lite agent |
| 2026-05-07 | OpenRouter + Supabase keys lost on restart | `.env.local` file created; keys recovered |
| 2026-05-07 | Server port conflict (EADDRINUSE 4000) | Kill node processes before restart |
| 2026-05-07 | Reset requested for local testing | Added Reset tab + `POST /api/system/restart` |
| 2026-05-07 | Knowledge Base needed persistence beyond local disk | Moved KB documents to Supabase `knowledge_documents` |
| 2026-05-06 | Unrelated git histories (local vs remote) | `git reset --hard origin/main` |
