import React,{useEffect,useRef,useState} from 'react';

export default function DashboardAiDialog({job,onClose,onRefresh}) {
  const dialog=useRef(null),answer=useRef(null);
  const [result,setResult]=useState(null),[error,setError]=useState(''),[opening,setOpening]=useState(false);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  useEffect(()=>{
    let current=true;setResult(null);setError('');
    job.promise.then(r=>{if(current)setResult(r);},e=>{if(current)setError(e.message || 'לא ניתן להשלים את הניתוח.');});
    return()=>{current=false;};
  },[job]);
  useEffect(()=>{if(result&&answer.current)window.__bidocRenderDashboardAnswer?.(answer.current,result);},[result]);
  async function continueChat(){
    setOpening(true);setError('');
    try{await window.__bidocContinueDashboardChat(job);onClose();}
    catch(e){setError(e.message);}finally{setOpening(false);}
  }
  return <dialog ref={dialog} className="db-ai-dialog" aria-labelledby="db-ai-dialog-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <header><span className="db-ai-emblem">✦</span><div><h2 id="db-ai-dialog-title">BIDOC AI</h2><p>{job.context.projectName}</p></div><button type="button" onClick={onClose} aria-label="סגור חלון">×</button></header>
    <div className="db-ai-question"><small>השאלה שלך</small><h3>{job.question}</h3></div>
    <div className="db-ai-response" aria-busy={!result&&!error}>
      {!result&&!error&&<div role="status" className="db-ai-working"><span className="db-ai-spinner"/><h3>בודק את המקורות ומכין תשובה…</h3><p>הניתוח מתבצע דרך הצ׳אט הראשי ונשמר כשיחה בהיסטוריה.</p><small>אפשר לסגור את החלון; הבקשה תמשיך ברקע.</small></div>}
      {result&&<><div className="db-ai-answer" ref={answer}/>{!result.dashboardSaved&&<p className="db-ai-save-warning">התקבלה תשובה אך שמירת השיחה לא אושרה. המשך בצ׳אט אינו זמין.</p>}</>}
      {error&&<p role="alert" className="db-ai-error">{error}</p>}
    </div>
    <footer><span>{result?.dashboardSaved?'השיחה נשמרה בהיסטוריית הצ׳אט':error?'הפעולה לא הושלמה':'התשובה תופיע כאן כשהניתוח יסתיים'}</span><button type="button" disabled={(!result&&!error)||opening} onClick={onRefresh}>בדוק מחדש</button><button type="button" onClick={onClose}>סגור חלון</button><button className="db-ai-continue" type="button" disabled={!result?.dashboardSaved||opening} onClick={continueChat}>{opening?'פותח…':'המשך בצ׳אט ←'}</button></footer>
  </dialog>;
}
