const HEBREW_DIACRITICS = /[\u0591-\u05C7]/gu;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternation(values) {
  return [...values]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
}

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/gu, " ").trim();
}

const EMAIL_ENTITY_ALIASES = Object.freeze([
  Object.freeze({ canonical: "מיילים", aliases: Object.freeze([
    "הודעות דואר אלקטרוני",
    "הודעות דוא״ל",
    "הודעות דוא\"ל",
    "אימיילים"
  ]) }),
  Object.freeze({ canonical: "מייל", aliases: Object.freeze([
    "הודעת דואר אלקטרוני",
    "הודעת דוא״ל",
    "הודעת דוא\"ל",
    "דואר אלקטרוני",
    "דוא״ל",
    "דוא\"ל",
    "אימייל"
  ]) })
]);

const EMAIL_RELEVANT_WORDS = Object.freeze([
  "רלוונטי",
  "רלוונטית",
  "רלוונטיים",
  "רלוונטיות",
  "רלוונטים",
  "רלבנטי",
  "רלבנטית",
  "רלבנטיים",
  "רלבנטיות",
  "רלבנטים",
  "קשור",
  "קשורה",
  "קשורים",
  "קשורות",
  "שייך",
  "שייכת",
  "שייכים",
  "שייכות",
  "נוגע",
  "נוגעת",
  "נוגעים",
  "נוגעות",
  "משויך",
  "משויכת",
  "משויכים",
  "משויכות",
  "משוייך",
  "משוייכת",
  "משוייכים",
  "משוייכות"
]);

const EMAIL_ASSOCIATION_NOUNS = Object.freeze([
  "שיוך",
  "זיקה",
  "קשר",
  "רלוונטיות"
]);

const EXCEPTION_ENTITY_ALIASES = Object.freeze([
  Object.freeze({ canonical: "חריגים", aliases: Object.freeze([
    "דוחות חריגים", "דוח חריגים", "דוחות חריגה", "דוח חריגה",
    "חריגות", "חריגה", "חריגם", "חרגות", "אי התאמות", "אי-התאמות",
    "סטיות מהחוזה", "סטיות חוזיות", "שינויים חריגים"
  ]) }),
  Object.freeze({ canonical: "חריגים", aliases: Object.freeze([
    "פקודות שינוי", "פקודת שינוי", "הוראות שינוי", "הוראת שינוי",
    "שינויי עבודה", "שינוי עבודה", "עבודות נוספות", "עבודה נוספת",
    "עלויות נוספות", "עלות נוספת", "תוספות מחיר", "תוספת מחיר"
  ]) })
]);

const EXCEPTION_INTENT_ALIASES = Object.freeze({
  count: Object.freeze(["כמות", "מספר", "סך", "סך כל", "כמה יש", "כמה קיימים", "כמה קיימות"]),
  grouping: Object.freeze(["פילוח", "פלח", "התפלגות", "חלוקה", "חלק", "קבץ", "קבצי", "קבצי לפי"]),
  date: Object.freeze(["תאריך חריגה", "מועד חריגה", "תאריך הדוח", "מועד הדוח", "ללא תאריך", "אין תאריך", "חסר תאריך"]),
  trend: Object.freeze(["מגמה", "מגמת", "מגמה חודשית", "סדרת זמן", "לאורך זמן"]),
  latest: Object.freeze(["אחרון", "אחרונה", "אחרונים", "אחרונות", "הכי חדש", "הכי חדשה", "עדכני", "עדכנית"]),
  earliest: Object.freeze(["ראשון", "ראשונה", "ראשונים", "ראשונות", "הכי מוקדם", "הכי מוקדמת"]),
  amount: Object.freeze(["סכום מבוקש", "עלות נוספת", "תוספת מחיר", "עלות החריגה", "מחיר החריגה", "כסף", "סכומים"]),
  executionDays: Object.freeze(["ימי ביצוע", "זמן ביצוע", "משך ביצוע", "מספר ימי ביצוע"]),
  urgency: Object.freeze(["דחיפות", "רמת דחיפות", "עדיפות", "דחוף", "דחופה", "דחופים", "דחופות"]),
  status: Object.freeze(["סטטוס", "מצב", "שלב טיפול", "בטיפול"]),
  inspector: Object.freeze(["מפקח", "מפקחת", "מפקחים", "מפקחות", "בודק", "בודקת"]),
  contractor: Object.freeze(["קבלן", "קבלנית", "קבלנים", "חברה קבלנית", "קבלן ראשי"]),
  company: Object.freeze(["חברה", "חברות", "חברת פיקוח", "ספק", "ספקים"]),
  approval: Object.freeze(["אישור", "אישורים", "אושר", "אושרה", "מאושר", "מאושרת"]),
  rejection: Object.freeze(["דחייה", "דחיות", "נדחה", "נדחתה", "נפסל", "נפסלה"]),
  summary: Object.freeze(["סכם", "סיכום", "תמצת", "תמצית"])
});

