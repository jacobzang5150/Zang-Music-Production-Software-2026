'use client';
import {useEffect,useState} from 'react';

export default function ProjectNotes({notes,busy,onDirtyChange,onSave}:{notes:string;busy:boolean;onDirtyChange:(dirty:boolean,value:string)=>void;onSave:(notes:string)=>Promise<boolean>}){
 const [draft,setDraft]=useState<string|null>(null);
 const [saved,setSaved]=useState(false);
 const value=draft??notes;
 const dirty=value!==notes;
 useEffect(()=>{onDirtyChange(dirty,value)},[dirty,value,onDirtyChange]);
 return <form className="project-notes" onSubmit={async e=>{e.preventDefault();if(await onSave(value)){setDraft(null);setSaved(true)}}}>
  <label htmlFor="project-notes">Notes <span>optional</span></label>
  <textarea id="project-notes" rows={3} maxLength={10000} placeholder="Session ideas, client requests, reminders…" value={value} disabled={busy} onChange={e=>{setDraft(e.target.value);setSaved(false)}}/>
  <div className="notes-actions"><span role="status">{dirty?'Unsaved changes':saved?'Notes saved':''}</span><button type="submit" className="secondary" disabled={busy||!dirty}>{busy?'Saving…':'Save notes'}</button></div>
 </form>;
}
