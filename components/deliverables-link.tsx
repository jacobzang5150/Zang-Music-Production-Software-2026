'use client';
import {useEffect,useRef,useState} from 'react';
import DriveWindow from '@/components/drive-window';
import {Copy,Check} from 'lucide-react';
function DriveIcon(){return <svg viewBox="0 0 48 42" width="40" height="36" aria-hidden="true"><path fill="#f6808b" d="M16 1h16l16 28H32z"/><path fill="#bc3045" d="M16 1 0 29l8 12L24 13z"/><path fill="#e64b60" d="M16 27h32l-8 14H8z"/></svg>}
export default function DeliverablesLink({url,busy,onSave,syncMessage,syncError,onRetry}:{url:string;busy:boolean;onSave:(url:string)=>Promise<boolean>;syncMessage?:string;syncError?:string;onRetry?:()=>void}){
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState('');const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 useEffect(()=>{setCopied(false);setError('')},[url]);
 async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);setError('');if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2200)}catch{setError('Could not copy. Allow clipboard access and try again.')}}
 return <div className="deliverables-link">
  {open&&<DriveWindow url={url} onClose={()=>setOpen(false)} onLinkChange={onSave} managed syncMessage={syncMessage} syncError={syncError} onRetry={onRetry}/>}
  <div className="drive-button-row"><button type="button" className={'drive-copy'+(copied?' copied':'')} onClick={copy} disabled={!url||busy} aria-label={copied?'Link copied':'Copy Drive link'} title={copied?'Link copied':'Copy Drive link'}>{copied?<Check size={18}/>:<Copy size={18}/>}</button><button type="button" className="drive-button" onClick={()=>setOpen(true)} aria-label="Open Google Drive"><DriveIcon/></button></div>
  <span className="sr-only" role="status">{copied?'Drive link copied':''}</span>{error&&<p className="drive-copy-error" role="alert">{error}</p>}
 </div>;
}
