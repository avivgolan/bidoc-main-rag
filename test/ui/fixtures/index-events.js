// Stable index event fixtures — spanning 3+ months, two events on same day,
// long content, long URL, varied tags/severity/metadata.

const LONG_CONTENT = "תיאור מפורט של האירוע כולל נתוני רקע, החלטות שהתקבלו, ולוחות זמנים לביצוע. ".repeat(8).trim();
const LONG_URL = "https://example.com/documents/project-north/phase-1/coordination/" + "a".repeat(160);

export const INDEX_EVENTS = [
  {
    id: "idx-001",
    date: "2026-04-20T09:00:00.000Z",
    content: "ישיבת תיאום קבלן - פרויקט שכונת הצפון, דיון על לוחות זמנים ואי עמידה בלו\"ז",
    tags: ["ישיבה", "קבלן", "לוז"],
    source: "index",
    severity: "גבוה",
    metadata: {
      title: "ישיבת תיאום קבלן",
      summary: "דיון על לוחות זמנים ואי עמידה",
      source_table: "data_index",
      source_id: "src-001",
      project_id: "proj-north-001",
      item_status: "פתוח",
      severity_or_risk: "גבוה",
      mail_id: "mail-001",
      attachment_id: "att-001",
      source_url: "https://example.com/docs/coord-2026-04-20",
      mentioned_dates: ["2026-04-25", "2026-05-01"],
    },
  },
  {
    // Same day as idx-001
    id: "idx-002",
    date: "2026-04-20T14:30:00.000Z",
    content: "דוח בטיחות - תאונת עבודה קלה בגובה, בוצע טיפול ראשוני בשטח",
    tags: ["בטיחות", "דוח", "גובה"],
    source: "index",
    severity: "בינוני",
    metadata: {
      title: "דוח בטיחות",
      summary: "תאונת עבודה קלה בגובה",
      source_table: "data_index",
      source_id: "src-002",
      project_id: "proj-north-001",
      item_status: "טיפול",
      severity_or_risk: "בינוני",
    },
  },
  {
    id: "idx-003",
    date: "2026-03-15T10:00:00.000Z",
    content: "אישור תוכנית ביניים - שלב א - אושר על ידי ועדת ההיגוי",
    tags: ["אישור", "תכנון"],
    source: "index",
    severity: null,
    metadata: {
      title: "אישור תוכנית ביניים שלב א",
      source_table: "data_index",
      source_id: "src-003",
      project_id: "proj-north-001",
      item_status: "סגור",
    },
  },
  {
    // Long content + long URL
    id: "idx-004",
    date: "2026-02-10T08:00:00.000Z",
    content: LONG_CONTENT,
    tags: ["מסמך", "תשתית"],
    source: "index",
    severity: "נמוך",
    metadata: {
      title: "דוח התקדמות מפורט - פברואר",
      source_table: "data_index",
      source_id: "src-004",
      project_id: "proj-north-001",
      item_status: "פתוח",
      source_url: LONG_URL,
    },
  },
];

export const INDEX_PAGE_1 = {
  events: INDEX_EVENTS,
  page: { nextCursor: null, hasMore: false, from: null, to: null, sort: "desc", limit: 200 },
};
