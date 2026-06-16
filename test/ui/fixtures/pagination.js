// Pagination fixtures — two pages per source, first hasMore=true with opaque cursor,
// second hasMore=false. No duplicate IDs across pages.

import { INDEX_EVENTS } from "./index-events.js";
import { ALERTS_EVENTS } from "./alerts-events.js";

// Opaque cursors — the mock chooses page by presence of cursor param, not value.
// These match what the mock in setup.js will recognise as "any cursor present".
export const INDEX_CURSOR_P2 = "dGVzdC1pbmRleC1wYWdlLTI";   // base64url, opaque
export const ALERTS_CURSOR_P2 = "dGVzdC1hbGVydHMtcGFnZS0y"; // base64url, opaque

// Index: page 1 returns first two events, hasMore=true
export const INDEX_PAGE_1_PAGINATED = {
  events: INDEX_EVENTS.slice(0, 2),
  page: {
    nextCursor: INDEX_CURSOR_P2,
    hasMore: true,
    from: null,
    to: null,
    sort: "desc",
    limit: 2,
  },
};

// Index: page 2 returns last two events, hasMore=false
export const INDEX_PAGE_2_PAGINATED = {
  events: INDEX_EVENTS.slice(2, 4),
  page: {
    nextCursor: null,
    hasMore: false,
    from: null,
    to: null,
    sort: "desc",
    limit: 2,
  },
};

// Alerts: page 1 returns first two events, hasMore=true
export const ALERTS_PAGE_1_PAGINATED = {
  events: ALERTS_EVENTS.slice(0, 2),
  page: {
    nextCursor: ALERTS_CURSOR_P2,
    hasMore: true,
    from: null,
    to: null,
    sort: "desc",
    limit: 2,
  },
};

// Alerts: page 2 returns last two events, hasMore=false
export const ALERTS_PAGE_2_PAGINATED = {
  events: ALERTS_EVENTS.slice(2, 4),
  page: {
    nextCursor: null,
    hasMore: false,
    from: null,
    to: null,
    sort: "desc",
    limit: 2,
  },
};
