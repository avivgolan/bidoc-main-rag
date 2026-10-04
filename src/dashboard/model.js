// Pure dashboard read model. No database writes, model calls or environment access.
import { diffCalendarDays, toIsoDate } from '../scheduleCalendar.js';

export const METRIC_VERSION = 'dashboard.v1';
export const LABELS = {
  intelligence: 'החלטות והתחייבויות', approval: 'אישורים והיתרים', question: 'שאלות פתוחות',
  delay: 'עיכובים', safety: 'בטיחות', quality: 'איכות', commercial: 'סוגיות מסחריות',
  progress: 'דיווחי ביצוע', conflict: 'סתירות חוזיות', schedule: 'לו״ז',
};
const CLOSED = {
  intelligence: ['completed', 'cancelled', 'superseded', 'contradicted', 'reversed', 'recorded', 'confirmed'],
  approval: ['approved', 'approved_with_conditions', 'rejected', 'expired'],
  question: ['answered', 'resolved', 'closed'], delay: ['resolved', 'mitigated'],
  safety: ['resolved', 'mitigated'], quality: ['closed', 'resolved'], commercial: ['resolved'],
  progress: ['completed'], conflict: ['reviewed', 'resolved'], schedule: ['resolved', 'dismissed'],
};
const OPEN = {
  intelligence: ['open', 'in_progress'], approval: ['requested', 'in_review'],
  question: ['open', 'awaiting_answer'], delay: ['open', 'in_progress', 'monitoring'],
  safety: ['open', 'in_progress', 'monitoring'], quality: ['open', 'in_progress', 'identified'],
  commercial: ['open', 'on_hold', 'disputed'], progress: ['open', 'on_track', 'stalled'],
  conflict: ['detected', 'unresolved', 'open'], schedule: ['open', 'updated'],
};
export const finite = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const validRow = row => !row.withdrawn && !row.superseded && !['withdrawn', 'superseded', 'cancelled'].includes(row.status);
export function safeSourceUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function normalizeItem(row, domain, table, asOf) {
  const status = row.lifecycle_status || row.status || 'unknown';
  const closed = CLOSED[domain]?.includes(status) || false;
  const open = !closed && (OPEN[domain]?.includes(status) || false);
  const severity = domain === 'schedule'
    ? ({ 5: 'critical', 4: 'high', 3: 'medium', 2: 'low' })[row.severity_level] || 'unknown'
    : row.severity || row.importance || 'unknown';
  const dueDate = toIsoDate(row.due_date);
  const overdueDays = open && dueDate ? Math.max(0, diffCalendarDays(dueDate, asOf) ?? 0) : null;
  return {
    id: `${table}:${row.id}`, sourceId: String(row.id), sourceTable: table, domain,
    kind: row.kind || domain, title: String(row.title || row.statement || row.description || LABELS[domain]).slice(0, 220),
    summary: String(row.statement || row.description || row.summary || '').slice(0, 700),
    status, open, closed, severity, needsAttention: row.needs_attention === true,
    isBlocking: row.is_blocking === true || row.stop_work === true,
    dueDate, overdueDays, sourceDate: toIsoDate(row.source_date || row.event_date || row.first_detected_at),
    updatedAt: row.updated_at || row.last_evaluated_at || row.created_at || null,
    owner: row.approver_text || row.expected_respondent || row.decision_maker_text || row.owner_text || row.responsible_text || null,
    activityKey: row.activity_key || null, workspaceId: row.workspace_id || null,
    confidence: finite(row.confidence),
    reasons: [row.stop_work ? 'עצירת עבודה מדווחת' : row.is_blocking ? 'חסימה מדווחת' : null,
      open && severity === 'critical' ? 'חומרה קריטית' : null,
      overdueDays > 0 ? `מועד היעד חלף ב־${overdueDays} ימים` : null,
      row.needs_attention ? 'סומן לבדיקה במקור' : null,
      closed && row.needs_attention ? 'המצב סגור; נדרשת בדיקה נפרדת' : null].filter(Boolean),
  };
}
export function rankItems(items) {
  const rank = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
  return [...items].sort((a,b) =>
    ((b.open ? rank[b.severity] : 0) || 0) - ((a.open ? rank[a.severity] : 0) || 0)
    || Number(b.isBlocking) - Number(a.isBlocking)
    || (b.overdueDays || 0) - (a.overdueDays || 0)
    || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))
    || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    || a.id.localeCompare(b.id));
}

