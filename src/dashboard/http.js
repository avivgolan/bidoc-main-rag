import { getSuperadminSession } from '../auth.js';
import { DashboardError } from './sources.js';
import { dashboardService } from './service.js';

export function authorizeDashboard(req) {
  if(!getSuperadminSession(req)) throw new DashboardError('התחברות כסופראדמין נדרשת',401,'unauthorized');
  if(Object.keys(req.headers || {}).some(k=>k.startsWith('x-content-') || ['x-project-id','x-index-table','x-alerts-table'].includes(k))) {
    throw new DashboardError('הדשבורד משתמש בחיבור השרת בלבד',400,'connection_override_rejected');
  }
  if(req.method!=='GET') {
    if(req.headers['sec-fetch-site']==='cross-site') throw new DashboardError('מקור הבקשה אינו מורשה',403,'cross_origin');
    if(req.headers.origin) {
      let origin; try {origin=new URL(req.headers.origin);} catch {throw new DashboardError('מקור בקשה לא תקף',403);}
      if(origin.host!==req.headers.host) throw new DashboardError('מקור הבקשה אינו מורשה',403,'cross_origin');
    }
  }
  return getSuperadminSession(req).sub;
}
export async function handleDashboardApi(req,res,url,{config,readJson,sendJson,service=dashboardService}) {
  res.setHeader('Cache-Control','no-store');
  try {
    const actor=authorizeDashboard(req); const query=url.searchParams;
    const path=url.pathname.replace('/api/dashboard/v1','');
    if(req.method==='GET') {
      if(path==='/projects') return sendJson(res,200,{projects:await service.projects(config)});
      if(path==='/overview') return sendJson(res,200,await service.overview(config,actor,{projectId:query.get('project_id'),fileId:query.get('file_id'),dateFrom:query.get('date_from'),dateTo:query.get('date_to')}));
      if(path==='/items') return sendJson(res,200,{items:service.items(config,actor,query.get('token'),query.get('metric'))});
      if(path==='/evidence') return sendJson(res,200,await service.evidence(config,actor,query.get('token'),query.get('id')));
      if(path==='/history') return sendJson(res,200,await service.history(config,query.get('project_id')));
      if(path==='/snapshot-items') return sendJson(res,200,await service.snapshotItems(config,query.get('project_id'),query.get('snapshot_id'),query.get('metric')));
    }
    if(req.method==='POST' && ['/refresh','/snapshots'].includes(path)) {
      const body=await readJson(req);
      if(Object.keys(body).some(k=>!['project_id','file_id','token','date_from','date_to'].includes(k))) throw new DashboardError('שדות בקשה לא מוכרים',400);
      if(path==='/refresh') return sendJson(res,200,await service.overview(config,actor,{projectId:body.project_id,fileId:body.file_id,dateFrom:body.date_from,dateTo:body.date_to,force:true}));
      return sendJson(res,200,await service.saveSnapshot(config,actor,body.token));
    }
    return sendJson(res,404,{error:'הנתיב לא נמצא'});
  } catch(error) {
    return sendJson(res,error.status || 500,{error:error instanceof DashboardError?error.message:'לא ניתן לטעון את הדשבורד',code:error.code || 'dashboard_error'});
  }
}
