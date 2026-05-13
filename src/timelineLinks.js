export const TIMELINE_RELATION_TYPES = [
  "quote_sent",
  "quote_approved",
  "invoice_sent",
  "payment_received",
  "change_order",
  "related"
];

export const TIMELINE_RELATION_LABELS = {
  quote_sent: "הצעת מחיר נשלחה",
  quote_approved: "הצעת מחיר אושרה",
  invoice_sent: "חשבונית נשלחה",
  payment_received: "תשלום התקבל",
  change_order: "חריג / שינוי",
  related: "קשור"
};

export function normalizeTimelineSource(value) {
  return value === "alerts" ? "alerts" : "index";
}

export function eventTitle(event) {
  return String(event?.content || event?.metadata?.summary || event?.metadata?.title || event?.tags?.join(", ") || "אירוע ללא כותרת").slice(0, 180);
}

export function daysBetweenDates(sourceDate, targetDate) {
  const start = new Date(sourceDate);
  const end = new Date(targetDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export function addDurationToLink(link) {
  return {
    ...link,
    durationDays: daysBetweenDates(link.source_date, link.target_date)
  };
}

export function extractApprover(text = "") {
  const value = String(text || "");
  const patterns = [
    /(?:אושר(?:ה)?\s+על\s+ידי|אושר(?:ה)?\s+ע"י|מאשר[:\s]+|אישר[:\s]+)\s*([א-תA-Za-z][א-תA-Za-z .'-]{1,60})/i,
    /(?:approved\s+by|approver[:\s]+)\s*([A-Za-z][A-Za-z .'-]{1,60})/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return cleanApprover(match[1]);
  }
  return "";
}

export function buildTimelineLinkSuggestions({ events = [], links = [], source = "index", limit = 8, pairScorer = null } = {}) {
  const normalizedSource = normalizeTimelineSource(source);
  const existing = new Set(links.map((link) => timelineSuggestionKey({
    source_event_source: link.source_event_source,
    source_event_id: link.source_event_id,
    target_event_source: link.target_event_source,
    target_event_id: link.target_event_id,
    relation_type: link.relation_type
  })));
  const proposals = events
    .filter(isTimelineQuoteEvent)
    .flatMap((quote) => events
      .filter((candidate) => isTimelineApprovalEvent(candidate) && isTimelineEventAfter(candidate, quote) && candidate.id !== quote.id)
      .map((approval) => {
        const key = timelineSuggestionKey({
          source_event_source: normalizedSource,
          source_event_id: quote.id,
          target_event_source: normalizedSource,
          target_event_id: approval.id,
          relation_type: "quote_approved"
        });
        if (existing.has(key)) return null;
        const sharedTags = sharedTagCount(quote, approval);
        const graph = typeof pairScorer === "function"
          ? pairScorer({ sourceEvent: quote, targetEvent: approval, source: normalizedSource })
          : { graphScore: 0, graphSharedEntities: [] };
        const durationDays = daysBetweenDates(quote.date, approval.date);
        const score = sharedTags * 20 + Math.max(0, 45 - Math.min(durationDays ?? 45, 45)) + Number(graph.graphScore || 0);
        return buildTimelineSuggestionFromEvents({
          sourceEvent: quote,
          targetEvent: approval,
          source: normalizedSource,
          relationType: "quote_approved",
          score,
          sharedTags,
          graph
        });
      }))
    .filter(Boolean);
  return mergeTimelineSuggestions(proposals, limit);
}

export function timelineSuggestionKey(item) {
  return [
    item.source_event_source,
    item.source_event_id,
    item.target_event_source,
    item.target_event_id,
    item.relation_type
  ].join("|");
}

export function mergeTimelineSuggestions(items = [], limit = 8) {
  const byKey = new Map();
  for (const item of items) {
    if (!item) continue;
    const key = timelineSuggestionKey(item);
    const previous = byKey.get(key);
    if (!previous || Number(item.score || 0) > Number(previous.score || 0)) byKey.set(key, item);
  }
  return [...byKey.values()]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || (a.durationDays ?? 9999) - (b.durationDays ?? 9999))
    .slice(0, limit);
}

export function buildTimelineSuggestionFromEvents({ sourceEvent, targetEvent, source = "index", relationType = "quote_approved", score = 0, sharedTags = 0, graph = {}, semantic = null }) {
  const normalizedSource = normalizeTimelineSource(source);
  return {
    source_event_source: normalizedSource,
    source_event_id: sourceEvent.id,
    target_event_source: normalizedSource,
    target_event_id: targetEvent.id,
    relation_type: relationType,
    source_date: sourceEvent.date,
    target_date: targetEvent.date,
    source_title: eventTitle(sourceEvent),
    target_title: eventTitle(targetEvent),
    approver: extractApprover(`${targetEvent.content || ""} ${JSON.stringify(targetEvent.metadata || {})}`),
    durationDays: daysBetweenDates(sourceEvent.date, targetEvent.date),
    score,
    sharedTags,
    graphScore: Number(graph.graphScore || 0),
    graphSharedEntities: graph.graphSharedEntities || [],
    semantic
  };
}

export function isTimelineEventAfter(candidate, source) {
  const candidateDate = new Date(candidate?.date);
  const sourceDate = new Date(source?.date);
  return !Number.isNaN(candidateDate.getTime()) && !Number.isNaN(sourceDate.getTime()) && candidateDate > sourceDate;
}

export function isTimelineQuoteEvent(event) {
  return /הצעת\s*מחיר|הצעה|quotation|proposal|quote/i.test(eventText(event));
}

export function isTimelineApprovalEvent(event) {
  return /אישור|אושר|אושרה|מאושר|approved|accepted/i.test(eventText(event));
}

export function timelineEventText(event) {
  return eventText(event);
}

function eventText(event) {
  return `${event?.content || ""} ${(event?.tags || []).join(" ")} ${JSON.stringify(event?.metadata || {})}`;
}

function sharedTagCount(a, b) {
  const aTags = new Set((a?.tags || []).map((tag) => String(tag).toLowerCase()));
  return (b?.tags || []).filter((tag) => aTags.has(String(tag).toLowerCase())).length;
}

function cleanApprover(value) {
  return String(value || "")
    .replace(/[.,;:|]+.*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
