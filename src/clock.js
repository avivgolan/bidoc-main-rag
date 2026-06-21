const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const pad = (number) => String(number).padStart(2, "0");

function getFixedOffsetDateTime(timezone, date) {
  const match = String(timezone).match(/(?:UTC|GMT)?([+-])(\d{1,2})(?::(\d{2}))?/i);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = parseInt(match?.[2] || "0", 10);
  const minutes = parseInt(match?.[3] || "0", 10);
  const totalOffsetMinutes = sign * (hours * 60 + minutes);
  const local = new Date(date.getTime() + totalOffsetMinutes * 60_000);
  const absoluteOffset = Math.abs(totalOffsetMinutes);

  const datePart = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const timePart = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  const offsetPart = `${totalOffsetMinutes >= 0 ? "+" : "-"}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;

  return `${datePart}T${timePart}${offsetPart}`;
}

/**
 * Returns an ISO-like date/time in an IANA zone or a fixed UTC offset.
 * IANA zones such as Asia/Jerusalem automatically account for daylight saving time.
 */
export function getProjectDateTime(timezone = DEFAULT_TIMEZONE, date = new Date()) {
  const resolvedTimezone = String(timezone || DEFAULT_TIMEZONE).trim();

  if (/^(?:UTC|GMT)(?:[+-]|$)/i.test(resolvedTimezone)) {
    return getFixedOffsetDateTime(resolvedTimezone, date);
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: resolvedTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type)?.value;
    const offset = (value("timeZoneName") || "GMT+00:00").replace(/^GMT/, "") || "+00:00";

    return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}${offset}`;
  } catch {
    return getFixedOffsetDateTime("UTC+0", date);
  }
}
