// Recency questions: "what are the latest emails?", "מה סוכם בישיבות האחרונות?",
// "meetings since 1 June", "alerts in the last 7 days".
//
// Pure functions, no I/O. detectRecencyIntent() decides whether a question asks
// for the NEWEST items of some kind (and over which date window), so the chat can
// read them by their own date column instead of by closeness in meaning (a vector
// match returns the items most similar to the words, not the newest ones).
//
// A recency question needs BOTH a recency cue (אחרונים, לאחרונה, החדשים, השבוע,
// latest, recent, since <date>, last N days, ...) AND the kind of item it asks
// about (emails, meetings, WhatsApp, alerts, decisions, ...). A count question
// ("how many emails this week?"), a question about the first/earliest item, one
// that names a single explicit date and no cue, or a cue with no kind
// ("what is the latest version of the plan?") is not a recency question.

const LETTER = "\\p{L}\\p{N}";
const START = `(?<![${LETTER}])`;
const END = `(?![${LETTER}])`;
// Hebrew one-letter prefixes glued to a word: ה (the), ב (in), ל (to), מ (from), ו (and), כ, ש.
const PREFIX = "[והבלמכש]{0,2}";

export const DEFAULT_RECENT_LIMIT = 10;
export const MAX_RECENT_LIMIT = 25;
export const MAX_RECENT_WINDOW_DAYS = 366;

// Kinds, in the order a question is scanned. `key` is the recency kind name.
const KIND_PATTERNS = [
  ["emails", new RegExp(`(?:מייל(?:ים)?|אימייל(?:ים)?|דוא["״]?ל|תכתובת|${START}e-?mails?${END}|${START}mails?${END}|${START}correspondence${END})`, "iu")],
  ["meetings", new RegExp(`(?:ישיב(?:ה|ות)|פגיש(?:ה|ות)|פרוטוקול(?:ים)?|${START}meetings?${END}|${START}minutes${END})`, "iu")],
  ["whatsapp", new RegExp(`(?:ו+אט?סאפ|ווצאפ|וואצאפ|${START}whats\\s?app${END})`, "iu")],
  ["alerts", new RegExp(`(?:התרא(?:ה|ות)|${START}alerts?${END})`, "iu")],
  ["decisions", new RegExp(`(?:החלט(?:ה|ות)|${START}decisions?${END})`, "iu")],
  ["safety", new RegExp(`(?:דו["״]?חות?\\s+ה?בטיחות|ממצאי\\s+ה?בטיחות|אירועי\\s+ה?בטיחות|${START}safety${END})`, "iu")],
  ["quality", new RegExp(`(?:(?:ממצאי\\s+)?בקרת\\s+ה?איכות|ליקויי\\s+ה?איכות|${START}quality\\s+(?:control|inspections?)${END})`, "iu")],
  ["consultants", new RegExp(`(?:דו["״]?חות?\\s+ה?יועצ(?:ים)?|דו["״]?חות?\\s+ה?פיקוח|${START}consultants?['’]?\\s+reports?${END})`, "iu")],
  ["exceptions", new RegExp(`(?:חריג(?:ים|ות|ה)?${END}|${START}exceptions?${END}|${START}change\\s+orders?${END})`, "iu")],
  ["financial", new RegExp(`(?:חשבונית|חשבוניות|תשלום|תשלומים|${START}invoices?${END}|${START}payments?${END})`, "iu")]
];

const HE_PLURAL_ENDING = /(?:ים|ות)$/u;

// A count, total or average is a metric question: the exact Data Query handles those.
const QUANTITATIVE = new RegExp(
  `(?:${START}(?:כמה|מספר|ספור|ספירה|סה["״]?כ|ממוצע)${END}|${START}(?:how\\s+many|count|number\\s+of|total|average)${END})`,
  "iu"
);
// The first / earliest item is a different question from the newest ones.
const EARLIEST = new RegExp(`(?:${START}${PREFIX}(?:ראשו(?:ן|נה|נים|נות)|הקדום|הכי\\s+ישן)${END}|${START}(?:first|earliest|oldest)${END})`, "iu");

const CUE_LATEST_HE = new RegExp(`${START}${PREFIX}אחרו(?:נ(?:ים|ות|ה)?|ן)${END}`, "iu");
const CUE_NEW_HE = new RegExp(`${START}${PREFIX}(?:חדש(?:ים|ות|ה)?|עדכני(?:ים|ות|ת)?)${END}`, "iu");
const CUE_LATEST_EN = new RegExp(`${START}(?:latest|newest|most\\s+recent|recent(?:ly)?|last|new)${END}`, "iu");

