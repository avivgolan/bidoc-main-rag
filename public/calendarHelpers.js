// Pure calendar date math — no DOM, no state, fully testable

export function calDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function calClampDay(year, month, day) {
  return Math.min(Math.max(1, day), calDaysInMonth(year, month));
}

export function calDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calNavigateByDays(year, month, day, delta) {
  const d = new Date(year, month, day + delta);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export function calNavigateByMonths(year, month, day, delta) {
  const next = new Date(year, month + delta, 1);
  const ny = next.getFullYear();
  const nm = next.getMonth();
  return { year: ny, month: nm, day: calClampDay(ny, nm, day) };
}

// direction: "start" = Sunday (0), "end" = Saturday (6)
export function calWeekBoundary(year, month, day, direction) {
  const d = new Date(year, month, day);
  const dow = d.getDay(); // 0=Sunday … 6=Saturday
  if (direction === "start") return calNavigateByDays(year, month, day, -dow);
  return calNavigateByDays(year, month, day, 6 - dow);
}
