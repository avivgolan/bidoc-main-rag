const DAY_MS = 24 * 60 * 60 * 1000;

function dateMs(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

// Build the presentation scale from the visible activity rows, while always
// retaining every contractual date. A future milestone may be excluded by the
// "late only" row filter, but its flag is still part of the contractual axis.
export function makeScheduleScale(indicators = [], asOf, contractIndicators = indicators) {
  let min = Infinity;
  let max = -Infinity;
  const consider = (value) => {
    const ms = dateMs(value);
    if (ms == null) return;
    if (ms < min) min = ms;
    if (ms > max) max = ms;
  };

  consider(asOf);
  for (const indicator of indicators) {
    const timing = indicator?.timing ?? {};
    consider(timing.plannedStart);
    consider(timing.plannedFinish);
    consider(timing.contractFinish);
    consider(timing.observedStart);
    consider(timing.observedFinish);
  }
  for (const indicator of contractIndicators ?? []) {
    consider(indicator?.timing?.contractFinish);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    min -= DAY_MS;
    max += DAY_MS;
  } else {
    const pad = (max - min) * 0.03;
    min -= pad;
    max += pad;
  }

  const pos = (value) => {
    const ms = dateMs(value);
    if (ms == null) return null;
    return Math.min(100, Math.max(0, ((ms - min) / (max - min)) * 100));
  };
  const months = [];
  const cursor = new Date(min);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= max) {
    const iso = cursor.toISOString().slice(0, 10);
    const left = pos(iso);
    if (left != null) months.push({ iso, left, month: cursor.getUTCMonth(), year: cursor.getUTCFullYear() });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { pos, months };
}

export function scheduleSubjectKey(indicator) {
  const subject = indicator?.subject ?? {};
  return subject.activityKey || (subject.milestoneKey ? `milestone:${subject.milestoneKey}` : null);
}
