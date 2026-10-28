'use client';
import {noteLinks} from '@/lib/note-links';
import {useEffect,useRef,useState} from 'react';

export default function ProjectNotes({notes,busy,onDirtyChange,onSave}:{notes:string;busy:boolean;onDirtyChange:(dirty:boolean,value:string)=>void;onSave:(notes:string)=>Promise<boolean>}){
 const [editing,setEditing]=useState(false);
 const inputRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{if(editing)inputRef.current?.focus()},[editing]);
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
  <div className="notes-heading"><label id="notes-label" htmlFor="project-notes" onClick={()=>setEditing(true)}>Notes</label>{!editing&&<button type="button" className="notes-edit" onClick={()=>setEditing(true)}>Edit notes</button>}</div>
  {editing?<textarea ref={inputRef} id="project-notes" rows={3} maxLength={10000} placeholder="Session ideas, client requests, reminders…" value={value} disabled={busy&&!saving} onFocus={()=>setFailed(null)} onBlur={()=>setEditing(false)} onChange={e=>{const next=e.target.value;setDraft(next);setSaved(false);setFailed(null);onDirtyChange(next!==notes,next)}}/>:<div id="project-notes" className="notes-display" role="textbox" aria-labelledby="notes-label" aria-multiline="true" aria-readonly="true" tabIndex={0} onClick={e=>{if(!(e.target as HTMLElement).closest('a'))setEditing(true)}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setEditing(true)}}}>{value?noteLinks(value).map((part,i)=>part.href?<a key={i} href={part.href} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{part.text}</a>:part.text):<span className="notes-placeholder">Session ideas, client requests, reminders…</span>}</div>}
  <div className="notes-actions"><span role="status">{saving?'Saving…':failed===value?'Could not save. Your notes are still here. Edit or focus this box to retry.':dirty?'Waiting to save…':saved?'Saved':''}</span></div>
 </div>;
}
