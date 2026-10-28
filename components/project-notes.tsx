'use client';
import {useEffect,useRef,useState} from 'react';

export default function ProjectNotes({notes,busy,onDirtyChange,onSave}:{notes:string;busy:boolean;onDirtyChange:(dirty:boolean,value:string)=>void;onSave:(notes:string)=>Promise<boolean>}){
 const [draft,setDraft]=useState<string|null>(null);
 const [saving,setSaving]=useState(false);
 const [failed,setFailed]=useState<string|null>(null);
 const [saved,setSaved]=useState(false);
 const saveRef=useRef(onSave);
 const inFlight=useRef(false);
 saveRef.current=onSave;
 const value=draft??notes;
 const dirty=value!==notes;
 useEffect(()=>{onDirtyChange(dirty,value)},[dirty,value,onDirtyChange]);
 useEffect(()=>{
  const retry=()=>setFailed(null);
  window.addEventListener('online',retry);
  return()=>window.removeEventListener('online',retry);
 },[]);
 useEffect(()=>{
  if(!dirty||busy||inFlight.current||failed===value)return;
  const timer=setTimeout(async()=>{
   inFlight.current=true;setSaving(true);
   try{
    const ok=await saveRef.current(value);
    if(ok){setDraft(latest=>latest===value?null:latest);setSaved(true);setFailed(null)}
    else setFailed(value);
   }catch{setFailed(value)}
   finally{inFlight.current=false;setSaving(false)}
  },650);
  return()=>clearTimeout(timer);
 },[value,notes,dirty,busy,failed,saving]);
 return <div className="project-notes">
  <label htmlFor="project-notes">Notes</label>
  <textarea id="project-notes" rows={3} maxLength={10000} placeholder="Session ideas, client requests, reminders…" value={value} disabled={busy&&!saving} onFocus={()=>setFailed(null)} onChange={e=>{const next=e.target.value;setDraft(next);setSaved(false);setFailed(null);onDirtyChange(next!==notes,next)}}/>
  <div className="notes-actions"><span role="status">{saving?'Saving…':failed===value?'Could not save. Your notes are still here. Edit or focus this box to retry.':dirty?'Waiting to save…':saved?'Saved':''}</span></div>
 </div>;
}
