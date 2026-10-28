'use client';
import {useState} from 'react';
import {Pencil,ExternalLink} from 'lucide-react';
import {deliverablesUrlSchema} from '@/lib/projects';

function DriveIcon(){return <svg viewBox="0 0 48 42" width="40" height="36" aria-hidden="true"><path fill="#f6808b" d="M16 1h16l16 28H32z"/><path fill="#bc3045" d="M16 1 0 29l8 12L24 13z"/><path fill="#e64b60" d="M16 27h32l-8 14H8z"/></svg>}
export default function DeliverablesLink({url,busy,onSave}:{url:string;busy:boolean;onSave:(url:string)=>Promise<boolean>}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(url),[error,setError]=useState('');
 function edit(){setDraft(url);setError('');setEditing(true)}
 return <div className="deliverables-link">
  {url?<a className="drive-button" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open deliverables in a new tab"><DriveIcon/><span>Deliverables</span><ExternalLink size={13}/></a>:<button type="button" className="drive-button" onClick={edit} disabled={busy} aria-label="Set deliverables link"><DriveIcon/><span>Add Drive link</span></button>}
  {url&&<button type="button" className="drive-edit" onClick={edit} disabled={busy}><Pencil size={12}/> Edit link</button>}
  {editing&&<form className="drive-link-editor" onSubmit={async e=>{
   e.preventDefault();const trimmed=draft.trim();
   const normalized=trimmed&&!/^[a-z][a-z\d+.-]*:/i.test(trimmed)?'https://'+trimmed:trimmed;
   const parsed=deliverablesUrlSchema.safeParse(normalized);
   if(!parsed.success){setError('Enter a valid http or https link.');return}
   if(await onSave(parsed.data||''))setEditing(false);else setError('Could not save the link. Please try again.');
  }}><label htmlFor="deliverables-url">Deliverables link</label><input id="deliverables-url" autoFocus type="text" inputMode="url" autoComplete="url" maxLength={2048} placeholder="https://drive.google.com/…" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)}/><p>Google Drive or any other folder link. Leave blank to remove.</p>{error&&<p role="alert" className="late">{error}</p>}<div><button type="button" className="secondary" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save link'}</button></div></form>}
 </div>;
}
