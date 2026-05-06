---
note_type: evidence-imports
project: bidoc agent
status: active
last_updated: 2026-05-07
tags:
  - bedrock
  - evidence
  - imports
---

# Imported Evidence

Use this branch for imported supporting material that is useful during backfill but should
not be treated as canonical truth on its own.

Expected files include:

- `existing-docs.txt`
- `doc-index.txt`
- `tasks.txt`
- `session-files.txt`
- `cursor-sessions.txt`
- `trace-index.txt`
- `structural-summary.md`
- `graphify/` (optional)

Imported or generated evidence may include adjacent `.meta.json` files with source,
kind, confidence, generated_at, related_paths, and notes.
