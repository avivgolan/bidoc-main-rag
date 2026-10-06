import { createHash } from 'node:crypto';
import { contentSupabaseConfig } from '../supabase.js';
import { LABELS } from './model.js';
import { pickCurrentVersion } from '../scheduleIngestion.js';

const COMMON = 'id,project_id,title,statement,status,source_date,needs_attention,confidence,withdrawn,superseded,created_at,updated_at';
export const SOURCES = {
  intelligence: ['project_intelligence_items', `${COMMON},kind,importance,due_date,owner_text,decision_maker_text`],
  approval: ['project_approval_items', `${COMMON},due_date,is_blocking,approver_text`],
  question: ['project_open_question_items', `${COMMON},due_date,is_blocking,expected_respondent`],
  delay: ['project_delay_items', `${COMMON},importance,responsible_text`],
  safety: ['project_safety_items', `${COMMON},severity,stop_work,responsible_text`],
  quality: ['project_quality_items', `${COMMON},severity,responsible_text`],
  commercial: ['project_commercial_issue_items', `${COMMON},due_date,is_blocking`],
  progress: ['project_progress_items', `${COMMON},percent_complete,as_of_date,progress_type`],
  conflict: ['contract_conflicts', 'id,project_id,title,statement,status,workspace_id,created_at,updated_at'],
  schedule: ['schedule_alerts', 'id,project_id,activity_key,title,description,severity_level,lifecycle_status,first_detected_at,last_evaluated_at,created_at,updated_at'],
  indicators: ['schedule_indicator_snapshots', 'id,project_id,activity_key,milestone_key,as_of,data_version,engine_version,calculated_at,payload'],
};
export const EVIDENCE_TABLES = {
  intelligence:'project_intelligence_sources', approval:'project_approval_sources', question:'project_open_question_sources',
  delay:'project_delay_sources', safety:'project_safety_sources', quality:'project_quality_sources',
  commercial:'project_commercial_issue_sources', progress:'project_progress_sources',
};
export class DashboardError extends Error {
  constructor(message, status=500, code='dashboard_error') { super(message); this.status=status; this.code=code; }
}
export function dashboardConnection(config) {
  const c=contentSupabaseConfig(config);
  if (!c.supabaseUrl || !c.supabaseServiceRoleKey) throw new DashboardError('חיבור נתוני הפרויקט אינו מוגדר',503,'not_configured');
  const url=new URL(c.supabaseUrl);
  if(url.protocol!=='https:') throw new DashboardError('חיבור לא תקף',503,'invalid_connection');
  return { url:url.origin, key:c.supabaseServiceRoleKey, tenantKey:url.hostname, indexTable:c.indexTable, alertsTable:c.alertsTable,
    identity:createHash('sha256').update(`${url.origin}|${c.supabaseServiceRoleKey}`).digest('hex') };
}
export function validTable(name) {
  if(!/^[a-z][a-z0-9_]{0,62}$/.test(name || '')) throw new DashboardError('שם מקור לא תקף',400,'invalid_source');
  return name;
}
// By construction this adapter exposes GET only. Never reuse source routes to mutate.
export function createSourceReader(connection, fetchImpl=fetch) {
  return async function read(table, query, { maxRows=15000, recent=false }={}) {
    validTable(table);
    const rows=[]; let total=null; const pageSize=500;
    while(rows.length < maxRows) {
      const q=new URLSearchParams(query); q.set('offset',String(rows.length)); q.set('limit',String(Math.min(pageSize,maxRows-rows.length)));
      const res=await fetchImpl(`${connection.url}/rest/v1/${table}?${q}`,{method:'GET',
        headers:{apikey:connection.key,Authorization:`Bearer ${connection.key}`,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
      if(!res.ok) throw new DashboardError(res.status===404?'מקור הנתונים אינו זמין':'לא ניתן לקרוא את המקור',502,`source_${res.status}`);
      const page=await res.json(); if(!Array.isArray(page)) throw new DashboardError('תשובת מקור לא תקפה');
      const count=res.headers.get('content-range')?.split('/')[1];
      if(count && count!=='*') { const n=Number(count); if(Number.isFinite(n)) total=n; }
      rows.push(...page);
      if(recent || !page.length || (total!==null && rows.length>=total)) break;
      // If count is unavailable, continue until an empty page (server caps can be below pageSize).
    }
    const complete=recent || (total!==null ? rows.length>=total : rows.length<maxRows);
    return { rows, total, complete, status:complete?'ready':'partial', reason:complete?null:'הקריאה חלקית; הספירה הכוללת אינה זמינה' };
  };
}
export async function listDashboardProjects(read) {
  const result=await read('projects',{select:'id,name,is_active',is_active:'eq.true',order:'name.asc,id.asc'});
  if(!result.complete) throw new DashboardError('רשימת הפרויקטים אינה מלאה',503);
  return result.rows.map(p=>({id:p.id,name:p.name}));
}
export async function loadDashboardSources({ read, projectId, fileId, indexTable='data_index', alertsTable='alerts',dateFrom=null,dateTo=null }) {
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId || '')) throw new DashboardError('יש לבחור פרויקט תקף',400,'invalid_project');
  const found=await read('projects',{select:'id,name,is_active,settings',id:`eq.${projectId}`,is_active:'eq.true',order:'id.asc'},{maxRows:2});
  const project=found.rows[0]; if(!project) throw new DashboardError('הפרויקט אינו זמין בחיבור הנוכחי',404,'project_not_found');
  const datasets={};
  const collect=async(key,table,fields,filters={},options={})=>{
    try { datasets[key]={...await read(table,{select:fields,project_id:`eq.${projectId}`,order:'id.asc',...filters},options),table,label:LABELS[key] || key}; }
    catch(error) { datasets[key]={rows:[],complete:false,status:'error',reason:error.message,table,label:LABELS[key] || key}; }
  };
  await Promise.all(Object.entries(SOURCES).map(([key,[table,fields]])=>collect(key,table,fields)));
  const filesTable=validTable(project.settings?.gantt_files_table_name || 'gantt_files');
  const tasksTable=validTable(project.settings?.gantt_tasks_table_name || 'gantt_tasks');
  await collect('files',filesTable,'id,file_id,display_name,start_date,end_date,relevancy_date,uploaded_at,last_saved,project_id');
  const files=datasets.files.rows;
  const selected=fileId ? files.find(f=>String(f.file_id)===fileId) : pickCurrentVersion(files).current;
  if(fileId&&!selected) throw new DashboardError('גרסת הלוח אינה שייכת לפרויקט',400,'invalid_version');
  if(selected) await collect('tasks',tasksTable,'id,project_id,file_id,task_uid,task_name,start_date,finish_date,percent_complete,is_summary,is_milestone', {file_id:`eq.${selected.file_id}`});
  else datasets.tasks={rows:[],complete:datasets.files.complete,status:'empty',table:tasksTable,label:'פעילויות'};
  await collect('documents',validTable(indexTable),'id,project_id,title,summary,source_table,source_id,source_url,primary_date,created_at',{order:'created_at.desc,id.desc'}, dateFrom||dateTo?{}:{maxRows:40,recent:true});
  await collect('timelineAlerts',validTable(alertsTable),'id,project_id,data_date,created_at,summary,alert_description,alert_type,severity_level,item_status,data_link,input_data_type,input_data_id,analyzed_data,metadata',{order:'data_date.desc.nullslast,id.desc'});
  await collect('timelineLinks','schedule_activity_alert_links','id,project_id,source_id,activity_key,event_date',{source_table:'eq.alerts'});
  return {project,datasets,schedule:{file:selected || null,files,tasks:datasets.tasks.rows,selectionBasis:fileId?'selected':'latest_available_unapproved'}};
}
