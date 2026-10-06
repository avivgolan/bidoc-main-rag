import React,{useEffect,useRef,useState} from 'react';

export function useDashboardNotifications(){
 const [entries,setEntries]=useState([]),[toast,setToast]=useState(null);
 const tracked=useRef(new WeakSet()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 function track(job){
  if(tracked.current.has(job))return;
  tracked.current.add(job);
  setEntries(rows=>[{job,status:'pending',unread:false},...rows]);
  const finish=status=>{if(!mounted.current)return;setEntries(rows=>rows.map(r=>r.job===job?{...r,status,unread:true}:r));setToast({job,status});};
  job.promise.then(()=>finish('done'),()=>finish('error'));
 }
 function read(job){setEntries(rows=>rows.map(r=>r.job===job?{...r,unread:false}:r));setToast(t=>t?.job===job?null:t);}
 return {entries,toast,track,read,dismiss:()=>setToast(null)};
}
const label=status=>status==='pending'?'מכין תשובה…':status==='done'?'התשובה מוכנה':'הניתוח לא הושלם';
export default function DashboardNotifications({entries,toast,onOpen,onDismiss}){
 const [open,setOpen]=useState(false),root=useRef(null),bubble=useRef(null);
 const pending=entries.filter(r=>r.status==='pending').length,unread=entries.filter(r=>r.unread).length;
 useEffect(()=>{if(!open)return;const close=e=>{if(!root.current?.contains(e.target))setOpen(false);};const key=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
 useEffect(()=>{if(!toast)return;const node=bubble.current;node?.showPopover();const timer=setTimeout(onDismiss,6500);return()=>{clearTimeout(timer);node?.hidePopover();};},[toast]);
 return <div className="db-notifications" ref={root}>
  <button type="button" className="db-notification-toggle" aria-label="התראות BIDOC AI" aria-expanded={open} onClick={()=>setOpen(!open)}><span className={pending?'db-ai-pulse':''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span><span>התראות AI</span>{(pending+unread)>0&&<b>{pending+unread}</b>}</button>
  {open&&<section className="db-notification-list" aria-label="בקשות AI"><header><strong>הפעילות שלך ב־BIDOC AI</strong><small>{pending?`${pending} בקשות בעיבוד`:'כל העדכונים במקום אחד'}</small></header>{!entries.length&&<p>תשובות ועדכונים מהניתוחים שלך יופיעו כאן.</p>}{entries.map((r,i)=><button type="button" key={i} className={`db-notification-entry is-${r.status}`} onClick={()=>{setOpen(false);onOpen(r.job);}}><span className={r.status==='pending'?'db-ai-spinner':'db-notification-state'}>{r.status==='pending'?'':r.status==='done'?'✓':'!'}</span><span><strong>{label(r.status)}{r.unread&&<i className="db-unread"/>}</strong><span>{r.job.question}</span><small>{r.job.context.projectName}</small></span></button>)}</section>}
  {toast&&<aside ref={bubble} popover="manual" className={`db-ai-toast is-${toast.status}`} aria-live="polite"><button type="button" className="db-toast-close" aria-label="סגור התראה" onClick={onDismiss}>×</button><button type="button" onClick={()=>onOpen(toast.job)}><b>{label(toast.status)}</b><span>{toast.job.question}</span><small>{toast.job.context.projectName} · {toast.status==='done'?'פתח תשובה ←':'הצג פרטים ←'}</small></button></aside>}
 </div>;
}