const UNIT_DAYS = new Map([
  ["יום", 1], ["ימים", 1], ["יומיים", 2], ["שבוע", 7], ["שבועות", 7], ["שבועיים", 14], ["חודש", 30], ["חודשים", 30], ["שנה", 365], ["שנים", 365],
  ["day", 1], ["days", 1], ["hour", 1], ["hours", 1], ["week", 7], ["weeks", 7], ["month", 30], ["months", 30], ["year", 365], ["years", 365]
]);

const HE_MONTHS = new Map([
  ["ינואר", 1], ["פברואר", 2], ["מרץ", 3], ["מרס", 3], ["אפריל", 4], ["מאי", 5], ["יוני", 6],
  ["יולי", 7], ["אוגוסט", 8], ["ספטמבר", 9], ["אוקטובר", 10], ["נובמבר", 11], ["דצמבר", 12]
]);
const EN_MONTHS = new Map([
  ["january", 1], ["jan", 1], ["february", 2], ["feb", 2], ["march", 3], ["mar", 3], ["april", 4], ["apr", 4], ["may", 5],
  ["june", 6], ["jun", 6], ["july", 7], ["jul", 7], ["august", 8], ["aug", 8], ["september", 9], ["sep", 9], ["sept", 9],
  ["october", 10], ["oct", 10], ["november", 11], ["nov", 11], ["december", 12], ["dec", 12]
]);
const MONTH_WORD = `(?:${[...HE_MONTHS.keys(), ...EN_MONTHS.keys()].sort((a, b) => b.length - a.length).join("|")})`;

// Words that carry no topic: question words, fillers, cues, units, generic verbs.
const STOPWORDS = new Set([
  // Hebrew
  "מה", "מהם", "מהן", "מי", "איזה", "איזו", "אילו", "האם", "הצג", "תראה", "הראה", "תן", "לי", "שלי", "את", "של", "על", "עם", "בנושא", "נושא",
  "לגבי", "בקשר", "בנוגע", "אודות", "יש", "היה", "היו", "הם", "הן", "זה", "זו", "כל", "כולם", "פרויקט", "בפרויקט", "מהפרויקט", "אני", "אנחנו", "רוצה",
  "לראות", "לדעת", "בבקשה", "אפשר", "ספר", "תספר", "סכם", "תסכם", "סיכום", "רשימה", "רשימת", "עוד", "גם", "או", "אם", "כי", "לא", "כן",
  "סוכם", "סוכמו", "נאמר", "נאמרו", "נכתב", "נכתבו", "קרה", "קרו", "התרחש", "התרחשו", "עודכן", "עודכנו", "התקבל", "התקבלו", "נשלח", "נשלחו",
  "הגיע", "הגיעו", "נכנסו", "נכנס", "שלחו", "קיבלנו", "קיבלתי", "מופיע", "מופיעים", "קיים", "קיימים", "דוחות", "דוח", "ממצאי", "ממצאים", "היתה", "הייתה", "הוא", "היא", "הינו", "הינה", "יהיה", "תהיה", "הוחלט", "דובר", "נדון", "נדונו", "עלה", "עלו", "ימים", "יום", "שבוע", "שבועות", "חודש", "חודשים", "שנה", "שנים", "השבוע", "החודש", "היום", "אתמול",
  "מאז", "החל", "מתאריך", "תאריך", "עד", "אחרי", "לפני", "במהלך", "בין", "מתי", "איפה", "כמה",
  // English
  "what", "which", "who", "whats", "show", "me", "list", "give", "tell", "the", "a", "an", "are", "is", "was", "were", "be", "been", "about", "regarding", "on", "of", "for",
  "in", "at", "to", "and", "or", "with", "from", "since", "last", "past", "recent", "recently", "latest", "newest", "most", "new", "project", "any", "there", "all", "my", "our",
  "please", "can", "could", "you", "i", "we", "do", "did", "does", "have", "has", "had", "happened", "discussed", "said", "summarized", "summarised", "received", "sent", "decided", "came", "come", "comes", "coming", "arrived", "arrive", "got", "get", "gets", "went", "going", "here", "summarize", "summarise", "summary", "incoming", "outgoing",
  "day", "days", "hour", "hours", "week", "weeks", "month", "months", "year", "years", "today", "yesterday", "this", "that", "these", "those", "ago", "during", "within", "over"
]);

function normalize(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[־]/g, "-")
    .replace(/[‎‏‪-‮]/g, "")
    .replace(/[ְ-ׇ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ── dates ────────────────────────────────────────────────────────────────────

const pad2 = (value) => String(value).padStart(2, "0");

function isoOf(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function addDaysIso(iso, days) {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days)));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function weekdayOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
}

