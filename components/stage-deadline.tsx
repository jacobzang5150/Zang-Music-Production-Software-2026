'use client';
import {useRef,useState} from 'react';
import {Clock3} from 'lucide-react';
import {localStageDeadline} from '@/lib/stage-deadlines';
import SessionDatePicker from './session-date-picker';
export default function StageDeadline({name,value,disabled,onChange}:{name:string;value?:string;disabled?:boolean;onChange:(value:string|undefined)=>void}){
 const [open,setOpen]=useState(false),[date,setDate]=useState(''),[time,setTime]=useState('17:00');
 const trigger=useRef<HTMLButtonElement>(null);
 function close(){setOpen(false);requestAnimationFrame(()=>trigger.current?.focus())}
 function edit(){const local=localStageDeadline(value);setDate(local.slice(0,10));setTime(local.slice(11,16)||'17:00');setOpen(true)}
 function save(){const deadline=new Date(`${date}T${time}`);if(!date||!time||!Number.isFinite(deadline.getTime()))return;onChange(deadline.toISOString());close()}
 return <div className="stage-options">
  <button ref={trigger} type="button" className={'stage-options-trigger'+(value?' has-deadline':'')} aria-label={(value?'Edit':'Add')+' deadline for '+name} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} title={value?'Edit stage deadline':'Add stage deadline'} onClick={edit}><Clock3 size={20}/></button>
  {open&&<SessionDatePicker title="Stage deadline" subtitle={name} value={date} onSelect={setDate} onClose={close} footer={<div className="stage-deadline-controls">
   {date&&<div className="stage-deadline-selection"><span>{new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span></div>}
   <label className="stage-deadline-time"><span><Clock3 size={16}/>Due at</span><input type="time" aria-label="Deadline time" value={time} onInput={e=>setTime(e.currentTarget.value)} required/></label>
   <div className="stage-deadline-actions">{value&&<button type="button" className="deadline-remove" disabled={disabled} onClick={()=>{onChange(undefined);close()}}>Remove</button>}<button type="button" onClick={close}>Cancel</button><button type="button" className="deadline-save" disabled={!date||!time||disabled} onClick={save}>Save deadline</button></div>
  </div>}/>}
 </div>;
}
