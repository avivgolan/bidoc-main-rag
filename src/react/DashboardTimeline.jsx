import React,{useState,useRef,useLayoutEffect,useMemo} from 'react';
const stamp=d=>d?Date.parse(d):NaN;
const fmt=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'2-digit'});
export default function DashboardTimeline({view,compact=false}) {
  const [expanded,setExpanded]=useState(false);
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
  const taskDates=tasks.flatMap(t=>[stamp(t.start),stamp(t.end)]);
  const dates=scope==='all'||!taskDates.length?[...taskDates,...events.map(e=>stamp(e.date))]:taskDates;
  const first=tasks[Math.min(visible.first,tasks.length-1)],last=tasks[Math.min(visible.last,tasks.length-1)];
  const follow=scope==='plan'&&first&&last;
  const min=follow?stamp(first.start):dates.length?Math.min(...dates):Date.now();
  const max=follow?Math.max(min,stamp(last.end)):dates.length?Math.max(...dates):min+86400000;
  const span=Math.max(1,max-min),pos=d=>Math.max(0,Math.min(100,(stamp(d)-min)/span*100));
  const visibleEvents=events.filter(e=>stamp(e.date)>=min&&stamp(e.date)<=max&&(!activity||e.activityKey===activity));
  const rows=tasks;
  return <section className={`db-panel db-unified-timeline ${compact?'is-compact':''} ${expanded?'is-expanded':''}`} id="db-planning">
    <header><div><h2>לו״ז וציר אירועים</h2><small>תכנון הפעילויות לצד התראות ציר הזמן</small></div><div className="db-timeline-switch"><button aria-pressed={scope==='plan'} onClick={()=>setScope('plan')}>לפי פעילויות</button><button aria-pressed={scope==='all'} onClick={()=>setScope('all')}>כל התקופה</button></div></header>
    <div className="db-timeline-content"><div className="db-gantt-mini">
      <div className="db-gantt-axis" data-range-start={new Date(min).toISOString()} data-range-end={new Date(max).toISOString()}><span>פעילות מתוכננת</span><div>{[0,.25,.5,.75,1].map(f=><time key={f}>{fmt(min+span*f)}</time>)}</div></div>
      <div className="db-gantt-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="רשימת פעילויות נגללת" onScroll={()=>{measureVisible();setScope('plan');}}>
      {rows.map(t=><div className={`db-gantt-row ${activity===t.activityKey?'selected':''}`} key={t.id}><button title={t.title} onClick={()=>setActivity(activity===t.activityKey?null:t.activityKey)}>{t.title}</button><div className="db-gantt-track"><button className={t.milestone?'db-gantt-diamond':'db-gantt-bar'} style={{left:`${pos(t.start)}%`,width:t.milestone?10:`${Math.max(1,pos(t.end)-pos(t.start))}%`}} title={`${t.title} · ${fmt(stamp(t.start))} — ${fmt(stamp(t.end))}`} aria-label={`פעילות: ${t.title}`} onClick={()=>{setSelected({title:t.title,date:t.start,end:t.end,type:'תכנון בלוח',reportedPercent:t.reportedPercent});setActivity(t.activityKey);}}/>{visibleEvents.filter(e=>e.activityKey===t.activityKey).slice(0,25).map(e=><button className="db-event-dot" key={e.id} style={{left:`${pos(e.date)}%`}} title={e.title} aria-label={`התראה: ${e.title}`} onClick={()=>setSelected(e)}/>)}</div></div>)}
      </div>
      {!tasks.length&&<p className="db-quiet">אין פעילויות עם תאריכים להצגת גאנט.</p>}
      <div className="db-gantt-row db-event-track"><span>התראות בתקופה ({visibleEvents.length})</span><div className="db-gantt-track">{visibleEvents.slice(0,80).map(e=><button className="db-event-dot" key={e.id} style={{left:`${pos(e.date)}%`}} title={e.title} aria-label={`אירוע בציר: ${e.title}`} onClick={()=>setSelected(e)}/>)}</div></div>
      <div className="db-gantt-legend"><span><i/>תכנון</span><span><i/>התראה</span><span>תאריכים משמאל לימין</span><span>{tasks.length?`${visible.first+1}–${Math.min(visible.last+1,tasks.length)} / ${tasks.length}`:'0'}</span><span>גלול ברשימה לשינוי הטווח</span></div>
    </div><div className="db-timeline-feed"><div className="db-feed-heading"><strong>{activity?'התראות לפעילות':'התראות ציר הזמן'}</strong>{activity&&<button onClick={()=>setActivity(null)}>נקה סינון ×</button>}<span>{visibleEvents.length}</span></div>
      {!view.timeline?.complete&&<p className="db-timeline-warning">טעינת ההתראות חלקית או לא זמינה.</p>}
      {!view.timeline?.linksComplete&&<p className="db-timeline-warning">שיוכים לפעילויות אינם זמינים.</p>}
      {visibleEvents.slice(0,30).map(e=><button key={e.id} className="db-feed-event" onClick={()=>setSelected(e)}><i/><span><strong>{e.title}</strong><small>{fmt(stamp(e.date))} · {e.type || 'התראה'} · {e.activityKey?'משויכת לפעילות':'ללא שיוך לפעילות'}</small></span></button>)}
      {!visibleEvents.length&&<p className="db-quiet">אין התראות בטווח או בסינון זה. ניתן לעבור לכל התקופה.</p>}
    </div></div>
    {selected&&<div className="db-timeline-selection" role="region" aria-label="פרטי אירוע"><button aria-label="סגור אירוע" onClick={()=>setSelected(null)}>×</button><b>{selected.type || 'התראה'} · {fmt(stamp(selected.date))}{selected.end?` — ${fmt(stamp(selected.end))}`:''}</b><p>{selected.title}</p>{selected.reportedPercent!=null&&<small>אחוז מדווח בלוח: {selected.reportedPercent}% · אינו אימות ביצוע בשטח</small>}{selected.status&&<small>מצב במקור: {selected.status}</small>}{selected.url&&<a href={selected.url} target="_blank" rel="noreferrer">פתח מקור ↗</a>}</div>}
    <button className="db-event-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?'סגור רשימת התראות':'הצג התראות בציר'} · {events.length}</button>
    <footer>{events.length} התראות בעלות תאריך במקור · {visibleEvents.length} בטווח ובסינון · עד 80 סמנים ו־30 פריטים מוצגים. שיוך לפעילות מוצג רק כשנשמר במקור.</footer>
  </section>;
}