// "dd.mm.yyyy" for display; null for anything that is not a date.
export function formatDisplayDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null;
}

export function daysBetweenIso(fromIso, toIso) {
  const parse = (iso) => {
    const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(toIso) - parse(fromIso)) / 86_400_000);
}

// Today's date (YYYY-MM-DD) in the project time zone.
export function todayIsoIn(timeZone = "Asia/Jerusalem", now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: String(timeZone || "Asia/Jerusalem"), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const value = (type) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

// Reads one date at the START of `text` (the text after "since" / "מאז"): { date, length } with the
// number of characters of `text` the date used, or null. Day-first numeric dates (Israel). A date with no
// year is this year, or last year if that would be in the future.
function matchLeadingDate(text, todayIso) {
  const normalized = normalize(text);
  const lead = normalized.match(/^(?:ה|ב|ל)?(?:תאריך\s+)?/u)[0].length;
  const value = normalized.slice(lead);
  const [thisYear] = todayIso.split("-").map(Number);
  const found = (date, match) => (date ? { date, length: lead + match[0].length } : null);
  const resolveYear = (day, month, yearText) => {
    if (yearText) {
      const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
      return isoOf(year, month, day);
    }
    const candidate = isoOf(thisYear, month, day);
    if (!candidate) return null;
    return candidate > todayIso ? isoOf(thisYear - 1, month, day) : candidate;
  };
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
  if (match) return found(isoOf(Number(match[1]), Number(match[2]), Number(match[3])), match);
  match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/);
  if (match) return found(resolveYear(Number(match[1]), Number(match[2]), match[3]), match);
  match = value.match(/^(\d{1,2})[./](\d{1,2})(?![\d./-])/);
  if (match) return found(resolveYear(Number(match[1]), Number(match[2]), null), match);
  match = value.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?[בלמ]?(${MONTH_WORD})(?:\\s+(\\d{4}))?`, "u"));
  if (match) return found(resolveYear(Number(match[1]), HE_MONTHS.get(match[2]) || EN_MONTHS.get(match[2]), match[3] || null), match);
  match = value.match(new RegExp(`^(${MONTH_WORD})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "u"));
  if (match) return found(resolveYear(Number(match[2]), HE_MONTHS.get(match[1]) || EN_MONTHS.get(match[1]), match[3] || null), match);
  match = value.match(/^(?:yesterday|אתמול)(?![\p{L}])/u);
  if (match) return found(addDaysIso(todayIso, -1), match);
  match = value.match(/^(?:today|היום)(?![\p{L}])/u);
  if (match) return found(todayIso, match);
  return null;
}

export function parseLeadingDate(text, todayIso) {
  return matchLeadingDate(text, todayIso)?.date ?? null;
}

// ── detection ────────────────────────────────────────────────────────────────

function detectKinds(text) {
  const found = [];
  for (const [key, pattern] of KIND_PATTERNS) {
    const match = pattern.exec(text);
    if (match) found.push({ key, index: match.index, text: match[0] });
  }
  return found.sort((a, b) => a.index - b.index);
}

