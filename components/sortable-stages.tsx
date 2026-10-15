'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {GripVertical} from 'lucide-react';
import {moveStage,type Project} from '@/lib/projects';

export default function SortableStages({stages,disabled=false,onChange,children}:{stages:Project['stages'];disabled?:boolean;onChange:(stages:Project['stages'])=>void;children:(stage:Project['stages'][number],index:number)=>ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:string;target:string;offsetX:number;offsetY:number}|null>(null);
 const [preview,setPreview]=useState<{id:string;index:number;x:number;y:number;width:number;height:number}|null>(null);
 const pointer=useRef<{x:number;y:number}|null>(null);
 const [active,setActive]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!active)return;
  let frame=0,last=0;
  const body=root.current?.closest<HTMLElement>('.form-body');
  const scroller=body&&getComputedStyle(body).overflowY==='auto'?body:root.current?.closest<HTMLElement>('.modal');
  function tick(time:number){
   const point=pointer.current;
   if(point&&drag.current){
    const bounds=scroller?.getBoundingClientRect();
    const top=bounds?.top??70,bottom=bounds?.bottom??window.innerHeight-85;
    const edge=Math.min(64,(bottom-top)/4);
    const velocity=point.y<top+edge?-Math.min(1,(top+edge-point.y)/edge):point.y>bottom-edge?Math.min(1,(point.y-bottom+edge)/edge):0;
    const distance=velocity*Math.min(time-last||16,32)*.6;
    if(distance){if(scroller)scroller.scrollTop+=distance;else window.scrollBy(0,distance)}
    const row=document.elementFromPoint(point.x,point.y)?.closest<HTMLElement>('[data-stage-id]');
    setTarget(row&&root.current?.contains(row)?row.dataset.stageId!:null);
   }
   last=time;frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[active]);
 function move(id:string,to:string){
  if(disabled||id===to)return;
  const next=moveStage(stages,id,to);
  onChange(next);
  setMessage((stages.find(s=>s.id===id)?.name||'Stage')+' moved to position '+(next.findIndex(s=>s.id===id)+1)+' of '+stages.length+'.');
 }
 function reset(){pointer.current=null;drag.current=null;setActive(null);setTarget(null);setPreview(null)}
 return <div className="sortable-stages" ref={root}>
  <span className="sr-only" aria-live="polite">{message}</span>
  {stages.map((stage,index)=><div key={stage.id} data-stage-id={stage.id} className={'sortable-stage'+(active===stage.id?' dragging':'')+(target===stage.id&&active!==stage.id?' drop-target':'')}>
   <button type="button" className="stage-grip" disabled={disabled||stages.length<2} aria-label={'Reorder '+(stage.name||'stage '+(index+1))+', position '+(index+1)+' of '+stages.length} title="Drag to reorder, or use Up and Down arrow keys"
    onKeyDown={e=>{if(e.key==='Escape'){reset();return}if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const to=index+(e.key==='ArrowUp'?-1:1);if(stages[to])move(stage.id,stages[to].id)}}
    onPointerDown={e=>{if(disabled||e.button!==0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});pointer.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);const rect=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={id:stage.id,target:stage.id,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top};setPreview({id:stage.id,index,x:rect.left,y:rect.top,width:rect.width,height:rect.height});setActive(stage.id);setTarget(stage.id)}}
    onPointerMove={e=>{if(!drag.current)return;pointer.current={x:e.clientX,y:e.clientY};const {offsetX,offsetY}=drag.current;setPreview(p=>p?{...p,x:e.clientX-offsetX,y:e.clientY-offsetY}:null);const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-stage-id]');if(row&&root.current?.contains(row)){const id=row.dataset.stageId!;drag.current.target=id;setTarget(id)}else setTarget(null)}}
    onPointerUp={e=>{const current=drag.current;if(!current)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-stage-id]');reset();if(row&&root.current?.contains(row))move(current.id,row.dataset.stageId!)}}
    onPointerCancel={reset} onLostPointerCapture={reset}><GripVertical size={18}/></button>
   <div className="sortable-stage-content">{children(stage,index)}</div>
  </div>)}
 {preview&&createPortal(<div className="stage-drag-preview sortable-stage" aria-hidden="true" inert style={{left:preview.x,top:preview.y,width:preview.width,minHeight:preview.height}}><span className="stage-grip"><GripVertical size={18}/></span><div className="sortable-stage-content">{children(stages.find(s=>s.id===preview.id)!,preview.index)}</div></div>,document.body)}
 </div>;
}
