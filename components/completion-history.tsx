'use client';
import {useEffect,useRef,useState} from 'react';
import {History,CheckCircle2,X} from 'lucide-react';
import type {Project} from '@/lib/projects';
type Entry={id:string;projectId:string;client:string;project:string;songId:string;song:string;stageId:string;stage:string;checkedAt:string};
type Page={items:Entry[];nextCursor:string|null;error?:string};
export default function CompletionHistory({projects,currentProjectId}:{projects:Project[];currentProjectId?:string}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="history-trigger" aria-label="History" title="History" aria-haspopup="dialog" onClick={()=>setOpen(true)}><History size={18}/></button>{open&&<HistoryWindow projects={projects} currentProjectId={currentProjectId} onClose={()=>setOpen(false)}/>}</>;
}
function HistoryWindow({projects,currentProjectId,onClose}:{projects:Project[];currentProjectId?:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0),controller=useRef<AbortController|null>(null);
 const [scope,setScope]=useState(currentProjectId?'project':'global'),[projectId,setProjectId]=useState(currentProjectId||projects[0]?.id||'');
 const [items,setItems]=useState<Entry[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const filter=scope==='project'?projectId:'';
 useEffect(()=>{const d=dialog.current,previous=document.activeElement as HTMLElement|null;d?.showModal();return()=>{d?.close();previous?.focus()}},[]);
 async function load(before?:string){
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const seq=++generation.current;setLoading(true);setError('');
  const query=new URLSearchParams();if(filter)query.set('project',filter);if(before)query.set('before',before);
  try{const r=await fetch('/api/history?'+query,{signal:abort.signal,cache:'no-store'}),data=await r.json() as Page;if(!r.ok)throw new Error(data.error||'Could not load history.');if(seq!==generation.current)return;setItems(prev=>before?[...prev,...data.items]:data.items);setNextCursor(data.nextCursor)}catch(e){if(!abort.signal.aborted&&seq===generation.current)setError((e as Error).message)}finally{if(seq===generation.current)setLoading(false)}
 }
 useEffect(()=>{setItems([]);setNextCursor(null);if(scope!=='project'||projectId)void load();return()=>{generation.current++;controller.current?.abort()}},[filter,scope]);
 const options=[...projects].sort((a,b)=>a.client.localeCompare(b.client)||a.name.localeCompare(b.name));
 return <dialog ref={dialog} className="completion-history" aria-labelledby="completion-history-title" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose()}}>
  <div className="completion-history-head"><div><div className="eyebrow">STUDIO WORKSPACE</div><h2 id="completion-history-title">Completion history</h2></div><button type="button" aria-label="Close history" onClick={onClose}><X size={22}/></button></div>
  <div className="completion-history-filters"><div role="group" aria-label="History scope"><button type="button" aria-pressed={scope==='global'} onClick={()=>setScope('global')}>All projects</button><button type="button" aria-pressed={scope==='project'} disabled={!options.length} onClick={()=>setScope('project')}>By project</button></div>{scope==='project'&&<label>Project<select aria-label="History project" value={projectId} onChange={e=>setProjectId(e.target.value)}>{options.map(p=><option key={p.id} value={p.id}>{p.client} — {p.name}</option>)}</select></label>}</div>
  <div className="completion-history-feed" aria-busy={loading}>
   {error&&<div className="completion-history-error" role="alert">{error}<button type="button" onClick={()=>load()}>Retry</button></div>}
   {!items.length&&!loading&&!error&&<div className="completion-history-empty"><History size={28}/><p>No stage check-offs recorded{scope==='project'?' for this project':''} yet.</p><small>History starts with new check-offs. Earlier completion dates weren’t recorded.</small></div>}
   <ol>{items.map(item=><li key={item.id}><CheckCircle2 size={19}/><div><strong>{item.stage}</strong><p>{item.song}</p><small>{item.client} · {item.project}</small><time dateTime={item.checkedAt}>{new Date(item.checkedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></div></li>)}</ol>
   {loading&&<p className="completion-history-loading" role="status">Loading history…</p>}{nextCursor&&!loading&&<button type="button" className="secondary history-load-more" onClick={()=>load(nextCursor)}>Load more</button>}
  </div>
 </dialog>;
}
