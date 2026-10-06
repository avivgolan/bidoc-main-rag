import React,{useEffect,useRef,useState} from 'react';
import DashboardWidget from './DashboardWidget.jsx';
import {dashboardInsightMode,dashboardInsightQuestion} from '../dashboard/insightQuestions.js';

const sections=[
 {key:'overview',title:'תמונת מצב לתקופה',icon:'◈'},
 {key:'risks',title:'סיכונים וחסמים',icon:'△'},
 {key:'actions',title:'פעולות מומלצות',icon:'✓'}
];

const clean=text=>String(text||'').replace(/\s+/g,' ').trim();
function previewPoints(result){
 const container=document.createElement('div');
 window.__bidocRenderDashboardAnswer?.(container,{...result,sources:[]});
 const heading=[...container.querySelectorAll('h1,h2,h3,h4')].find(n=>clean(n.textContent)==='התובנה');
 // Keep the conclusion separate from its evidence list; never crop a qualifier.
 let node=heading?.nextElementSibling;
 if(node && !['P','UL','OL'].includes(node.tagName))node=null;
 if(!heading)node=container.querySelector('p,ul,ol');
 const text=clean(node?.matches('ul,ol')?node.querySelector('li')?.textContent:node?.textContent);
 return [{title:text||'פתח את הניתוח המלא לצפייה בתובנה ובביסוס שלה'}];
}

function InsightSection({section,context,onJob,onOpen}){
 const [job,setJob]=useState(null),[result,setResult]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [points,setPoints]=useState([]);
 const callbacks=useRef({onJob,onOpen});callbacks.current={onJob,onOpen};
 useEffect(()=>{
  let current=true;
  setResult(null);setError('');setJob(null);
  // Avoid starting analyses for a range that is immediately replaced while loading.
  const timer=setTimeout(()=>{
   try{
    if(!window.__bidocRunDashboardChat)throw new Error('הצ׳אט עדיין אינו זמין. ניתן לנסות שוב.');
    const next=window.__bidocRunDashboardChat({...context,mode:dashboardInsightMode,question:dashboardInsightQuestion(section.key,context)},{force:attempt>0});
    setJob(next);callbacks.current.onJob?.(next);
    next.promise.then(value=>{if(!current)return;if(!value?.answer){setError('לא התקבלה תשובה לניתוח.');return;}setResult(value);},e=>{if(current)setError(e.message||'לא ניתן להשלים את הניתוח.');});
   }catch(e){if(current)setError(e.message);}
  },400);
  return()=>{current=false;clearTimeout(timer);};
 },[attempt]);
 useEffect(()=>{setPoints(result?previewPoints(result):[]);},[result]);
 return <section className={`db-insight-section insight-${section.key}`} aria-label={section.title} aria-busy={!result&&!error}>
  <h3><span aria-hidden="true" className={!result&&!error?'db-ai-pulse':''}>{section.icon}</span>{section.title}</h3>
  {!result&&!error&&<div className="db-insight-loading" role="status"><span className="db-ai-spinner"/>מנתח את מקורות התקופה…<small>אפשר להמשיך לעבוד בדשבורד</small></div>}
  {error&&<p role="alert" className="db-insight-error">{error}</p>}
  {result&&<div className="db-insight-answer db-insight-cards">{points.map((point,index)=><button type="button" className="db-insight-card" key={index} onClick={()=>callbacks.current.onOpen?.(job)} aria-label={`פתח תובנה ${index+1}: ${point.title||point.detail}`}><span className="db-insight-copy">{point.title&&<strong>{point.title}</strong>}{point.detail&&<span>{point.detail}</span>}</span><span className="db-insight-open" aria-hidden="true">↗</span></button>)}</div>}
  {(result||error)&&<footer><button type="button" onClick={()=>setAttempt(a=>a+1)}>בדוק מחדש</button>{result&&job&&<button type="button" onClick={()=>callbacks.current.onOpen?.(job)}>למה זו התובנה? ←</button>}</footer>}
 </section>;
}

export default function DashboardInsights({view,onJob,onOpen}){
 const context={projectId:view.project.id,projectName:view.project.name,fileId:view.schedule.fileId||null,token:view.queryToken,itemId:null,dateFrom:view.dateRange?.from||null,dateTo:view.dateRange?.to||null};
 const scope=JSON.stringify([context.projectId,context.fileId,context.dateFrom,context.dateTo,view.asOf]);
 return <DashboardWidget title="תובנות AI לתקופה" className="ref-panel db-period-insights">
  <header><h2>✦ תובנות AI לתקופה</h2><span>{context.dateFrom||'מאז תחילת הפרויקט'}{context.dateTo?` — ${context.dateTo}`:''}</span></header>
  <div className="db-insights-grid" key={scope}>{sections.map(section=><InsightSection key={section.key} section={section} context={context} onJob={onJob} onOpen={onOpen}/>)}</div>
 </DashboardWidget>;
}
