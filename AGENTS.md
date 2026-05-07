# BiDoc Agent - Project Notes

BiDoc Agent is a Hebrew RTL RAG assistant for a construction project. It uses a plain Node.js HTTP server, Supabase for persistent state and retrieval, OpenRouter for LLM calls, and a vanilla HTML/CSS/JS frontend in `public/`.

## Working Guidelines

- Prefer the existing no-framework Node.js style in `src/server.js`.
- Keep all persistent mutable application data in Supabase, not local files.
- Do not commit `.env.local`, local secrets, generated cache folders, or runtime data.
- Keep frontend changes consistent with the RTL Hebrew SPA in `public/index.html`, `public/app.js`, and `public/styles.css`.
- Run `npm.cmd test` on Windows before handing off functional changes.

## Key Commands

```bash
npm.cmd test
node src/server.js
```

Local app URL: `http://localhost:4000`
