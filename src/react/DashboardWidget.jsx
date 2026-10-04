import React,{useRef,useState,useEffect} from 'react';

// Keep the same mounted content when moving a widget into the browser's modal top layer.
export default function DashboardWidget({title,className='',id,children}) {
  const dialog=useRef(null),button=useRef(null);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>()=>{dialog.current?.close();},[]);
  function close(){dialog.current?.close();setExpanded(false);button.current?.focus({preventScroll:true});}
  function toggle(){if(expanded)close();else{dialog.current?.showModal();setExpanded(true);}}
  return <dialog ref={dialog} id={id} className={'db-widget '+className} role={expanded?'dialog':'region'} aria-label={title} aria-modal={expanded?true:undefined} onClose={e=>{if(e.target===dialog.current)setExpanded(false);}} onCancel={e=>{if(e.target!==dialog.current)return;e.preventDefault();close();}}>
    <button ref={button} type="button" className="db-widget-expand" aria-label={(expanded?'הקטן: ':'הגדל למסך מלא: ')+title} title={expanded?'חזרה לדשבורד (Esc)':'הגדל למסך מלא'} aria-expanded={expanded} onClick={toggle}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{expanded?<><path d="M21 3l-7 7m0-6v6h6M3 21l7-7m-6 0h6v6"/></>:<><path d="M14 10l7-7m-6 0h6v6M10 14l-7 7m0-6v6h6"/></>}</svg>
    </button>
    {children}
  </dialog>;
}
