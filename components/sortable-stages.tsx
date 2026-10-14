'use client';
import {useRef,useState,type ReactNode} from 'react';
import {GripVertical} from 'lucide-react';
import {moveStage,type Project} from '@/lib/projects';

export default function SortableStages({stages,disabled=false,onChange,children}:{stages:Project['stages'];disabled?:boolean;onChange:(stages:Project['stages'])=>void;children:(stage:Project['stages'][number],index:number)=>ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:string;target:string}|null>(null);
 const [active,setActive]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null),[message,setMessage]=useState('');
 function move(id:string,to:string){
  if(disabled||id===to)return;
  const next=moveStage(stages,id,to);
  onChange(next);
  setMessage((stages.find(s=>s.id===id)?.name||'Stage')+' moved to position '+(next.findIndex(s=>s.id===id)+1)+' of '+stages.length+'.');
 }
 function reset(){drag.current=null;setActive(null);setTarget(null)}
 return <div className="sortable-stages" ref={root}>
  <span className="sr-only" aria-live="polite">{message}</span>
  {stages.map((stage,index)=><div key={stage.id} data-stage-id={stage.id} className={'sortable-stage'+(active===stage.id?' dragging':'')+(target===stage.id&&active!==stage.id?' drop-target':'')}>
   <button type="button" className="stage-grip" disabled={disabled||stages.length<2} aria-label={'Reorder '+(stage.name||'stage '+(index+1))+', position '+(index+1)+' of '+stages.length} title="Drag to reorder, or use Up and Down arrow keys"
    onKeyDown={e=>{if(e.key==='Escape'){reset();return}if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const to=index+(e.key==='ArrowUp'?-1:1);if(stages[to])move(stage.id,stages[to].id)}}
    onPointerDown={e=>{if(disabled||e.button!==0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:stage.id,target:stage.id};setActive(stage.id);setTarget(stage.id)}}
    onPointerMove={e=>{if(!drag.current)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-stage-id]');if(row&&root.current?.contains(row)){const id=row.dataset.stageId!;drag.current.target=id;setTarget(id)}}}
    onPointerUp={e=>{const current=drag.current;if(!current)return;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-stage-id]');reset();if(row&&root.current?.contains(row))move(current.id,row.dataset.stageId!)}}
    onPointerCancel={reset} onLostPointerCapture={reset}><GripVertical size={18}/></button>
   <div className="sortable-stage-content">{children(stage,index)}</div>
  </div>)}
 </div>;
}