export const DATA_QUERY_HEBREW_LEXICON = Object.freeze({
  email: Object.freeze({
    entities: EMAIL_ENTITY_ALIASES,
    projectRelevantWords: EMAIL_RELEVANT_WORDS,
    associationNouns: EMAIL_ASSOCIATION_NOUNS
  }),
  exception: Object.freeze({
    entities: EXCEPTION_ENTITY_ALIASES,
    intents: EXCEPTION_INTENT_ALIASES,
    negative: Object.freeze(["לא כולל", "בלי", "ללא", "חוץ מ", "מלבד", "שאינם", "שאינן"])
  }),
  consultantReport: Object.freeze({
    entities: Object.freeze(["דוח יועץ", "דוח היועץ", "דוחות יועצים", "דוחות היועצים", "דו״ח יועץ", "חוות דעת יועץ", "חוות דעת של היועץ"]),
    negative: Object.freeze(["לא כולל דוחות יועצים", "בלי דוחות יועצים", "ללא דוחות יועצים"]),
    ambiguousPeople: Object.freeze(["כמה יועצים", "מספר היועצים"])
  })
});

const entityAliasReplacements = EMAIL_ENTITY_ALIASES.flatMap(({ canonical, aliases }) =>
  aliases.map((alias) => ({ canonical, alias }))
).concat(EXCEPTION_ENTITY_ALIASES.flatMap(({ canonical, aliases }) =>
  aliases.map((alias) => ({ canonical, alias }))
)).sort((left, right) => right.alias.length - left.alias.length);

const RELEVANT_WORD = `(?:${alternation(EMAIL_RELEVANT_WORDS)})`;
const ASSOCIATION_NOUN = `(?:${alternation(EMAIL_ASSOCIATION_NOUNS)})`;
const PROJECT_NOUN = "(?:פרויקט|מיזם)";
const PROJECT_TARGET = `(?:ל(?:ה)?${PROJECT_NOUN}|ב(?:ה)?${PROJECT_NOUN}|עבור\\s+(?:ה)?${PROJECT_NOUN})`;
const RELEVANT_PREFIX = "(?:ה|ש|שה)?";
const POSITIVE_RELEVANCE = new RegExp(
  `(?:${RELEVANT_PREFIX}${RELEVANT_WORD}(?:\\s+${PROJECT_TARGET})?|(?:של|עבור)\\s+(?:ה)?${PROJECT_NOUN}|ב(?:ה)?${PROJECT_NOUN}|(?:עם|בעלי)\\s+${ASSOCIATION_NOUN}\\s+${PROJECT_TARGET})`,
  "iu"
);
const NEGATIVE_RELEVANCE = new RegExp(
  `(?:(?:לא|שלא|שאינ(?:ו|ה|ם|ן))\\s+(?:ה)?${RELEVANT_WORD}(?:\\s+${PROJECT_TARGET})?|(?:ללא|בלי)\\s+${ASSOCIATION_NOUN}(?:\\s+(?:ברור|ברורה))?(?:\\s+${PROJECT_TARGET})?|ללא\\s+(?:ה)?${PROJECT_NOUN}\\s+ברור(?:ה)?|עם\\s+${ASSOCIATION_NOUN}\\s+(?:לא\\s+)?(?:ברור|ברורה|ידוע|ידועה)|לא\\s+של\\s+(?:ה)?${PROJECT_NOUN})`,
  "iu"
);

