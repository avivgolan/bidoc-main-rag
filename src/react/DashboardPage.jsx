import DashboardNotifications,{useDashboardNotifications} from './DashboardNotifications.jsx';
import DashboardOverview from './DashboardOverview.jsx';
import DashboardAiDialog from './DashboardAiDialog.jsx';
import React, { useEffect, useRef, useState } from 'react';

const DATE = new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'short',year:'numeric'});
const fmt=value=>{if(!value)return 'לא דווח';const d=new Date(value);return Number.isNaN(d.getTime())?'לא דווח':DATE.format(d);};
const number=value=>value==null?'—':new Intl.NumberFormat('he-IL').format(value);
const domains={intelligence:'החלטות',approval:'אישורים',question:'שאלות פתוחות',delay:'עיכובים',safety:'בטיחות',quality:'איכות',commercial:'מסחרי',progress:'ביצוע',conflict:'חוזים',schedule:'לו״ז'};
const statuses={critical:'קריטי',high:'גבוה',medium:'בינוני',low:'נמוך',unknown:'טרם סווג',ready:'זמין',partial:'חלקי',stale:'לא עדכני',unavailable:'חסר מידע',empty:'אין פריטים',error:'לא זמין'};
async function api(path,{signal,body}={}) {
  const r=await fetch(`/api/dashboard/v1${path}`,{signal,cache:'no-store',method:body?'POST':'GET',
    headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const json=await r.json(); if(!r.ok)throw Object.assign(new Error(json.error || 'לא ניתן לטעון את המידע'),{code:json.code,status:r.status}); return json;
}
function Icon({name,size=20}) {
  const paths={grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    arrow:<><path d="M19 12H5m6-6-6 6 6 6"/></>,refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,alert:<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
    document:<><path d="M14 2H5v20h14V7l-5-5Z"/><path d="M14 2v6h5M8 13h8M8 17h5"/></>,check:<><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/></>,
    spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,
    chart:<><path d="M3 3v18h18M6 16l5-5 4 2 6-8"/></>,save:<><path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8"/></>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}
function Empty({children}) {return <div className="db-empty"><Icon name="document"/><p>{children}</p></div>;}
function ItemCard({item,onEvidence,onAsk,compact=false}) {
  return <article className={`db-attention-item ${compact?'is-compact':''}`}>
    <div className={`db-severity-mark is-${item.open?item.severity:'unknown'}`}/>
    <div className="db-item-body">
      <div className="db-item-meta"><span>{domains[item.domain] || item.domain}</span><span>•</span><span>{fmt(item.sourceDate)}</span>
        <span className={`db-badge is-${item.open?item.severity:'unknown'}`}>{item.closed?'בדיקה לאחר סגירה':statuses[item.severity] || 'לבדיקה'}</span></div>
      <h3>{item.title}</h3>
      {!compact&&<p className="db-item-summary">{item.summary || 'פרטים נוספים זמינים ברשומת המקור.'}</p>}
      <div className="db-item-reasons">{item.reasons?.slice(0,2).map(r=><span key={r}>{r}</span>)}{item.owner&&<span>אחראי: {item.owner}</span>}</div>
      <div className="db-item-actions"><button type="button" onClick={()=>onEvidence(item)}><Icon name="document" size={15}/>פרטים ומקורות</button><button type="button" onClick={()=>onAsk(item)}><Icon name="spark" size={15}/>שאל את BIDoc</button></div>
    </div>
  </article>;
}
function Details({detail,view,onClose,onAsk,onExpired}) {
  const dialog=useRef(null); const [data,setData]=useState(null);const [error,setError]=useState('');
  const recovery=useRef(null);
  useEffect(()=>{dialog.current?.showModal();return ()=>dialog.current?.close();},[]);
  useEffect(()=>{
    setData(null);setError('');const controller=new AbortController();
    let path;
    if(detail.type==='item')path=`/evidence?token=${view.queryToken}&id=${encodeURIComponent(detail.item.id)}`;
    if(detail.type==='metric')path=`/items?token=${view.queryToken}&metric=${encodeURIComponent(detail.metric.key)}`;
    if(detail.type==='historyItems')path=`/snapshot-items?project_id=${view.project.id}&snapshot_id=${detail.snapshot.id}&metric=${detail.metric.key}`;
    if(path)api(path,{signal:controller.signal}).then(setData).catch(async e=>{
      if(controller.signal.aborted)return;
      if(e.code==='context_expired'&&recovery.current!==detail){
        recovery.current=detail;
        try{await onExpired();}catch(refreshError){if(!controller.signal.aborted)setError(refreshError.message);}
      }else if(e.name!=='AbortError')setError(e.message);
    });
    else setData({});
    return ()=>controller.abort();
  },[detail,view.queryToken]);
  const title=detail.type==='item'?detail.item.title:detail.type==='metric'?detail.metric.label:detail.type==='health'?'עדכניות וכיסוי המידע':detail.type==='schedule'?'לוח הזמנים — קריאה בלבד':detail.type==='historyItems'?`${detail.metric.label} · ${fmt(detail.snapshot.as_of_date)}`:'תמונות מצב שמורות';
  return <dialog ref={dialog} className="db-dialog" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <header><div><span className="db-eyebrow">BIDOC / PROJECT INTELLIGENCE</span><h2>{title}</h2></div><button type="button" aria-label="סגור פרטים" onClick={onClose}><Icon name="close"/></button></header>
    <div className="db-dialog-body">
      {error&&<div role="alert" className="db-error">{error}</div>}
      {!data&&!error&&<p role="status">טוען פרטים…</p>}
      {detail.type==='metric'&&<><p className="db-explanation">{detail.metric.note}</p>{data?.items?.length===0&&<Empty>אין פריטים במדד זה. מידע חסר מפורט בכיסוי המקורות.</Empty>}{data?.items?.map(i=><article key={i.id} className="db-detail-row"><strong>{i.title}</strong><p>{i.summary}</p><small>{domains[i.domain]} · {fmt(i.sourceDate)} · {i.closed?'סגור במקור':'מצב: '+i.status}</small><button type="button" onClick={()=>onAsk(i)}>שאל את BIDoc על הפריט <Icon name="arrow" size={14}/></button></article>)}</>}
      {detail.type==='item'&&data&&<><p className="db-explanation">{data.item.summary}</p><dl className="db-fact-grid"><div><dt>מצב במקור</dt><dd>{data.item.status}</dd></div><div><dt>מועד יעד</dt><dd>{fmt(data.item.dueDate)}</dd></div><div><dt>אחראי</dt><dd>{data.item.owner || 'לא זוהה'}</dd></div><div><dt>עודכן במקור</dt><dd>{fmt(data.item.updatedAt)}</dd></div></dl><h3>הראיות שמאחורי הנושא</h3>{!data.sources?.length&&<Empty>{data.note || 'לא נמצאו מקורות מקושרים לפריט זה. אין בכך אימות של המסקנה.'}</Empty>}{data.sources?.map(s=><article className="db-evidence" key={s.id}><small>{s.sourceTable} · {fmt(s.date)}</small><blockquote>{s.excerpt || 'אין ציטוט שמור'}</blockquote><bdi>מזהה מקור: {s.sourceId}</bdi>{s.url&&<a href={s.url} target="_blank" rel="noreferrer">פתח מקור</a>}</article>)}<button type="button" className="db-primary" onClick={()=>onAsk(data.item)}><Icon name="spark"/>שאל את BIDoc</button></>}
      {detail.type==='health'&&<><p className="db-explanation">מועד חישוב אינו מועד עדכון של המידע. הטבלאות הקיימות משמשות לקריאה בלבד.</p>{view.sourceHealth.map(s=><div className="db-health-row" key={s.key}><div><strong>{s.label}</strong><small>{s.reason || `עדכון רשומה אחרון: ${fmt(s.sourceUpdatedAt)}`}</small></div><span>{number(s.count)} רשומות</span><span className={`db-badge is-${s.status}`}>{statuses[s.status] || s.status}</span></div>)}</>}
      {detail.type==='schedule'&&<><p className="db-explanation">{view.schedule.title} · התאריכים להלן הם תכנון, לא ראיות ביצוע. בסיס מאושר ותחזית פרויקט טרם הוגדרו.</p>{view.schedule.timeline.map(t=><div className="db-detail-row" key={t.id}><strong>{t.title}</strong><p>{fmt(t.start)} — {fmt(t.end)}</p></div>)}<p className="db-footnote">פעילויות בגרסה הנבחרת; {number(view.schedule.taskCount)} פעילויות בלוח המקור.</p></>}
      {detail.type==='historyItems'&&<><p className="db-explanation">הפריטים שנכללו בזמן השמירה. מצבי המקור כיום עשויים להיות שונים.</p>{data?.rows?.map(r=><div className="db-detail-row" key={r.member_key}><bdi>{r.source_table} / {r.source_id}</bdi><p>מצב בזמן השמירה: {r.native_status}</p></div>)}{data?.rows?.length===0&&<Empty>אין פריטים שמורים למדד זה.</Empty>}</>}
    </div>
  </dialog>;
}

export function DashboardPage() {
  const [active,setActive]=useState(location.hash==='#dashboard');const [projects,setProjects]=useState([]);
  const [dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState('');
  const [range,setRange]=useState({from:'',to:''});
  const [projectId,setProjectId]=useState('');const [fileId,setFileId]=useState('');
  const [view,setView]=useState(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [detail,setDetail]=useState(null);const [history,setHistory]=useState(null);const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);const [days,setDays]=useState(7);const [question,setQuestion]=useState('');
  const generation=useRef(0);
  const automaticRefresh=useRef(null);
  const [aiJob,setAiJob]=useState(null),[aiOpen,setAiOpen]=useState(false);
  const notifications=useDashboardNotifications();
  useEffect(()=>{if(aiOpen&&notifications.toast?.job===aiJob)notifications.read(aiJob);},[aiOpen,aiJob,notifications.toast]);
  function openAi(job){notifications.read(job);setAiJob(job);setAiOpen(true);}
  function startAi(job){notifications.track(job);setAiJob(job);setAiOpen(true);}
  const [section,setSection]=useState('overview');
  const [scheduleTarget,setScheduleTarget]=useState(null);
  const scheduleRequest=useRef(0);
  const [projectsLoading,setProjectsLoading]=useState(true);
  useEffect(()=>{
    const panel=document.getElementById('dashboard');const observer=new MutationObserver(()=>setActive(panel.classList.contains('active')));
    if(panel)observer.observe(panel,{attributes:true,attributeFilter:['class']});return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!active || projects.length)return;const controller=new AbortController();
    api('/projects',{signal:controller.signal}).then(r=>{
      setProjects(r.projects);let saved;try{saved=localStorage.getItem('bidoc-dashboard-project');}catch{}
      setProjectId(r.projects.find(p=>p.id===saved)?.id || r.projects[0]?.id || '');
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setProjectsLoading(false);});return ()=>controller.abort();
  },[active,projects.length]);
  useEffect(()=>{
    if(!active||!projectId)return;const controller=new AbortController();const current=++generation.current;
    setView(null);setDetail(null);setError('');setLoading(true);setNotice('');setHistory(null);
    api(`/overview?project_id=${projectId}${fileId?'&file_id='+encodeURIComponent(fileId):''}&date_from=${range.from}&date_to=${range.to}`,{signal:controller.signal})
      .then(r=>{if(current===generation.current)setView(r);}).catch(e=>{if(e.name!=='AbortError'&&current===generation.current)setError(e.message);})
      .finally(()=>{if(current===generation.current)setLoading(false);});
    api(`/history?project_id=${projectId}`,{signal:controller.signal}).then(r=>{if(current===generation.current)setHistory(r);}).catch(()=>{});
    return ()=>{controller.abort();generation.current++;};
  },[active,projectId,fileId,range]);
  async function refresh() {
    const current=generation.current;setLoading(true);setError('');
    try{const r=await api('/refresh',{body:{project_id:projectId,file_id:fileId || null,date_from:range.from,date_to:range.to}});if(current===generation.current){setView(r);setNotice('הנתונים נרעננו. מקורות הפרויקט לא שונו.');}}
    catch(e){if(current===generation.current)setError(e.message);}finally{if(current===generation.current)setLoading(false);}
  }
  function refreshExpired() {
    const current=generation.current;
    if(automaticRefresh.current?.generation===current)return automaticRefresh.current.promise;
    const job={generation:current};
    job.promise=api('/refresh',{body:{project_id:projectId,file_id:fileId || null,date_from:range.from,date_to:range.to}}).then(r=>{
      if(current!==generation.current)throw new DOMException('Aborted','AbortError');
      setView(r);return r;
    }).finally(()=>{if(automaticRefresh.current===job)automaticRefresh.current=null;});
    automaticRefresh.current=job;return job.promise;
  }
  async function save() {
    const current=generation.current;setSaving(true);setError('');
    try {const r=await api('/snapshots',{body:{token:view.queryToken}});if(current!==generation.current)return;setView(r.overview);setNotice(r.saved.reused?'תמונת מצב זהה כבר שמורה.':'תמונת המצב נשמרה.');const h=await api(`/history?project_id=${projectId}`);if(current===generation.current)setHistory(h);}
    catch(e){if(current===generation.current)setError(e.message);}finally{setSaving(false);}
  }
  async function openSchedule(item) {
    const request=++scheduleRequest.current,current=generation.current;
    const show=sources=>{if(request===scheduleRequest.current&&current===generation.current)setScheduleTarget({item,sources,request,projectId:view.project.id});};
    if(item.activityKey){show([]);return;}
    try{
      let result;
      try{result=await api('/evidence?token='+encodeURIComponent(view.queryToken)+'&id='+encodeURIComponent(item.id));}
      catch(e){if(e.code!=='context_expired')throw e;const fresh=await refreshExpired();result=await api('/evidence?token='+encodeURIComponent(fresh.queryToken)+'&id='+encodeURIComponent(item.id));}
      show(result.sources || []);
    }catch{show([]);}
  }
  function ask(item,text) {
    setDetail(null);
    if(window.__bidocRunDashboardChat){
      const job=window.__bidocRunDashboardChat({projectId:view.project.id,projectName:view.project.name,fileId:fileId || null,dateFrom:range.from,dateTo:range.to,token:view.queryToken,itemId:item?.id || null,
        question:text || `מה המצב של ״${item.title}״, על מה הוא מבוסס ומה נדרש לעשות?`});
      if(job.settled)openAi(job);else startAi(job);
    }
    else setError('הצ׳אט עדיין נטען. נסה שוב בעוד רגע.');
  }
  const schedule=view?.schedule;
  const activity=view?.activity.filter(i=>Date.parse(i.updatedAt)>=Date.now()-days*86400000) || [];
  const metrics=view?.metrics.slice(0,4) || [];
  const partial=view?.sourceHealth.filter(s=>!s.complete).length || 0;
  return <div className="db-page" dir="rtl">
    <div className="db-appbar"><a className="db-wordmark" href="#dashboard">BIDOC<span>PROJECT CONTROL</span></a><nav aria-label="ניווט סביבת הבקרה"><button aria-pressed={section==='overview'} onClick={()=>{setSection('overview');document.getElementById("dashboard")?.scrollTo({top:0,behavior:"smooth"});}}>סקירה</button><button aria-pressed={section==='planning'} onClick={()=>{setSection('planning');document.getElementById("db-planning")?.scrollIntoView({behavior:"smooth",block:"center"});}}>תכנון ואירועים</button><button aria-pressed={section==='work'} onClick={()=>{setSection('work');document.getElementById("db-worklist")?.scrollIntoView({behavior:"smooth",block:"center"});}}>נושאים לטיפול</button></nav></div>
    <header className="db-page-header"><div><span className="db-eyebrow">סביבת עבודה / ניהול פרויקט</span><h1>{view?.project.name || 'מרכז בקרה'}<span className="db-title-dot">.</span></h1><p>לוח בקרה ראשי</p></div><div className="db-project-picker"><label htmlFor="db-project">הפרויקט שלי</label><select id="db-project" value={projectId} onChange={e=>{setProjectId(e.target.value);setFileId('');setDateFrom('');setDateTo('');setRange({from:'',to:''});try{localStorage.setItem('bidoc-dashboard-project',e.target.value);}catch{}}}><option value="" disabled>בחר פרויקט</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div><DashboardNotifications entries={notifications.entries} toast={aiOpen&&notifications.toast?.job===aiJob?null:notifications.toast} onOpen={openAi} onDismiss={notifications.dismiss}/><button className="db-back" onClick={()=>window.__bidocActivateTab?.("chat")}>חזרה למערכת ↗</button></header>
    <form className="db-date-filter" onSubmit={e=>{e.preventDefault();if(dateFrom&&dateTo&&dateFrom>dateTo)return;setRange({from:dateFrom,to:dateTo});}}>
      <strong>טווח תאריכים</strong><label>מתאריך<input type="date" aria-label="מתאריך" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)}/></label><label>עד תאריך<input type="date" aria-label="עד תאריך" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)}/></label><button type="submit" disabled={loading}>החל טווח</button><button type="button" onClick={()=>{setDateFrom('');setDateTo('');setRange({from:'',to:''});}}>מאז תחילת הפרויקט</button>
      <small>{!range.from&&!range.to?'כל תקופת הפרויקט':`${range.from||'תחילת הפרויקט'} — ${range.to||'ללא הגבלת סיום'}`} · לפי תאריך המקור, ובאין תאריך — תאריך הרשומה. הלוח מציג פעילויות החופפות לטווח. המצבים הם המצבים הנוכחיים.</small>
      {view?.dateRange?.excludedUndated>0&&<small>{view.dateRange.excludedUndated} רשומות ללא תאריך אינן נכללות בטווח.</small>}
    </form>
    <div className="db-toolbar"><div className="db-time"><span className="db-live-dot"/><span>מצב נוכחי</span><span className="db-separator"/>נכון ל־{fmt(view?.asOf || new Date())}</div><div className="db-toolbar-actions"><button type="button" disabled={!view} onClick={()=>setDetail({type:'health'})}><Icon name="grid" size={15}/>{partial?`${partial} מקורות לא זמינים`:'מקורות ועדכניות'}</button><button type="button" disabled={!projectId||loading||saving} onClick={refresh}><Icon name="refresh" size={15}/>{loading?'מרענן…':'רענון'}</button><button type="button" disabled={!view||saving||loading||history?.available===false} onClick={save}><Icon name="save" size={15}/>{saving?'שומר…':'שמור תמונת מצב'}</button></div></div>
    {notice&&<div className="db-notice" role="status">{notice}</div>}{error&&<div className="db-error" role="alert">{error}<button type="button" onClick={refresh} disabled={!projectId||loading}>נסה שוב</button></div>}
    {aiJob&&!aiOpen&&<button className="db-ai-reopen" onClick={()=>{openAi(aiJob);}}>פתח ניתוח BIDOC AI האחרון</button>}
    {!view&&loading&&<div className="db-loading" role="status"><div className="db-skeleton"/><div className="db-skeleton"/><p>מחבר את תמונת הפרויקט מהמקורות…</p></div>}
    {!view&&!loading&&!error&&<Empty>{projectsLoading?'טוען את סביבת העבודה…':projects.length?'בחר פרויקט כדי להציג את הנתונים.':'לא נמצאו פרויקטים פעילים בחיבור.'}</Empty>}
    {view&&<DashboardOverview view={view} history={history} onDetail={setDetail} onAsk={ask} onSchedule={openSchedule} scheduleTarget={scheduleTarget} onInsightJob={notifications.track} onInsightOpen={openAi} pendingJobs={notifications.entries.filter(r=>r.status==='pending'&&r.job.context.projectId===view.project.id).map(r=>r.job)}/>}
    {view&&<div className="db-version-footer"><label htmlFor="db-version">גרסת לוח</label><select id="db-version" value={fileId || view.schedule.fileId || ''} onChange={e=>setFileId(e.target.value)}>{view.schedule.files.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
    {detail&&view&&<Details detail={detail} view={view} onClose={()=>setDetail(null)} onAsk={ask} onExpired={refreshExpired}/>}
    {aiOpen&&aiJob&&<DashboardAiDialog key={aiJob.sessionId} job={aiJob} onClose={()=>setAiOpen(false)} onRefresh={()=>startAi(window.__bidocRunDashboardChat(aiJob.context,{force:true}))}/>}
  </div>;
}
