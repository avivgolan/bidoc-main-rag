const DAY_MS = 86400000;
const TIMELINE_ORIGIN_ORDER = ["drive", "email", "whatsapp"];

export function initialTimelineRange(now = new Date(), daysBack = 1825) {
  const to = endOfLocalDay(now);
  const from = startOfLocalDay(now);
  from.setDate(from.getDate() - daysBack);
  return timelineRange(from, to);
}

export function timelineMonthRange(year, month) {
  return timelineRange(
    new Date(year, month, 1, 0, 0, 0, 0),
    new Date(year, month + 1, 0, 23, 59, 59, 999)
  );
}

export function timelineRange(from, to) {
  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString()
  };
}

export function buildTimelineEventsUrl({
  source = "index",
  from,
  to,
  limit = 200,
  cursor = null,
  sort = "desc",
  origins = []
}) {
  const params = new URLSearchParams({
    source,
    from,
    to,
    limit: String(limit),
    sort
  });
  const normalizedOrigins = normalizeTimelineOrigins(origins);
  if (normalizedOrigins.length) params.set("origins", normalizedOrigins.join(","));
  if (cursor) params.set("cursor", cursor);
  return `/api/timeline/events?${params.toString()}`;
}

export function normalizeTimelineOrigins(origins = []) {
  const values = origins instanceof Set ? [...origins] : Array.isArray(origins) ? origins : [];
  return TIMELINE_ORIGIN_ORDER.filter((origin) => values.includes(origin));
}

export function timelineOriginSignature(origins = []) {
  return normalizeTimelineOrigins(origins).join(",") || "all";
}

export function toggleTimelineOriginSelection(origins = [], origin) {
  if (origin === "all") return [];
  if (!TIMELINE_ORIGIN_ORDER.includes(origin)) return normalizeTimelineOrigins(origins);
  const selected = new Set(normalizeTimelineOrigins(origins));
  if (!selected.size) return [origin];
  if (selected.has(origin)) selected.delete(origin);
  else selected.add(origin);
  return normalizeTimelineOrigins(selected);
}

export function timelineRangeKey(source, range, origins = []) {
  return `${source}|${timelineOriginSignature(origins)}|${range.from}|${range.to}`;
}

export function mergeTimelineEvents(existing = [], incoming = []) {
  const byKey = new Map();
  for (const event of [...existing, ...incoming]) {
    if (!event?.id) continue;
    const source = event.source === "alerts" ? "alerts" : "index";
    byKey.set(`${source}|${String(event.id)}`, { ...event, source });
  }
  return [...byKey.values()].sort((a, b) => {
    const dateDifference = Date.parse(b.date || 0) - Date.parse(a.date || 0);
    if (dateDifference) return dateDifference;
    return String(b.id).localeCompare(String(a.id), "en", { numeric: true });
  });
}

export function mergeTimelineRanges(ranges = [], nextRange) {
  const normalized = [...ranges, nextRange]
    .filter((range) => range?.from && range?.to)
    .map((range) => ({
      from: new Date(range.from).toISOString(),
      to: new Date(range.to).toISOString()
    }))
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  const merged = [];
  for (const range of normalized) {
    const previous = merged.at(-1);
    if (!previous || Date.parse(range.from) > Date.parse(previous.to) + 1) {
      merged.push({ ...range });
      continue;
    }
    if (Date.parse(range.to) > Date.parse(previous.to)) previous.to = range.to;
  }
  return merged;
}

export function isTimelineRangeCovered(ranges = [], targetRange) {
  const targetFrom = Date.parse(targetRange?.from);
  const targetTo = Date.parse(targetRange?.to);
  if (!Number.isFinite(targetFrom) || !Number.isFinite(targetTo)) return false;
  return mergeTimelineRanges(ranges).some((range) =>
    Date.parse(range.from) <= targetFrom && Date.parse(range.to) >= targetTo
  );
}

export function adjacentTimelineRange(range, direction, durationMs) {
  const width = Math.max(DAY_MS, Number(durationMs) || DAY_MS);
  if (direction === "before") {
    const to = new Date(Date.parse(range.from) - 1);
    return timelineRange(new Date(to.getTime() - width + 1), to);
  }
  const from = new Date(Date.parse(range.to) + 1);
  return timelineRange(from, new Date(from.getTime() + width - 1));
}

export function canCommitTimelineRequest(requestId, currentRequestId, source, currentSource, origins = [], currentOrigins = []) {
  return requestId === currentRequestId &&
    source === currentSource &&
    timelineOriginSignature(origins) === timelineOriginSignature(currentOrigins);
}

export function isTimelineAbortError(error) {
  return error?.name === "AbortError" || error?.kind === "cancelled";
}

export function isTimelineTimeoutError(error) {
  return error?.name === "TimeoutError" || error?.kind === "timeout";
}

function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