export function normalizeDataQueryHebrewQuestion(text) {
  let normalized = String(text || "")
    .normalize("NFKC")
    .replace(HEBREW_DIACRITICS, "")
    .replace(/[־–—]/gu, " ")
    .replace(/פרוייקט/gu, "פרויקט");
  for (const { alias, canonical } of entityAliasReplacements) {
    normalized = normalized.replace(new RegExp(escapeRegExp(alias), "gu"), canonical);
  }
  return compactWhitespace(normalized);
}

export function analyzeHebrewEmailRelevance(text) {
  const normalizedText = normalizeDataQueryHebrewQuestion(text);
  const negative = NEGATIVE_RELEVANCE.exec(normalizedText);
  if (negative) {
    return {
      intent: "no_clear_project",
      normalizedText,
      grammarText: compactWhitespace(
        `${normalizedText.slice(0, negative.index)} ${normalizedText.slice(negative.index + negative[0].length)}`
      )
    };
  }
  const positive = POSITIVE_RELEVANCE.exec(normalizedText);
  if (positive) {
    return {
      intent: "project_related",
      normalizedText,
      grammarText: compactWhitespace(
        `${normalizedText.slice(0, positive.index)} ${normalizedText.slice(positive.index + positive[0].length)}`
      )
    };
  }
  return { intent: null, normalizedText, grammarText: normalizedText };
}

export function normalizeHebrewEmailMetricQuestion(text) {
  const relevance = analyzeHebrewEmailRelevance(text);
  const grammarText = compactWhitespace(relevance.grammarText)
    .replace(/^כמה\s+(?:מה|ה)?מייל(?:ים)?(?=\s|[?.!,;]|$)/u, "כמה מיילים")
    .replace(/^מה\s+(?:כמות|מספר|סך(?:\s+כל)?)\s+(?:ה)?מייל(?:ים)?(?=\s|[?.!,;]|$)/u, "כמה מיילים")
    .replace(/^כמה\s+(?:יש|ישנם|ישנן|קיימים|קיימות)\s+מייל(?:ים)?(?=\s|[?.!,;]|$)/u, "כמה מיילים יש")
    .replace(/\s+(?:ישנם|ישנן|קיימים|קיימות|נמצאים|נמצאות)(?=\s|[?.!,;]|$)/gu, " יש");
  return { ...relevance, grammarText: compactWhitespace(grammarText) };
}

const EXCEPTION_NEGATIVE = /(?:לא\s+כולל(?:ים|ות)?|בלי|ללא|חוץ\s+מ|מלבד|שאינ(?:ם|ן)|שלא)\s+(?:ה)?חריגים/iu;
const EXCEPTION_AMBIGUOUS_ADJACENT = /(?:ערך|נתון)\s+חריג|חריגים\s+(?:סטטיסטיים|בסטטיסטיקה|בבטיחות|של\s+בטיחות|בהתראות)|התראות\s+חריגים/iu;
const EXCEPTION_ENTITY = /(?:^|\s|[?.!,;])(?:[בלמכושה])?(?:ה)?חריגים(?=\s|[?.!,;]|$)/iu;

export function analyzeHebrewExceptionIntent(text) {
  const normalizedText = normalizeDataQueryHebrewQuestion(text);
  const negative = EXCEPTION_NEGATIVE.exec(normalizedText);
  if (negative) {
    return {
      intent: "exclude",
      normalizedText,
      grammarText: compactWhitespace(
        `${normalizedText.slice(0, negative.index)} ${normalizedText.slice(negative.index + negative[0].length)}`
      ),
      ambiguous: false
    };
  }
  const ambiguous = EXCEPTION_AMBIGUOUS_ADJACENT.test(normalizedText);
  return {
    intent: !ambiguous && EXCEPTION_ENTITY.test(normalizedText) ? "exception_report" : null,
    normalizedText,
    grammarText: normalizedText,
    ambiguous
  };
}

