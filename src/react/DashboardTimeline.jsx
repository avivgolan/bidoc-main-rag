import DashboardEventDialog from './DashboardEventDialog.jsx';
import React,{useState,useRef,useLayoutEffect,useMemo,useId} from 'react';
const stamp=d=>d?Date.parse(d):NaN;
const cellDate=d=>new Date(d).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'});
const fmt=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'2-digit'});
export default function DashboardTimeline({view,target,compact=false}) {
  const [expanded,setExpanded]=useState(false);
  const [jump,setJump]=useState(null),[jumpNote,setJumpNote]=useState('');
  const panelRef=useRef(null),tooltipRef=useRef(null),tooltipId=useId();
  const [tooltip,setTooltip]=useState(null);
  function hideTooltip(){tooltipRef.current?.hidePopover();setTooltip(null);}
  function preview(event,node){const box=node.getBoundingClientRect();setTooltip({title:event.title,x:box.left+box.width/2,y:box.top,bottom:box.bottom});}
  useLayoutEffect(()=>{const node=tooltipRef.current;if(!tooltip||!node)return;node.showPopover();const box=node.getBoundingClientRect();node.style.left=Math.max(8,Math.min(innerWidth-box.width-8,tooltip.x-box.width/2))+'px';node.style.top=(tooltip.y-box.height-10>=8?tooltip.y-box.height-10:Math.min(innerHeight-box.height-8,tooltip.bottom+10))+'px';},[tooltip]);
  function dotProps(event){return {onMouseEnter:e=>preview(event,e.currentTarget),onMouseLeave:hideTooltip,onFocus:e=>preview(event,e.currentTarget),onBlur:hideTooltip,'aria-describedby':tooltip?.title===event.title?tooltipId:undefined,onClick:()=>{hideTooltip();setSelected(event);}};}
  const [visible,setVisible]=useState({first:0,last:4});
  const scrollRef=useRef(null);
  const [scope,setScope]=useState('plan'),[selected,setSelected]=useState(null),[activity,setActivity]=useState(null);
  const tasks=useMemo(()=>[...view.schedule.timeline].filter(t=>Number.isFinite(stamp(t.start))&&Number.isFinite(stamp(t.end))).sort((a,b)=>stamp(a.start)-stamp(b.start)),[view.schedule.timeline]);
  function measureVisible(){
    const node=scrollRef.current;if(!node||!tasks.length)return;
    const height=node.firstElementChild?.getBoundingClientRect().height || (compact?20:29);
    const first=Math.min(tasks.length-1,Math.floor((node.scrollTop+.01)/height));
    const last=Math.min(tasks.length-1,Math.max(first,Math.ceil((node.scrollTop+node.clientHeight-.01)/height)-1));
    setVisible(previous=>previous.first===first&&previous.last===last?previous:{first,last});
  }
  useLayoutEffect(()=>{const node=scrollRef.current;if(!node)return;measureVisible();const observer=new ResizeObserver(measureVisible);observer.observe(node);if(node.firstElementChild)observer.observe(node.firstElementChild);return()=>observer.disconnect();},[tasks,compact]);
  const events=(view.timeline?.events || []).filter(e=>Number.isFinite(stamp(e.date)));
  useLayoutEffect(()=>{
    if(!target||target.projectId!==view.project.id)return;
    const item=target.item,normalize=v=>String(v||'').trim();
    const linked=events.filter(e=>target.sources.some(source=>source.sourceTable==='alerts'&&String(source.sourceId)===e.id));
    const exact=events.filter(e=>normalize(e.title)===normalize(item.title)||normalize(e.title)===normalize(item.summary));
    const event=linked.find(e=>tasks.some(t=>t.activityKey===e.activityKey))||linked[0]||(exact.length===1?exact[0]:null);
    const key=event?.activityKey||item.activityKey,index=tasks.findIndex(t=>key&&t.activityKey===key);
    setActivity(index>=0?key:null);setSelected(null);setJump(event||null);setScope(index>=0?'plan':'all');
    setJumpNote(index>=0?'':event?'לעדכון אין פעילות זמינה בגרסת הלוח הזאת; הנקודה מוצגת בציר האירועים.':'לא נמצא לעדכון קישור לפעילות או נקודה מזוהה בציר הזמן.');
    if(index>=0&&scrollRef.current){const row=scrollRef.current.children[index];scrollRef.current.scrollTop=index*(row?.getBoundingClientRect().height||20);measureVisible();row?.querySelector('button')?.focus({preventScroll:true});}
    panelRef.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  },[target,view.project.id,view.schedule.fileId]);
  const taskDates=tasks.flatMap(t=>[stamp(t.start),stamp(t.end)]);
  const dates=scope==='all'||!taskDates.length?[...taskDates,...events.map(e=>stamp(e.date))]:taskDates;
  const first=tasks[Math.min(visible.first,tasks.length-1)],last=tasks[Math.min(visible.last,tasks.length-1)];
  const follow=scope==='plan'&&first&&last;
  const baseMin=follow?stamp(first.start):dates.length?Math.min(...dates):Date.now();
  const baseMax=follow?Math.max(baseMin,stamp(last.end)):dates.length?Math.max(...dates):baseMin+86400000;
  const min=jump?Math.min(baseMin,stamp(jump.date)):baseMin,max=jump?Math.max(baseMax,stamp(jump.date)):baseMax;
  const span=Math.max(1,max-min),pos=d=>Math.max(0,Math.min(100,(stamp(d)-min)/span*100));
  const visibleEvents=events.filter(e=>stamp(e.date)>=min&&stamp(e.date)<=max&&(!activity||e.activityKey===activity));
  const rows=tasks;
  return <section className={`db-panel db-unified-timeline ${compact?'is-compact':''} ${expanded?'is-expanded':''}`} id="db-planning" ref={panelRef} onWheelCapture={hideTooltip} onTouchMove={hideTooltip}>
    <header><div><h2>לו״ז וציר אירועים</h2><small>תכנון הפעילויות לצד התראות ציר הזמן</small></div><div className="db-timeline-switch"><button aria-pressed={scope==='plan'} onClick={()=>setScope('plan')}>לפי פעילויות</button><button aria-pressed={scope==='all'} onClick={()=>setScope('all')}>כל התקופה</button></div></header>
    {jumpNote&&<p className="db-timeline-warning" role="status">{jumpNote}</p>}
    <div className="db-timeline-content"><div className="db-gantt-mini">
      <div className="db-gantt-axis" data-range-start={new Date(min).toISOString()} data-range-end={new Date(max).toISOString()}><span>פעילות מתוכננת</span><span>תאריך התחלה</span><span>תאריך סיום</span><div>{[0,.25,.5,.75,1].map(f=><time key={f}>{fmt(min+span*f)}</time>)}</div></div>
      <div className="db-gantt-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="רשימת פעילויות נגללת" onScroll={()=>{measureVisible();setScope('plan');}}>
      {rows.map(t=><div className={`db-gantt-row ${activity===t.activityKey?'selected':''}`} key={t.id}><button title={t.title} onClick={()=>setActivity(activity===t.activityKey?null:t.activityKey)}>{t.title}</button><time className="db-task-date" dateTime={t.start}>{cellDate(t.start)}</time><time className="db-task-date" dateTime={t.end}>{cellDate(t.end)}</time><div className="db-gantt-track"><button className={t.milestone?'db-gantt-diamond':'db-gantt-bar'} style={{left:`${pos(t.start)}%`,width:t.milestone?10:`${Math.max(1,pos(t.end)-pos(t.start))}%`}} title={`${t.title} · ${fmt(stamp(t.start))} — ${fmt(stamp(t.end))}`} aria-label={`פעילות: ${t.title}`} onClick={()=>{setSelected({title:t.title,date:t.start,end:t.end,type:'תכנון בלוח',reportedPercent:t.reportedPercent});setActivity(t.activityKey);}}/>{visibleEvents.filter(e=>e.activityKey===t.activityKey).sort((a,b)=>Number(b.id===jump?.id)-Number(a.id===jump?.id)).slice(0,25).map(e=><button className={`db-event-dot ${jump?.id===e.id?'is-target':''}`} key={e.id} style={{left:`${pos(e.date)}%`}} {...dotProps(e)} aria-label={`התראה: ${e.title}`} />)}</div></div>)}
      </div>
      {!tasks.length&&<p className="db-quiet">אין פעילויות עם תאריכים להצגת גאנט.</p>}
      <div className="db-gantt-row db-event-track"><span>התראות בתקופה ({visibleEvents.length})</span><div className="db-gantt-track">{[...visibleEvents].sort((a,b)=>Number(b.id===jump?.id)-Number(a.id===jump?.id)).slice(0,80).map(e=><button className={`db-event-dot ${jump?.id===e.id?'is-target':''}`} key={e.id} style={{left:`${pos(e.date)}%`}} {...dotProps(e)} aria-label={`אירוע בציר: ${e.title}`} />)}</div></div>
      <div className="db-gantt-legend"><span><i/>תכנון</span><span><i/>התראה</span><span>תאריכים משמאל לימין</span><span>{tasks.length?`${visible.first+1}–${Math.min(visible.last+1,tasks.length)} / ${tasks.length}`:'0'}</span><span>גלול ברשימה לשינוי הטווח</span></div>
    </div><div className="db-timeline-feed"><div className="db-feed-heading"><strong>{activity?'התראות לפעילות':'התראות ציר הזמן'}</strong>{activity&&<button onClick={()=>setActivity(null)}>נקה סינון ×</button>}<span>{visibleEvents.length}</span></div>
      {!view.timeline?.complete&&<p className="db-timeline-warning">טעינת ההתראות חלקית או לא זמינה.</p>}
      {!view.timeline?.linksComplete&&<p className="db-timeline-warning">שיוכים לפעילויות אינם זמינים.</p>}
      {visibleEvents.slice(0,30).map(e=><button key={e.id} className="db-feed-event" onClick={()=>setSelected(e)}><i/><span><strong>{e.title}</strong><small>{fmt(stamp(e.date))} · {e.type || 'התראה'} · {e.activityKey?'משויכת לפעילות':'ללא שיוך לפעילות'}</small></span></button>)}
      {!visibleEvents.length&&<p className="db-quiet">אין התראות בטווח או בסינון זה. ניתן לעבור לכל התקופה.</p>}
    </div></div>
    <div ref={tooltipRef} id={tooltipId} popover="manual" role="tooltip" className="db-event-tooltip">{tooltip?.title}</div>
    {selected&&<DashboardEventDialog event={selected} onClose={()=>setSelected(null)}/>}
    <button className="db-event-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?'סגור רשימת התראות':'הצג התראות בציר'} · {events.length}</button>
    <footer>{events.length} התראות בעלות תאריך במקור · {visibleEvents.length} בטווח ובסינון · עד 80 סמנים ו־30 פריטים מוצגים. שיוך לפעילות מוצג רק כשנשמר במקור.</footer>
  </section>;
}