// The date window a question names, with the part of the text that named it blanked out
// of `working` (so it cannot leak into the topic). Returns { window, working }.
function detectWindow(text, todayIso) {
  let working = text;
  const rolling = (days) => ({ type: "last_days", days, dateFrom: addDaysIso(todayIso, -days), dateTo: todayIso });
  const take = (pattern) => {
    const match = pattern.exec(working);
    if (!match) return null;
    working = `${working.slice(0, match.index)} ${working.slice(match.index + match[0].length)}`;
    return match;
  };

  // since <date> / מאז <date> / החל מ־<date> / מתאריך <date>
  const sincePattern = new RegExp(`(?:${START}since|${START}מאז|${START}החל\\s+מ(?:תאריך)?|${START}מתאריך)\\s*[-־]?\\s*(.{2,40})`, "iu");
  const since = sincePattern.exec(working);
  if (since) {
    const found = matchLeadingDate(since[1], todayIso);
    if (found && found.date <= todayIso) {
      // Remove only the cue and the date, so a topic after it ("since 1.5 about waterproofing") survives.
      const consumed = since[0].length - since[1].length + found.length;
      working = `${working.slice(0, since.index)} ${working.slice(since.index + consumed)}`;
      return { window: { type: "since", days: daysBetweenIso(found.date, todayIso), dateFrom: found.date, dateTo: todayIso }, working };
    }
  }

  // "בימים/בשבועות האחרונים" etc. with a number: "ב-30 הימים האחרונים", "last 14 days", "past 2 weeks"
  let match = take(new RegExp(`${START}(\\d{1,3})\\s*(?:ה)?(ימים|יום|שבועות|שבועיים|שבוע|חודשים|חודש|שנים|שנה)\\s+(?:ה)?אחרונ(?:ים|ות|ה)?${END}`, "iu"))
    || take(new RegExp(`${START}${PREFIX}(\\d{1,3})\\s*(?:ה)?(ימים|יום|שבועות|שבועיים|שבוע|חודשים|חודש|שנים|שנה)${END}`, "iu"));
  if (match) {
    const count = Number(match[1]);
    const days = Math.min(MAX_RECENT_WINDOW_DAYS, Math.max(1, count * (UNIT_DAYS.get(match[2]) || 1)));
    return { window: rolling(days), working };
  }
  match = take(new RegExp(`${START}(?:in\\s+the\\s+|over\\s+the\\s+|during\\s+the\\s+|within\\s+the\\s+|for\\s+the\\s+)?(?:last|past|previous)\\s+(\\d{1,3})\\s*(days?|hours?|weeks?|months?|years?)${END}`, "iu"));
  if (match) {
    const days = Math.min(MAX_RECENT_WINDOW_DAYS, Math.max(1, Number(match[1]) * (UNIT_DAYS.get(match[2]) || 1)));
    return { window: rolling(days), working };
  }
  // two weeks (שבועיים), "the last week/month" (rolling): בשבוע האחרון, בחודש האחרון
  match = take(new RegExp(`${START}${PREFIX}(שבועיים|יומיים)\\s+(?:ה)?אחרונ(?:ים|ות)${END}`, "iu"));
  if (match) return { window: rolling(UNIT_DAYS.get(match[1])), working };
  match = take(new RegExp(`${START}${PREFIX}(שבוע|חודש|שנה)\\s+(?:ה)?אחרו(?:נה|ן)${END}`, "iu"));
  if (match) return { window: rolling(UNIT_DAYS.get(match[1])), working };
  match = take(new RegExp(`${START}(?:in|over|during|within|for)\\s+the\\s+(?:last|past)\\s+(week|month|year|day)${END}`, "iu"));
  if (match) return { window: rolling(UNIT_DAYS.get(match[1])), working };
  match = take(new RegExp(`${START}(?:past|last)\\s+(week|month|year)${END}`, "iu"));
  if (match) return { window: rolling(UNIT_DAYS.get(match[1])), working };

  // previous calendar week / month: שבוע שעבר, החודש שעבר
  match = take(new RegExp(`${START}${PREFIX}(שבוע|חודש)\\s+(?:ה)?שעבר(?:ה)?${END}`, "iu"));
  if (match) {
    if (match[1] === "שבוע") {
      const weekStart = addDaysIso(todayIso, -weekdayOf(todayIso));
      return { window: { type: "last_week", days: 7, dateFrom: addDaysIso(weekStart, -7), dateTo: addDaysIso(weekStart, -1) }, working };
    }
    const [year, month] = todayIso.split("-").map(Number);
    const firstThis = isoOf(year, month, 1);
    const previousLast = addDaysIso(firstThis, -1);
    return { window: { type: "last_month", days: 30, dateFrom: `${previousLast.slice(0, 8)}01`, dateTo: previousLast }, working };
  }

  // this week / this month (calendar, up to today); today; yesterday
  match = take(new RegExp(`(?:${START}[בכ]?ה?שבוע${END}|${START}this\\s+week${END})`, "iu"));
  if (match) {
    const dateFrom = addDaysIso(todayIso, -weekdayOf(todayIso)); // week starts Sunday
    return { window: { type: "this_week", days: daysBetweenIso(dateFrom, todayIso) + 1, dateFrom, dateTo: todayIso }, working };
  }
  match = take(new RegExp(`(?:${START}[בכ]?ה?חודש${END}|${START}this\\s+month${END})`, "iu"));
  if (match) {
    const dateFrom = `${todayIso.slice(0, 8)}01`;
    return { window: { type: "this_month", days: daysBetweenIso(dateFrom, todayIso) + 1, dateFrom, dateTo: todayIso }, working };
  }
  match = take(new RegExp(`(?:${START}[בכ]?היום${END}|${START}today${END})`, "iu"));
  if (match) return { window: { type: "today", days: 1, dateFrom: todayIso, dateTo: todayIso }, working };
  match = take(new RegExp(`(?:${START}אתמול${END}|${START}yesterday${END})`, "iu"));
  if (match) {
    const yesterday = addDaysIso(todayIso, -1);
    return { window: { type: "yesterday", days: 1, dateFrom: yesterday, dateTo: yesterday }, working };
  }
  return { window: null, working };
}

