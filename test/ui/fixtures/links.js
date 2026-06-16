// Minimal links and suggestions fixtures.
// Uses stable IDs from index and alerts fixtures so any lookup succeeds.
// No smart suggestions — scope is smoke only.

export const LINKS_EMPTY = { links: [] };

export const LINKS_INDEX = {
  links: [
    {
      id: "link-001",
      source: "index",
      from_event_id: "idx-001",
      to_event_id: "idx-003",
      relation_type: "related_to",
      note: "",
      created_at: "2026-04-21T10:00:00.000Z",
    },
  ],
};

export const LINKS_ALERTS = {
  links: [
    {
      id: "link-002",
      source: "alerts",
      from_event_id: "alert_alrt-001",
      to_event_id: "alert_alrt-002",
      relation_type: "related_to",
      note: "",
      created_at: "2026-04-19T08:00:00.000Z",
    },
  ],
};

// Suggestions: minimal, no smart AI review
export const SUGGESTIONS_EMPTY = { suggestions: [], trace: [], workflowLog: null };

export const SUGGESTIONS_INDEX = {
  suggestions: [
    {
      fromEventId: "idx-001",
      toEventId: "idx-003",
      relationType: "related_to",
      confidence: 0.7,
      reason: "shared tags",
    },
  ],
  trace: [],
  workflowLog: null,
};

export const SUGGESTIONS_ALERTS = {
  suggestions: [
    {
      fromEventId: "alert_alrt-001",
      toEventId: "alert_alrt-002",
      relationType: "related_to",
      confidence: 0.8,
      reason: "same date",
    },
  ],
  trace: [],
  workflowLog: null,
};
