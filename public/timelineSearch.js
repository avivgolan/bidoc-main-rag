const INDEX_METADATA_FIELDS = [
  "title",
  "summary",
  "source_table",
  "source_id",
  "project_id",
  "item_status",
  "severity_or_risk",
  "mail_id",
  "attachment_id",
  "source_url",
  "mentioned_dates"
];

const ALERTS_METADATA_FIELDS = [
  "question",
  "alert_description",
  "alert_type",
  "severity_level",
  "input_data_type",
  "input_data_id",
  "data_link",
  "status",
  "item_status",
  "is_relevant"
];

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function appendSearchValue(parts, value) {
  if (value == null || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value) appendSearchValue(parts, item);
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = normalizeSearchText(value);
    if (text) parts.push(text);
  }
}

function allowedMetadataFieldsForEvent(event) {
  return event?.source === "alerts" ? ALERTS_METADATA_FIELDS : INDEX_METADATA_FIELDS;
}

function buildTimelineSearchText(event) {
  const parts = [];
  appendSearchValue(parts, event?.content);
  appendSearchValue(parts, event?.tags);
  appendSearchValue(parts, event?.id);
  appendSearchValue(parts, event?.date);
  appendSearchValue(parts, event?.source);
  appendSearchValue(parts, event?.severity);
  const metadata = event?.metadata && typeof event.metadata === "object" ? event.metadata : null;
  if (metadata) {
    for (const field of allowedMetadataFieldsForEvent(event)) appendSearchValue(parts, metadata[field]);
  }
  return parts.join(" ");
}

function timelineEventMatchesQuery(event, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return true;
  return buildTimelineSearchText(event).includes(query);
}

function createTimelineSearchController({ delay = 250, onPending, onApply, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timerId = null;

  const clearPendingTimer = () => {
    if (timerId != null) {
      clearTimer(timerId);
      timerId = null;
    }
  };

  return {
    schedule(nextValue) {
      const value = String(nextValue ?? "");
      clearPendingTimer();
      if (!value.trim()) {
        onPending?.(false, value);
        onApply?.(value);
        return;
      }
      onPending?.(true, value);
      timerId = setTimer(() => {
        timerId = null;
        onPending?.(false, value);
        onApply?.(value);
      }, delay);
    },
    dispose() {
      clearPendingTimer();
      onPending?.(false, "");
    }
  };
}

export {
  ALERTS_METADATA_FIELDS,
  INDEX_METADATA_FIELDS,
  allowedMetadataFieldsForEvent,
  buildTimelineSearchText,
  createTimelineSearchController,
  normalizeSearchText,
  timelineEventMatchesQuery
};
