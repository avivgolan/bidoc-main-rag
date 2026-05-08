---
note_type: durable-memory-branch
project: bidoc agent
branch: timeline
last_updated: 2026-05-08
tags:
  - timeline
  - frontend
---

# Timeline

## Current State

- Timeline UI lives in `public/index.html`, `public/app.js`, and `public/styles.css` under the `#timeline` panel.
- Timeline data is loaded client-side from `GET /api/timeline`.
- The timeline supports filters, search, calendar view, and a dark interactive timeline view.
- `public/app.js` uses `timelineState.resolution` for day/week/month bucket sizing and `timelineState.viewportStart` for the lower strip viewport.
- The lower strip window is draggable/clickable and updates the visible time range; it also supports keyboard movement with Arrow/Home/End keys.

## Recent Changes

- 2026-05-08 -- Fixed timeline day/week/month controls so they change bucket granularity and reset the visible range.
- 2026-05-08 -- Added viewport logic and pointer/keyboard handlers for the lower timeline strip window.

## Gotchas

- The timeline panel is re-rendered when the strip window moves, so drag code must not depend on layout from a detached DOM node unless the track rect is captured before render.
- `console.debug("[timeline]", ...)` is used as lightweight diagnostic output for resolution and viewport changes.
