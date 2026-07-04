// Deterministic domain analysis for the specialist content agents (spec B2).
// Pure functions: rows in, compact structured analysis out. This is each
// agent's "expertise" — the focused processing the user asked for — and it is
// attached to the tool result as `analysis` and fed to the synthesis prompt.

const TOP_LIMIT = 5;

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = String(keyFn(row) ?? "").trim();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function topEntries(counts, limit = TOP_LIMIT) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ name: key, count }));
}

function dateRange(rows, field = "date") {
  const dates = rows.map((row) => row?.[field]).filter(Boolean).map((value) => String(value).slice(0, 10)).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}

function splitNames(value) {
  return String(value || "").split(/[,;]+/).map((name) => name.trim()).filter(Boolean);
}

export function analyzeMeetings(rows = []) {
  const byStatus = countBy(rows, (row) => row.status || row.item_status);
  const withDecisions = rows.filter((row) => String(row.decisions_made || "").trim());
  const participants = countBy(
    rows.flatMap((row) => splitNames(row.attendances)),
    (name) => name.split(" - ")[0]
  );
  return {
    total: rows.length,
    date_range: dateRange(rows),
    by_status: byStatus,
    decisions_count: withDecisions.length,
    recent_decisions: withDecisions
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 8)
      .map((row) => ({ date: row.date || null, subject: row.subject || row.title || null, decisions: String(row.decisions_made).slice(0, 300) })),
    top_participants: topEntries(participants)
  };
}

export function analyzeEmails(rows = []) {
  return {
    total: rows.length,
    date_range: dateRange(rows),
    top_senders: topEntries(countBy(rows, (row) => row.sender_name || row.sender_mail || row.sender)),
    by_category: countBy(rows, (row) => row.mail_category),
    by_direction: countBy(rows, (row) => row.direction),
    with_attachments: rows.filter((row) => row.has_attachments === true).length
  };
}

export function analyzeWhatsapp(rows = []) {
  const tasks = rows.flatMap((row) => Array.isArray(row.tasks_json) ? row.tasks_json : []);
  const openTasks = tasks.filter((task) => !/בוצע|הושלם|סגור|closed|done/i.test(String(task?.status || "")));
  const deadlines = tasks
    .map((task) => ({ due_date: task?.due_date || null, description: String(task?.description || "").slice(0, 200), responsible: task?.responsible || null, status: task?.status || null }))
    .filter((task) => task.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const participants = countBy(rows.flatMap((row) => Array.isArray(row.people_involved_json) ? row.people_involved_json : []), (name) => name);
  return {
    conversations: rows.length,
    date_range: dateRange(rows),
    open_tasks: openTasks.slice(0, 8).map((task) => ({ description: String(task?.description || "").slice(0, 200), responsible: task?.responsible || null, status: task?.status || null, due_date: task?.due_date || null })),
    open_tasks_count: openTasks.length,
    upcoming_deadlines: deadlines.slice(0, 6),
    decisions_count: rows.reduce((sum, row) => sum + (Array.isArray(row.decisions_json) ? row.decisions_json.length : 0), 0),
    top_participants: topEntries(participants)
  };
}

export function analyzeFinancial(rows = []) {
  const amounts = rows.map((row) => Number(row.amount_numeric ?? String(row.total || "").replace(/[^\d.-]/g, ""))).filter((value) => Number.isFinite(value) && value !== 0);
  const sumByType = {};
  for (const row of rows) {
    const type = String(row.transaction_type || "").trim();
    const amount = Number(row.amount_numeric ?? String(row.total || "").replace(/[^\d.-]/g, ""));
    if (!type || !Number.isFinite(amount)) continue;
    sumByType[type] = Math.round(((sumByType[type] || 0) + amount) * 100) / 100;
  }
  return {
    total: rows.length,
    date_range: dateRange(rows),
    total_amount: Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100) / 100,
    amounts_counted: amounts.length,
    sum_by_type: sumByType,
    top_vendors: topEntries(countBy(rows, (row) => row.vendor_name)),
    by_status: countBy(rows, (row) => row.status || row.item_status),
    currencies: countBy(rows, (row) => row.currency)
  };
}

export function analyzeSafety(rows = []) {
  const sum = (field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  const riskOrder = ["גבוהה", "בינונית", "נמוכה"];
  const risks = rows.map((row) => String(row.risk_level || "").trim()).filter(Boolean);
  const worstRisk = riskOrder.find((level) => risks.some((risk) => risk.includes(level))) || risks[0] || null;
  return {
    reports: rows.length,
    date_range: dateRange(rows),
    defect_totals: {
      life_threatening: sum("life_threatening_defects"),
      severe: sum("severe_defects"),
      medium: sum("medium_defects"),
      minor: sum("minor_defects"),
      resolved: sum("resolved")
    },
    worst_risk_level: worstRisk,
    by_risk_level: countBy(rows, (row) => row.risk_level),
    sites: topEntries(countBy(rows, (row) => row.site_location))
  };
}

// Fallback expertise for a user-chosen table: counts, date range, and
// breakdowns of low-cardinality string columns.
export function analyzeGeneric(rows = [], roles = {}) {
  const breakdowns = {};
  const sample = rows[0] || {};
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value !== "string" || key === roles.idColumn || key === roles.dateColumn) continue;
    const counts = countBy(rows, (row) => row[key]);
    const distinct = Object.keys(counts).length;
    if (distinct >= 2 && distinct <= 8 && distinct < rows.length) breakdowns[key] = counts;
    if (Object.keys(breakdowns).length >= 3) break;
  }
  return {
    total: rows.length,
    date_range: dateRange(rows),
    breakdowns
  };
}