export function normalizeHebrewExceptionMetricQuestion(text) {
  const analysis = analyzeHebrewExceptionIntent(text);
  let grammarText = analysis.grammarText
    .replace(/^(?:מה\s+(?:ה)?(?:כמות|מספר|סך(?:\s+כל)?)|כמה\s+(?:יש|ישנם|ישנן|קיימים|קיימות))\s+(?:ה)?חריגים(?=\s|[?.!,;]|$)/u, "כמה חריגים")
    .replace(/^כמה\s+(?:ה)?חריגים\s+(?:יש|ישנם|ישנן|קיימים|קיימות)\s+(?:במערכת|בפרויקט(?:\s+(?:הזה|הנוכחי))?)(?=\s|[?.!,;]|$)/u, "כמה חריגים")
    .replace(/^לכמה\s+(?:ה)?חריגים\s+(?:אין|חסר)\s+תאריך(?=\s|[?.!,;]|$)/u, "כמה חריגים ללא תאריך")
    .replace(/^(?:פלח|חלק|פילוח|חלוקה|התפלגות|קבצי(?:\s+לפי)?)\s+(?:את\s+|של\s+)?(?:ה)?חריגים/u, "פילוח חריגים")
    .replace(/^(?:הצג|הראה|תראה)(?:\s+לי)?\s+(?:את\s+)?מגמת\s+(?:ה)?חריגים\s+(?:ה)?חודשית(?=\s|[?.!,;]|$)/u, "הצג מגמה של חריגים לפי חודש")
    .replace(/לפי\s+(?:רמת\s+)?(?:עדיפות|דחוף|דחופה|דחופים|דחופות)/gu, "לפי דחיפות")
    .replace(/לפי\s+(?:מצב|שלב\s+טיפול)/gu, "לפי סטטוס")
    .replace(/(?:מועד\s+חריגה|תאריך\s+הדוח|מועד\s+הדוח)/gu, "תאריך חריגה")
    .replace(/\s+/gu, " ")
    .trim();
  return { ...analysis, grammarText };
}

const CONSULTANT_REPORT_ENTITY = /(?:דוח(?:ות)?|דו[״"']?ח(?:ות)?)\s+(?:ה)?יוע(?:ץ|צים)|חוות\s+דעת\s+(?:של\s+)?(?:ה)?יוע(?:ץ|צים)/iu;
const CONSULTANT_REPORT_NEGATIVE = /(?:לא\s+כולל|בלי|ללא|חוץ\s+מ|מלבד)\s+(?:דוח(?:ות)?|דו[״"']?ח(?:ות)?)\s+(?:ה)?יוע(?:ץ|צים)/iu;
const CONSULTANT_PEOPLE_COUNT = /^(?:כמה|מספר)\s+(?:ה)?יועצים?(?:\s+יש)?[?.!]*$/iu;

export function analyzeHebrewConsultantReportIntent(text) {
  const normalizedText = normalizeDataQueryHebrewQuestion(text);
  if (CONSULTANT_REPORT_NEGATIVE.test(normalizedText)) return { intent: "exclude", normalizedText, grammarText: normalizedText, ambiguous: false };
  const ambiguous = CONSULTANT_PEOPLE_COUNT.test(normalizedText);
  return { intent: !ambiguous && CONSULTANT_REPORT_ENTITY.test(normalizedText) ? "consultant_report" : null, normalizedText, grammarText: normalizedText, ambiguous };
}

export function normalizeHebrewConsultantReportMetricQuestion(text) {
  const analysis = analyzeHebrewConsultantReportIntent(text);
  const grammarText = analysis.grammarText
    .replace(/^מה\s+(?:ה)?(?:כמות|מספר|סך)\s+(?:ה)?דוחות\s+(?:ה)?יועצים/iu, "כמה דוחות יועצים")
    .replace(/^כמה\s+(?:יש|קיימים)\s+דוחות\s+(?:ה)?יועצים/iu, "כמה דוחות יועצים")
    .replace(/^(?:פלח|חלק|פילוח|חלוקה|התפלגות)\s+(?:את\s+|של\s+)?(?:ה)?דוחות\s+(?:ה)?יועצים/iu, "פילוח דוחות יועצים")
    .replace(/\s+/gu, " ").trim();
  return { ...analysis, grammarText };
}
