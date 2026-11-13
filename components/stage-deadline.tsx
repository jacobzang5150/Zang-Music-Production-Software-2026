'use client';
import {useState} from 'react';
import {CalendarClock,X} from 'lucide-react';
import {localStageDeadline} from '@/lib/stage-deadlines';
export default function StageDeadline({name,value,disabled,onChange}:{name:string;value?:string;disabled?:boolean;onChange:(value:string|undefined)=>void}){
 const [editing,setEditing]=useState(!!value);
 return <div className="stage-deadline-editor">{editing||value?<><label>Stage deadline<input type="datetime-local" aria-label={'Deadline for '+name} value={localStageDeadline(value)} disabled={disabled} onChange={e=>{const date=new Date(e.target.value);onChange(e.target.value&&Number.isFinite(date.getTime())?date.toISOString():undefined)}}/></label><button type="button" className="stage-deadline-remove" aria-label={'Remove deadline for '+name} disabled={disabled} onClick={()=>{onChange(undefined);setEditing(false)}}><X size={16}/></button></>:<button type="button" className="stage-deadline-add" disabled={disabled} onClick={()=>setEditing(true)}><CalendarClock size={14}/> Add deadline</button>}</div>;
}