// Exactly one source generation and one date; never merge historical generations.
export function selectCohort(rows, fileId, asOf) {
  if (!fileId) return { rows: [], asOf: null, dataVersion: null };
  const candidates = rows.filter(r => (r.data_version === fileId || r.data_version === `${fileId}#v1`)
    && r.as_of <= asOf && r.engine_version === 'schedule-engine.v1');
  const date = candidates.map(r=>r.as_of).sort().at(-1) || null;
  const selected = candidates.filter(r=>r.as_of === date).sort((a,b)=>String(b.calculated_at).localeCompare(String(a.calculated_at)));
  const unique = new Map();
  for (const row of selected) {
    const key = `${row.activity_key || ''}|${row.milestone_key || ''}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return { rows: [...unique.values()], asOf: date, dataVersion: selected[0]?.data_version || null };
}

export function buildDashboard({ project, datasets, schedule, now, asOf }) {
  const sourceHealth = Object.entries(datasets).map(([key, value]) => ({
    key, label: ({files:'גרסאות לוח',tasks:'פעילויות',indicators:'מדדי לו״ז',documents:'מקורות מאונדקסים',timelineAlerts:'התראות ציר הזמן',timelineLinks:'שיוכי התראות לפעילויות'})[key] || value.label || LABELS[key] || key, status: value.status,
    count: value.rows.length, complete: value.complete, reason: value.reason || null,
    sourceUpdatedAt: value.rows.map(r=>r.updated_at || r.calculated_at || r.created_at).filter(Boolean).sort().at(-1) || null,
  }));
  const rows = key => datasets[key]?.rows || [];
  const domains = Object.keys(LABELS).filter(k=>k !== 'schedule');
  const all = domains.flatMap(domain => rows(domain).filter(validRow).map(r=>normalizeItem(r, domain, datasets[domain].table, asOf)));
  const file = schedule.file;
  const tasks = schedule.tasks;
  const taskKeys = new Set(tasks.map(t=>`gantt:${file?.file_id}:${t.task_uid}`));
  const cohort = selectCohort(rows('indicators'), file?.file_id, asOf);
  const indicators = cohort.rows.filter(r=>taskKeys.has(r.activity_key));
  const scheduleItems = rows('schedule').filter(r=>taskKeys.has(r.activity_key)).map(r=>normalizeItem(r, 'schedule', 'schedule_alerts', asOf));
  all.push(...scheduleItems);
  const itemMap = new Map(all.map(item=>[item.id,item]));
  const unique = [...itemMap.values()];
  const healthFor = keys => keys.every(k=>datasets[k]?.complete);
  const metric = (key, label, members, keys, note) => ({
    key, label, value: healthFor(keys) ? members.length : null, knownCount: members.length,
    unit: 'count', status: healthFor(keys) ? (members.length ? 'ready' : 'empty') : 'partial',
    note, memberIds: members.map(r=>r.id), asOf, computedAt: now,
    coverage: { scopeComplete: healthFor(keys), measured: members.length }, metricVersion: METRIC_VERSION,
  });
  const critical = unique.filter(i=>i.open && i.severity === 'critical');
  const approvals = unique.filter(i=>i.domain === 'approval' && i.open);
  const openSchedule = scheduleItems.filter(i=>i.open);
  const decisions = unique.filter(i=>i.kind === 'decision' && i.needsAttention);
  const leaf = tasks.filter(t=>!t.is_summary && !t.is_milestone);
  const reported = leaf.filter(t=>finite(t.percent_complete) !== null);
  const progressEvidence = rows('progress').filter(validRow);
  const metrics = [
    { key: 'progress', label: 'התקדמות הפרויקט', value: null, status: 'unavailable', unit: 'percent',
      note: 'נדרש דיווח ביצוע מאומת ובסיס משקולות; נתון חסר אינו אפס.', memberIds: [],
      coverage: { measured: reported.length, eligible: leaf.length, scopeComplete: false }, metricVersion: METRIC_VERSION, asOf, computedAt: now },
    metric('critical', 'נושאים קריטיים פתוחים', critical, [...domains,'schedule','tasks','files'], 'חומרה קריטית ומצב פתוח במקור; ללא ספירה של החלטות שכבר התקבלו.'),
    metric('approvals', 'אישורים ממתינים', approvals, ['approval'], 'בקשות ואישורים בבדיקה, ללא רשומות שבוטלו או הוחלפו.'),
    metric('schedule', 'התראות לו״ז פתוחות', openSchedule, ['schedule','tasks','files'], 'התראות המשויכות לגרסת הלוח המוצגת. סגירת התראה אינה סיום פעילות.'),
  ];
  const decisionsMetric = metric('decisions', 'החלטות דורשות בדיקה', decisions, ['intelligence'], 'כולל החלטות שהתקבלו וסומנו לבדיקה; אינו מונה החלטות הממתינות להכרעה.');
  metrics.push(decisionsMetric);
  const attention = rankItems(unique.filter(i=>i.needsAttention || (i.open && (['critical','high'].includes(i.severity) || i.isBlocking || i.overdueDays > 0))));
  const updated = file?.relevancy_date || null;
  const age = updated ? diffCalendarDays(toIsoDate(updated), asOf) : null;
  const snapshotByKey = new Map(indicators.map(r=>[r.activity_key,r]));
  const milestones = tasks.filter(t=>t.is_milestone).slice(0,8).map(t=>({
    id: String(t.task_uid), title: t.task_name, plannedFinish: toIsoDate(t.finish_date),
    observedFinish: snapshotByKey.get(`gantt:${file?.file_id}:${t.task_uid}`)?.payload?.timing?.observedFinish || null,
  }));
  const docsSeen = new Set();
  const documents = rows('documents').filter(r=>{
    const key=`${r.source_table}:${r.source_id}`;
    if (docsSeen.has(key)) return false; docsSeen.add(key); return true;
  }).slice(0,5).map(r=>({ id:String(r.id), title:r.title || r.summary?.slice(0,100) || 'מקור ללא כותרת',
    sourceTable:r.source_table, sourceId:String(r.source_id), sourceDate:toIsoDate(r.primary_date),
    ingestedAt:r.created_at, url:safeSourceUrl(r.source_url) }));
  const activity = unique.filter(i=>i.updatedAt).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,10);
  return {
    schemaVersion: 1, metricVersion: METRIC_VERSION, project: { id: project.id, name: project.name },
    asOf, computedAt:now, sourceHealth, metrics,
    attention: attention.slice(0,5), attentionTotal:attention.length, items:unique,
    breakdown: [...domains,'schedule'].map(domain=>({domain,label:LABELS[domain],complete:healthFor([domain]),
      open:unique.filter(i=>i.domain===domain&&i.open).length,
      attention:attention.filter(i=>i.domain===domain).length})),
    schedule: {
      fileId:file?.file_id || null, title:file?.display_name || 'לא נמצא לוח זמנים',
      files:schedule.files.map(f=>({id:f.file_id,name:f.display_name || f.file_id})),
      selectionBasis:schedule.selectionBasis, baselineApproved:false,
      taskCount:tasks.length, leafCount:leaf.length, startDate:toIsoDate(file?.start_date), endDate:toIsoDate(file?.end_date),
      sourceDate:updated, uploadedAt:file?.uploaded_at || null, status: !file ? 'unavailable' : age === null || age > 30 ? 'stale' : 'ready',
      cohortAsOf:cohort.asOf, indicatorCount:indicators.length,
      progressReports:progressEvidence.length, numericReports:progressEvidence.filter(r=>finite(r.percent_complete)!==null).length,
      allReportedZero:reported.length > 0 && reported.every(t=>finite(t.percent_complete)===0),
      milestones, forecast:null, contractDate:null,
      timeline:tasks.filter(t=>!t.is_summary).map(t=>({id:String(t.task_uid),activityKey:`gantt:${file?.file_id}:${t.task_uid}`,title:t.task_name,start:toIsoDate(t.start_date),end:toIsoDate(t.finish_date),milestone:t.is_milestone,reportedPercent:finite(t.percent_complete)})),
    },
    timeline: {complete:healthFor(['timelineAlerts']),linksComplete:healthFor(['timelineLinks']),
      events:rows('timelineAlerts').map(r=>({id:String(r.id),title:r.summary || r.alert_description || r.alert_type || 'התראה',date:toIsoDate(r.data_date || r.created_at),type:r.alert_type,status:r.item_status,severity:r.severity_level,url:safeSourceUrl(r.data_link),activityKey:rows('timelineLinks').find(l=>String(l.source_id)===String(r.id))?.activity_key || null})),
    },
    documents, activity,
    questions:['מה הנושאים שדורשים טיפול בפרויקט?', 'אילו אישורים חוסמים את ההתקדמות?', 'מה חסר כדי להעריך את מועד המסירה?'],
    constraints:['נתוני המקור לקריאה בלבד', 'אין תחזית מסירה ללא בסיס מדיד'],
  };
}
