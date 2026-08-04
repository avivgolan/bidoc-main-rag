// Working-day and date arithmetic for the Schedule Intelligence Engine.
//
// Pure module: no I/O, no Date.now(), no environment access. Dates are
// "YYYY-MM-DD" strings interpreted at UTC midnight, so results never depend
// on the server timezone or DST. Weekday encoding follows Postgres
// extract(dow) — 0 = Sunday .. 6 = Saturday — matching
// schedule_calendars.working_weekdays (spec section 6.6).

export const DEFAULT_WORKING_WEEKDAYS = [0, 1, 2, 3, 4]; // Sun-Thu (Israel)

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

// Accepts "YYYY-MM-DD" or a full ISO timestamp; returns "YYYY-MM-DD" or null.
// Malformed input is a data problem, not a programming error — never throws.
export function toIsoDate(value) {
  if (value == null) return null;
  const text = String(value).slice(0, 10);
  return isIsoDate(text) ? text : null;
}

function utcMs(iso) {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function diffCalendarDays(fromIso, toIso) {
  const from = toIsoDate(fromIso);
  const to = toIsoDate(toIso);
  if (!from || !to) return null;
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

export function addCalendarDays(iso, days) {
  const date = toIsoDate(iso);
  if (!date || !Number.isFinite(Number(days))) return null;
  return new Date(utcMs(date) + Math.round(Number(days)) * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(iso) {
  const date = toIsoDate(iso);
  if (date == null) return null;
  return new Date(utcMs(date)).getUTCDay(); // 0 = Sunday, same as extract(dow)
}

// raw: { workingWeekdays | working_weekdays, holidays, holidaysThrough | holidays_through }
// Returns a normalized calendar or null. Null means "no calendar defined" —
// per spec 6.6 the engine must then return null for every workingDays* field
// rather than silently assuming a work week.
export function normalizeCalendar(raw) {
  if (!raw || typeof raw !== "object") return null;
  const weekdaysInput = raw.workingWeekdays ?? raw.working_weekdays ?? DEFAULT_WORKING_WEEKDAYS;
  const workingWeekdays = new Set(
    (Array.isArray(weekdaysInput) ? weekdaysInput : DEFAULT_WORKING_WEEKDAYS)
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );
  if (!workingWeekdays.size) return null; // a calendar with zero working days is unusable
  const holidays = new Set(
    (Array.isArray(raw.holidays) ? raw.holidays : []).map(toIsoDate).filter(Boolean)
  );
  return {
    workingWeekdays,
    holidays,
    holidaysThrough: toIsoDate(raw.holidaysThrough ?? raw.holidays_through)
  };
}

export function isWorkingDay(iso, calendar) {
  const date = toIsoDate(iso);
  if (!date || !calendar) return null;
  return calendar.workingWeekdays.has(weekdayOf(date)) && !calendar.holidays.has(date);
}

// Working days strictly after `fromIso`, up to and including `toIso`.
// Convention chosen so that "working days late" counts the days that passed
// after the deadline itself. Symmetric for reversed ranges (negative result).
export function countWorkingDays(fromIso, toIso, calendar) {
  const from = toIsoDate(fromIso);
  const to = toIsoDate(toIso);
  if (!from || !to || !calendar) return null;
  if (from === to) return 0;
  if (utcMs(from) > utcMs(to)) {
    const reversed = countWorkingDays(to, from, calendar);
    return reversed == null ? null : -reversed;
  }
  let count = 0;
  let cursor = addCalendarDays(from, 1);
  while (utcMs(cursor) <= utcMs(to)) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

// "ok"     — the holiday list covers the whole measured range;
// "stale"  — the range runs past holidays_through, so un-entered holidays are
//            counted as working days and every workingDays* figure is inflated
//            (spec 6.6 / runbook step 7);
// "missing" — no calendar at all.
export function calendarCoverageState(calendar, throughIso) {
  if (!calendar) return "missing";
  if (!calendar.holidaysThrough) return "stale";
  const through = toIsoDate(throughIso);
  if (!through) return "ok";
  return utcMs(calendar.holidaysThrough) >= utcMs(through) ? "ok" : "stale";
}