function stripPrefixVariants(token) {
  const variants = [token];
  if (/^[והבלמכש]/u.test(token) && token.length > 3) variants.push(token.slice(1));
  if (/^[והבלמכש]{2}/u.test(token) && token.length > 4) variants.push(token.slice(2));
  return variants;
}

// What is left of the question once cues, kinds, windows and filler are removed.
function extractTopic(working, kindMatches) {
  let text = working;
  for (const kind of kindMatches) text = text.replace(kind.text, " ");
  text = text
    .replace(CUE_LATEST_HE, " ").replace(CUE_NEW_HE, " ").replace(CUE_LATEST_EN, " ")
    .replace(/\d+/g, " ");
  const tokens = text.match(/[\p{L}][\p{L}\p{N}'’"״-]*/gu) || [];
  const topic = tokens.filter((token) => {
    const clean = token.replace(/["״'’]/g, "");
    if (clean.length < 3) return false;
    return !stripPrefixVariants(clean).some((variant) => STOPWORDS.has(variant));
  });
  return topic.join(" ").trim();
}

/**
 * Does this question ask for the newest items of some kind?
 *
 * @param {string} message  the (standalone) question
 * @param {object} [options]
 * @param {Date}   [options.now]
 * @param {string} [options.timeZone]  project time zone (default Asia/Jerusalem)
 * @returns {null | {
 *   kinds: string[],
 *   window: null | { type: string, days: number|null, dateFrom: string, dateTo: string },
 *   singular: boolean, limit: number, topic: string, cues: string[], today: string
 * }}
 */
export function detectRecencyIntent(message, { now = new Date(), timeZone = "Asia/Jerusalem" } = {}) {
  const text = normalize(message);
  if (!text || text.length > 600) return null;
  if (QUANTITATIVE.test(text) || EARLIEST.test(text)) return null;
  // A different year: out of scope for a "recent" read.
  if (/(?:שנה\s+שעברה|שנת\s+\d{4}|\blast\s+year\b|\bin\s+\d{4}\b)/iu.test(text) && !/(?:בשנה\s+האחרונה|in\s+the\s+(?:last|past)\s+year)/iu.test(text)) return null;

  const kinds = detectKinds(text);
  if (!kinds.length) return null;

  const today = todayIsoIn(timeZone, now);
  const { window, working } = detectWindow(text, today);

  const cues = [];
  const latestHe = CUE_LATEST_HE.exec(text);
  if (latestHe) cues.push(latestHe[0]);
  const newHe = CUE_NEW_HE.exec(text);
  if (newHe) cues.push(newHe[0]);
  // English cues; "new" counts only next to a plural kind ("new emails"), never "a new contract".
  const latestEn = [...text.matchAll(new RegExp(CUE_LATEST_EN.source, "giu"))]
    .find((match) => match[0] !== "new" || /\bnew\s+(?:e-?mails|meetings|alerts|decisions|messages|invoices|payments|exceptions|reports)\b/.test(text));
  if (latestEn) cues.push(latestEn[0]);
  if (!window && !cues.length) return null;

  // How many items: "last 5 emails", "5 המיילים האחרונים". A number left after the window was removed.
  const countMatch = (window ? working : text).match(/(?<![\d.\/-])(\d{1,3})(?![\d.\/%:-])/);
  const explicitLimit = countMatch && cues.length ? Math.min(MAX_RECENT_LIMIT, Math.max(1, Number(countMatch[1]))) : null;

  const plural = kinds.some((kind) => HE_PLURAL_ENDING.test(kind.text) || /s$/i.test(kind.text) || /minutes|פרוטוקולים/.test(kind.text))
    || /(?:אחרונים|אחרונות|חדשים|חדשות|עדכניים|עדכניות)/u.test(text)
    // "recently" / "לאחרונה" is an adverb, not a pointer at one item.
    || new RegExp(`(?:${START}לאחרונה${END}|${START}recently${END})`, "u").test(text);
  const singular = !window && !explicitLimit && !plural && cues.length > 0;
  const topic = extractTopic(working, kinds);

  // "the last meeting about the elevators" names one record plus a subject: a lookup with
  // evidence, not a list of recent items. Leave it to the exact routes.
  if (singular && topic) return null;

  const limit = explicitLimit || (singular ? 1 : DEFAULT_RECENT_LIMIT);
  return {
    kinds: [...new Set(kinds.map((kind) => kind.key))].slice(0, 3),
    window,
    singular,
    limit,
    topic,
    cues: cues.map((cue) => cue.trim()).slice(0, 4),
    today
  };
}
