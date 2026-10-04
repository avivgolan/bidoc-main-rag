import React,{useEffect,useRef} from 'react';
const date=value=>new Date(value).toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
export default function DashboardEventDialog({event,onClose}){
 const ref=useRef(null);
 useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
 return <dialog ref={ref} className="db-event-dialog" aria-label="פרטי אירוע" dir="rtl" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
  <header><span>{event.type||'התראה'}</span><button type="button" aria-label="סגור אירוע" onClick={onClose}>×</button></header>
  <div className="db-event-dialog-body"><time>{date(event.date)}{event.end?' — '+date(event.end):''}</time><h2>{event.title}</h2>
  {event.status&&<p>מצב במקור: <strong>{event.status}</strong></p>}
  {event.reportedPercent!=null&&<p>אחוז מדווח בלוח: {event.reportedPercent}% · אינו אימות ביצוע בשטח</p>}
  {event.url&&<a href={event.url} target="_blank" rel="noreferrer">פתח מקור ↗</a>}</div>
  <footer><button type="button" onClick={onClose}>סגור</button></footer>
 </dialog>;
}
