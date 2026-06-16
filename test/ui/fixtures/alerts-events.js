// Stable alerts event fixtures — different dates, two alerts same day,
// different severities, full metadata fields, long content, stable IDs.

const LONG_ALERT_CONTENT = "תיאור מפורט של ההתראה כולל נתוני קלט, מקורות מידע ומסקנות ביניים. ".repeat(6).trim();

export const ALERTS_EVENTS = [
  {
    id: "alert_alrt-001",
    date: "2026-04-18T12:00:00.000Z",
    content: "עיכוב בביצוע יציקת בטון - שבוע שלם מעבר ללו\"ז המאושר",
    tags: ["עיכוב", "בטון", "לוז"],
    source: "alerts",
    severity: "גבוה",
    metadata: {
      question: "האם יש עיכוב בביצוע יציקת הבטון?",
      alert_description: "עיכוב של שבוע בביצוע יציקת בטון בשלב ב",
      alert_type: "עיכוב",
      severity_level: "גבוה",
      input_data_type: "לוח_זמנים",
      input_data_id: "sched-001",
      data_link: "https://example.com/alerts/001",
      status: "פתוח",
      item_status: "פתוח",
      is_relevant: true,
    },
  },
  {
    // Same day as alrt-001
    id: "alert_alrt-002",
    date: "2026-04-18T16:00:00.000Z",
    content: "חריגה בתקציב רכש חומרים - 12% מעל התקציב המאושר",
    tags: ["תקציב", "חריגה", "רכש"],
    source: "alerts",
    severity: "בינוני",
    metadata: {
      question: "האם יש חריגה בתקציב?",
      alert_description: "חריגה של 12% בתקציב רכש חומרים",
      alert_type: "תקציב",
      severity_level: "בינוני",
      input_data_type: "כספי",
      input_data_id: "budget-002",
      status: "טיפול",
      item_status: "טיפול",
      is_relevant: true,
    },
  },
  {
    id: "alert_alrt-003",
    date: "2026-03-10T09:00:00.000Z",
    content: "שאלת בטיחות פתוחה ללא מענה - בדיקת ציוד מגן",
    tags: ["בטיחות", "שאלה"],
    source: "alerts",
    severity: "נמוך",
    metadata: {
      question: "האם ציוד המגן נבדק?",
      alert_description: "שאלת בטיחות ללא מענה",
      alert_type: "בטיחות",
      severity_level: "נמוך",
      status: "סגור",
      item_status: "סגור",
      is_relevant: false,
    },
  },
  {
    // Long content
    id: "alert_alrt-004",
    date: "2026-02-05T11:00:00.000Z",
    content: LONG_ALERT_CONTENT,
    tags: ["תשתית"],
    source: "alerts",
    severity: "גבוה",
    metadata: {
      alert_type: "תשתית",
      severity_level: "גבוה",
      item_status: "פתוח",
      is_relevant: true,
    },
  },
];

export const ALERTS_PAGE_1 = {
  events: ALERTS_EVENTS,
  page: { nextCursor: null, hasMore: false, from: null, to: null, sort: "desc", limit: 200 },
};
