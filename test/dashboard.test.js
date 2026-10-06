import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDashboard,normalizeItem,selectCohort,validRow,safeSourceUrl} from '../src/dashboard/model.js';
import {createSourceReader,SOURCES} from '../src/dashboard/sources.js';
import {createDashboardService} from '../src/dashboard/service.js';
import {authorizeDashboard} from '../src/dashboard/http.js';
import {buildSessionSetCookieHeader} from '../src/auth.js';

const id='11111111-1111-4111-8111-111111111111';
const config={supabaseUrl:'https://example.supabase.co',supabaseServiceRoleKey:'test-key',contentSource:{indexTable:'data_index'}};
export function fixture() {
  const datasets=Object.fromEntries(Object.entries(SOURCES).map(([k,[table]])=>[k,{table,rows:[],complete:true,status:'ready'}]));
  for(const k of ['files','tasks','documents'])datasets[k]={table:k,rows:[],complete:true,status:'ready'};
  datasets.approval.rows=[{id:'a',title:'אישור תכנון',status:'requested',is_blocking:true},{id:'b',status:'approved'},{id:'c',status:'requested',withdrawn:true}];
  datasets.intelligence.rows=[{id:'d',kind:'decision',status:'recorded',needs_attention:true,importance:'critical'}];
  return {project:{id,name:'פרויקט בדיקה'},datasets,schedule:{file:null,files:[],tasks:[]},now:'2026-10-04T12:00:00Z',asOf:'2026-10-04'};
}
test('counts exclude withdrawn and closed; recorded decisions retain attention without becoming critical open',()=>{
  const v=buildDashboard(fixture());assert.equal(v.metrics.find(m=>m.key==='approvals').value,1);assert.equal(v.metrics.find(m=>m.key==='critical').value,0);assert.equal(v.metrics.find(m=>m.key==='decisions').value,1);assert.equal(v.metrics[0].value,null);
  assert.equal(normalizeItem({id:1,status:'recorded',needs_attention:true},'intelligence','items','2026-10-04').open,false);
  assert.equal(validRow({superseded:true}),false);assert.equal(safeSourceUrl('javascript:alert(1)'),null);
});
test('partial sources yield unknown counts, not zero',()=>{
  const f=fixture();f.datasets.approval.complete=false;const m=buildDashboard(f).metrics.find(m=>m.key==='approvals');assert.equal(m.value,null);assert.equal(m.knownCount,1);
});
test('timeline preserves saved activity associations and rejects unsafe source links',()=>{
  const f=fixture();f.datasets.timelineAlerts={complete:true,rows:[{id:12,summary:'event',input_data_type:'whatsapp',input_data_id:'msg-12',analyzed_data:'מקור בדיקה',data_date:'2026-02-01',data_link:'javascript:alert(1)'},{id:13,summary:'unassigned',data_date:'2026-03-01'}]};
  f.datasets.timelineLinks={complete:true,rows:[{source_id:'12',activity_key:'gantt:a:1'}]};
  const v=buildDashboard(f);assert.equal(v.timeline.events[0].activityKey,'gantt:a:1');assert.equal(v.timeline.events[0].url,null);assert.equal(v.timeline.events[0].sourceType,'whatsapp');assert.equal(v.timeline.events[0].sourceId,'msg-12');assert.equal(v.timeline.events[0].sourceExcerpt,'מקור בדיקה');assert.equal(v.timeline.events[1].sourceType,null);assert.equal(v.timeline.events[1].activityKey,null);
  assert.equal(v.breakdown.reduce((sum,d)=>sum+d.attention,0),v.attentionTotal);
});
test('schedule cohort isolates version, engine and date and deduplicates subject',()=>{
  const base={activity_key:'gantt:a:1',data_version:'a#v1',engine_version:'schedule-engine.v1',as_of:'2026-10-01'};
  const c=selectCohort([{...base,id:1},{...base,id:2,as_of:'2026-10-03'},{...base,id:3,data_version:'b#v1'},{...base,id:4,as_of:'2026-10-05'}],'a','2026-10-04');assert.deepEqual(c.rows.map(r=>r.id),[2]);
});
test('reader follows server page caps and exposes GET only',async()=>{
  const rows=[{id:1},{id:2},{id:3}];const calls=[];
  const read=createSourceReader({url:config.supabaseUrl,key:'x'},async(url,opts)=>{calls.push(opts.method);const offset=Number(new URL(url).searchParams.get('offset'));return new Response(JSON.stringify(rows.slice(offset,offset+1)),{headers:{'content-range':`${offset}-${offset}/3`}});});
  const result=await read('items',{});assert.equal(result.rows.length,3);assert.equal(result.complete,true);assert.deepEqual(calls,['GET','GET','GET']);
});
test('context is bound to actor and connection; snapshot writes target only new RPC',async()=>{
  const calls=[];const fetchImpl=async(url,opts)=>{const u=new URL(url);calls.push({path:u.pathname,method:opts.method});if(opts.method==='POST')return Response.json({snapshotId:'new'});const rows=u.pathname.endsWith('/projects')?[{id,name:'test',is_active:true,settings:{}}]:[];return new Response(JSON.stringify(rows),{headers:{'content-range':`0-0/${rows.length}`}});};
  const s=createDashboardService({fetchImpl});const v=await s.overview(config,id,{projectId:id});assert.throws(()=>s.items(config,'other',v.queryToken,'approvals'),/פגה/);assert.throws(()=>s.items({...config,supabaseServiceRoleKey:'other'},id,v.queryToken,'approvals'),/פגה/);await s.saveSnapshot(config,id,v.queryToken);assert.deepEqual(calls.filter(c=>c.method!=='GET'),[{path:'/rest/v1/rpc/dashboard_publish_snapshot_v1',method:'POST'}]);
});
test('dashboard rejects anonymous, connection overrides and cross-site writes',()=>{
  process.env.MAIN_AGENT_SESSION_SECRET='dashboard-unit-test';
  assert.throws(()=>authorizeDashboard({method:'GET',headers:{}}),e=>e.status===401);
  const cookie=buildSessionSetCookieHeader({id}).split(';')[0];const headers={cookie,host:'localhost:4000'};
  assert.equal(authorizeDashboard({method:'GET',headers}),id);
  assert.throws(()=>authorizeDashboard({method:'GET',headers:{...headers,'x-project-id':id}}),e=>e.status===400);
  assert.throws(()=>authorizeDashboard({method:'POST',headers:{...headers,origin:'https://attacker.test'}}),e=>e.status===403);
});

test('safety counts only active records and reports missing coverage',()=>{
 const f=fixture();f.datasets.safety.rows=[{id:'open',status:'open'},{id:'work',status:'in_progress'},{id:'watch',status:'monitoring'},{id:'done',status:'resolved'},{id:'mitigated',status:'mitigated'},{id:'removed',status:'open',withdrawn:true},{id:'old',status:'open',superseded:true}];
 const metric=buildDashboard(f).metrics.find(m=>m.key==='safety');
 assert.equal(metric.value,3);assert.deepEqual(metric.memberIds,['open','work','watch'].map(id=>'project_safety_items:'+id));
 f.datasets.safety.complete=false;const partial=buildDashboard(f).metrics.find(m=>m.key==='safety');assert.equal(partial.value,null);assert.equal(partial.knownCount,3);
});
