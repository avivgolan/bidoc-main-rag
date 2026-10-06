import React,{useEffect,useRef} from 'react';
const date=value=>new Date(value).toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
const sourceLabel=value=>({email:'מייל',emails:'מייל',mail:'מייל',whatsapp_analysis:'WhatsApp',email_analysis:'מייל',whatsapp:'WhatsApp',whatsapp_message:'WhatsApp',whatsapp_messages:'WhatsApp',document:'מסמך',documents:'מסמך',file:'מסמך',attachment:'קובץ מצורף',meeting:'ישיבה',meetings:'ישיבה','attachment/meeting_summary':'מסמך סיכום ישיבה','attachment/safety_report':'מסמך דוח בטיחות','attachment/exception_report':'מסמך דוח חריגים'}[String(value||'').toLowerCase()]||value||'לא צוין במקור');
function EventIcon({kind}){
 const paths={chat:'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0ZM7 10h10M7 14h6',mail:'M3 5h18v14H3ZM3 5l9 8 9-8',document:'M6 2h8l4 4v16H6ZM14 2v5h4M9 12h6M9 16h6',calendar:'M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18',alert:'M12 3 2 21h20ZM12 9v5M12 17v1'};
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]||paths.document}/></svg>;
}
export default function DashboardEventDialog({event,onClose}){
 const ref=useRef(null);
 const source=sourceLabel(event.sourceType),kind=source==='WhatsApp'?'chat':source==='מייל'?'mail':'document';
 useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
 return <dialog ref={ref} className="db-event-dialog" aria-label="פרטי אירוע" dir="rtl" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
  <header><span className="db-event-heading"><span className="db-event-heading-icon"><EventIcon kind={event.end?'calendar':'alert'}/></span><span><strong>{event.end?'פרטי פעילות':'פרטי התראה'}</strong><small>{event.type||'אירוע בציר הזמן'}</small></span></span><button type="button" aria-label="סגור אירוע" onClick={onClose}>×</button></header>
  <div className="db-event-dialog-body"><div className="db-event-meta"><time><EventIcon kind="calendar"/>{date(event.date)}{event.end?' — '+date(event.end):''}</time>{event.status&&<span className="db-event-status">מצב במקור: <strong>{event.status}</strong></span>}</div><h2>{event.title}</h2>
  {!event.end&&<div className={`db-event-source source-${kind}`}><span className="db-event-source-icon"><EventIcon kind={kind}/></span><div><span>מקור ההתראה</span><strong>{source}</strong>{event.sourceId!=null&&<small>מזהה מקור: <bdi>{String(event.sourceId)}</bdi></small>}</div>{event.url&&<a href={event.url} target="_blank" rel="noreferrer">פתח מקור ↗</a>}</div>}
  {event.description&&event.description!==event.title&&<p>{event.description}</p>}
  {event.sourceExcerpt&&event.sourceExcerpt!==event.description&&event.sourceExcerpt!==event.title&&<details className="db-event-excerpt"><summary>הצג תוכן מהמקור</summary><blockquote>{event.sourceExcerpt}</blockquote></details>}
  {event.reportedPercent!=null&&<p>אחוז מדווח בלוח: {event.reportedPercent}% · אינו אימות ביצוע בשטח</p>}
  {!event.end&&!event.url&&<p className="db-event-no-link">לא נשמר קישור ישיר למקור.</p>}
  {event.end&&event.url&&<a href={event.url} target="_blank" rel="noreferrer">פתח מקור ↗</a>}</div>
  <footer><button type="button" onClick={onClose}>סגור</button></footer>
 </dialog>;
}
