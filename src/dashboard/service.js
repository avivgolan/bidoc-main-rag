import { createHash, randomBytes } from 'node:crypto';
import { buildInsightBrief } from './insightBrief.js';
import { buildDashboard, METRIC_VERSION, safeSourceUrl, validRow, rankItems } from './model.js';
import { createSourceReader, dashboardConnection, DashboardError, EVIDENCE_TABLES, listDashboardProjects, loadDashboardSources } from './sources.js';

const TTL=5*60*1000;
export function projectToday(now=new Date(),timezone='Asia/Jerusalem') {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function snapshotPayload(view) {
  const byId=new Map(view.items.map(i=>[i.id,i]));
  const metrics=view.metrics.map(({memberIds,...metric})=>metric);
  const members=view.metrics.flatMap(metric=>metric.memberIds.map(id=>{
    const i=byId.get(id);
    return { metric_key:metric.key,member_key:id,source_table:i.sourceTable,source_id:i.sourceId,
      native_status:i.status,severity:i.severity,source_revision:i.updatedAt,contribution:1 };
  }));
  return { metricVersion:METRIC_VERSION, metrics, members, sourceHealth:view.sourceHealth,
    sourceVersions:{scheduleFile:view.schedule.fileId,scheduleAsOf:view.schedule.cohortAsOf,dateRange:view.dateRange},
    capturedAt:view.computedAt, asOf:view.asOf,
    status:view.metrics.some(m=>m.status==='partial')?'partial':'ready' };
}

export function createDashboardService({ fetchImpl=fetch, clock=()=>new Date() }={}) {
  const cache=new Map(); const inFlight=new Map();
  const reader=c=>createSourceReader(c,fetchImpl);
  function sweep() { for(const [key,v] of cache) if(v.expires<=clock().getTime()) cache.delete(key); while(cache.size>24) cache.delete(cache.keys().next().value); }
  const publicView=entry=>({ ...entry.view,items:undefined,metrics:entry.view.metrics.map(({memberIds,...m})=>m),queryToken:entry.token });
  function context(config,actor,token) {
    sweep(); const c=dashboardConnection(config);
    const entry=[...cache.values()].find(e=>e.token===token && e.actor===actor && e.connection===c.identity);
    if(!entry) throw new DashboardError('תמונת הנתונים השתנתה או פגה. יש לרענן את הדשבורד.',409,'context_expired');
    return {c,entry};
  }
  async function projects(config) { return listDashboardProjects(reader(dashboardConnection(config))); }
  async function overview(config,actor,{projectId,fileId=null,force=false,dateFrom=null,dateTo=null}={}) {
    for(const value of [dateFrom,dateTo])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new DashboardError('תאריך לא תקף',400,'invalid_date_range');
    dateFrom=dateFrom||null;dateTo=dateTo||null;
    if(dateFrom&&dateTo&&dateFrom>dateTo)throw new DashboardError('תאריך ההתחלה חייב להיות לפני תאריך הסיום',400,'invalid_date_range');
    sweep(); const c=dashboardConnection(config); const day=projectToday(clock(),config.timezone || 'Asia/Jerusalem');
    const key=[c.identity,actor,projectId,fileId || '',day,dateFrom||'',dateTo||''].join('|');
    if(!force && cache.has(key)) return publicView(cache.get(key));
    if(inFlight.has(key)) return inFlight.get(key);
    const operation=(async()=>{
      const loaded=await loadDashboardSources({read:reader(c),projectId,fileId,indexTable:c.indexTable,alertsTable:c.alertsTable,dateFrom,dateTo});
      const view=buildDashboard({...loaded,now:clock().toISOString(),asOf:day,dateFrom,dateTo});
      const entry={view,token:randomBytes(24).toString('hex'),actor,connection:c.identity,expires:clock().getTime()+TTL};
      cache.set(key,entry); sweep(); return publicView(entry);
    })();
    inFlight.set(key,operation);
    try { return await operation; } finally { inFlight.delete(key); }
  }
  function items(config,actor,token,key) {
    const {entry}=context(config,actor,token);
    if(key?.startsWith('domain:')) return rankItems(entry.view.items.filter(i=>i.domain===key.slice(7) && (i.needsAttention || (i.open && (['critical','high'].includes(i.severity)||i.isBlocking||i.overdueDays>0)))));
    if(key==='attention') return rankItems(entry.view.items.filter(i=>i.needsAttention || (i.open && (['critical','high'].includes(i.severity)||i.isBlocking||i.overdueDays>0))));
    const metric=entry.view.metrics.find(m=>m.key===key);
    if(!metric) throw new DashboardError('מדד לא נמצא',404);
    const ids=new Set(metric.memberIds); return entry.view.items.filter(i=>ids.has(i.id));
  }
  async function evidence(config,actor,token,id) {
    const {c,entry}=context(config,actor,token);
    const item=entry.view.items.find(i=>i.id===id);
    if(!item) throw new DashboardError('הפריט אינו שייך לתמונת הפרויקט',404);
    const projectId=entry.view.project.id;
    // Revalidate live ownership/lifecycle before returning any evidence after a source withdrawal.
    const lifecycleFields=['schedule','conflict'].includes(item.domain)?'id,project_id':'id,project_id,status,withdrawn,superseded';
    const current=await reader(c)(item.sourceTable,{select:lifecycleFields,project_id:`eq.${projectId}`,id:`eq.${item.sourceId}`,order:'id.asc'},{maxRows:1});
    if(!current.rows.length) throw new DashboardError('המקור אינו זמין עוד',404);
    if(!validRow(current.rows[0])) throw new DashboardError('המקור נמשך או הוחלף מאז החישוב. יש לרענן.',409,'source_withdrawn');
    const table=EVIDENCE_TABLES[item.domain];
    if(!table) return {item,sources:[],note:'פרטי המקור מוצגים ברשומה. ראיות נוספות זמינות במסך התחום.'};
    const result=await reader(c)(table,{select:'id,source_table,source_id,excerpt,source_date',project_id:`eq.${projectId}`,item_id:`eq.${item.sourceId}`,order:'id.asc'},{maxRows:12,recent:true});
    return {item,sources:result.rows.map(r=>({id:r.id,sourceTable:r.source_table,sourceId:String(r.source_id),excerpt:r.excerpt || '',date:r.source_date,url:safeSourceUrl(r.source_url)}))};
  }
  async function history(config,projectId) {
    const c=dashboardConnection(config); const read=reader(c);
    // Project existence is checked even when the snapshot schema is not yet installed.
    const available=await projects(config);
    if(!available.some(p=>p.id===projectId)) throw new DashboardError('פרויקט אינו זמין',404);
    try {
      const result=await read('dashboard_snapshots',{select:'id,as_of_date,captured_at,status,metrics,source_versions',tenant_key:`eq.${c.tenantKey}`,project_id:`eq.${projectId}`,order:'captured_at.desc,id.desc'},{maxRows:40,recent:true});
      return {available:true,snapshots:result.rows};
    } catch(e) { if(e.code==='source_404') return {available:false,snapshots:[],reason:'שמירת היסטוריה עדיין לא הופעלה בחיבור זה'}; throw e; }
  }
  async function saveSnapshot(config,actor,token,{runKind='manual'}={}) {
    const {c,entry}=context(config,actor,token);
    // Re-read sources; a stale browser token must never publish an old result as a new observation.
    const fresh=await overview(config,actor,{projectId:entry.view.project.id,fileId:entry.view.schedule.fileId,dateFrom:entry.view.dateRange.from,dateTo:entry.view.dateRange.to,force:true});
    const {entry:latest}=context(config,actor,fresh.queryToken);
    const payload=snapshotPayload(latest.view);
    const fingerprint=createHash('sha256').update(JSON.stringify({day:payload.asOf,version:METRIC_VERSION,members:payload.members,
      metrics:payload.metrics.map(({computedAt,...m})=>m),versions:payload.sourceVersions})).digest('hex');
    const res=await fetchImpl(`${c.url}/rest/v1/rpc/dashboard_publish_snapshot_v1`,{method:'POST',
      headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_tenant_key:c.tenantKey,p_project_id:latest.view.project.id,p_as_of:payload.asOf,p_fingerprint:fingerprint,p_payload:payload,p_actor:actor,p_run_kind:runKind}),
      signal:AbortSignal.timeout(20000)});
    if(!res.ok) throw new DashboardError(res.status===404?'טבלאות ההיסטוריה טרם הותקנו':'שמירת תמונת המצב נכשלה; נתוני המקור לא שונו',503,'snapshot_failed');
    return {saved:await res.json(),overview:fresh};
  }
  async function snapshotItems(config,projectId,snapshotId,metricKey) {
    const c=dashboardConnection(config); const available=await projects(config);
    if(!available.some(p=>p.id===projectId)) throw new DashboardError('פרויקט אינו זמין',404);
    const result=await reader(c)('dashboard_snapshot_items',{select:'metric_key,member_key,source_table,source_id,native_status,severity,contribution',tenant_key:`eq.${c.tenantKey}`,project_id:`eq.${projectId}`,snapshot_id:`eq.${snapshotId}`,metric_key:`eq.${metricKey}`,order:'id.asc'});
    return result;
  }
  async function chatContext(config,actor,token,itemId,includeBrief=false) {
    const {entry}=context(config,actor,token);
    const item=itemId ? (await evidence(config,actor,token,itemId)).item : null;
    return { projectId:entry.view.project.id, projectName:entry.view.project.name, asOf:entry.view.asOf,dateRange:entry.view.dateRange,
      item:item ? {title:item.title,sourceTable:item.sourceTable,sourceId:item.sourceId,status:item.status,sourceDate:item.sourceDate} : null,
      ...(includeBrief?{insightBrief:buildInsightBrief(entry.view)}:{}) };
  }
  return {projects,overview,items,evidence,history,saveSnapshot,snapshotItems,chatContext};
}
export const dashboardService=createDashboardService();
