'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarClock,MoreHorizontal,X} from 'lucide-react';
import {localStageDeadline} from '@/lib/stage-deadlines';
export default function StageDeadline({name,value,disabled,onChange}:{name:string;value?:string;disabled?:boolean;onChange:(value:string|undefined)=>void}){
 const [open,setOpen]=useState(false),[editing,setEditing]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 function close(){setOpen(false);setEditing(false);trigger.current?.focus()}
 return <div ref={root} className="stage-options" onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close()}}}>
 <button ref={trigger} type="button" className={'stage-options-trigger'+(value?' has-deadline':'')} aria-label={'Options for '+name} aria-expanded={open} disabled={disabled} title="Stage options" onClick={()=>{setOpen(!open);setEditing(false)}}><MoreHorizontal size={20}/></button>
 {open&&<div className="stage-options-panel" role="group" aria-label={'Options for '+name}>
 {editing?<><label>Stage deadline<input autoFocus type="datetime-local" aria-label={'Deadline for '+name} value={localStageDeadline(value)} disabled={disabled} onChange={e=>{const date=new Date(e.target.value);onChange(e.target.value&&Number.isFinite(date.getTime())?date.toISOString():undefined)}}/></label><button type="button" className="stage-options-done" onClick={close}>Done</button></>:<><button type="button" disabled={disabled} onClick={()=>setEditing(true)}><CalendarClock size={15}/>{value?'Edit deadline':'Add deadline'}</button>{value&&<><p>{new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</p><button type="button" disabled={disabled} onClick={()=>{onChange(undefined);close()}}><X size={15}/> Remove deadline</button></>}</>}
 </div>}
 </div>;
}
