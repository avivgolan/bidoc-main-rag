/**
 * Returns the current date/time as an ISO-8601 string adjusted to the given UTC offset.
 * timezone format: "UTC+3", "UTC-5", "UTC+0", "GMT+2" etc.
 */
export function getProjectDateTime(timezone = "UTC+0") {
  const match = String(timezone).match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = parseInt(match?.[2] || "0", 10);
  const minutes = parseInt(match?.[3] || "0", 10);
  const totalOffsetMinutes = sign * (hours * 60 + minutes);

  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utcMs + totalOffsetMinutes * 60000);

  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const timeStr = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  const absOffset = Math.abs(totalOffsetMinutes);
  const tzSuffix = `${totalOffsetMinutes >= 0 ? "+" : "-"}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;

  return `${dateStr}T${timeStr}${tzSuffix}`;
}
