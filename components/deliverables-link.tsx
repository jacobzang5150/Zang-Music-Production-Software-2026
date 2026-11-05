'use client';
import {useState} from 'react';
import DriveWindow from '@/components/drive-window';
function DriveIcon(){return <svg viewBox="0 0 48 42" width="25" height="23" aria-hidden="true"><path fill="#f6808b" d="M16 1h16l16 28H32z"/><path fill="#bc3045" d="M16 1 0 29l8 12L24 13z"/><path fill="#e64b60" d="M16 27h32l-8 14H8z"/></svg>}
export default function DeliverablesLink({url,onSave,syncMessage,syncError,onRetry}:{url:string;busy:boolean;onSave:(url:string)=>Promise<boolean>;syncMessage?:string;syncError?:string;onRetry?:()=>void}){
 const [open,setOpen]=useState(false);
 return <div className="deliverables-link">
  {open&&<DriveWindow url={url} onClose={()=>setOpen(false)} onLinkChange={onSave} managed syncMessage={syncMessage} syncError={syncError} onRetry={onRetry}/>}
  <button type="button" className="drive-button" onClick={()=>setOpen(true)} aria-label="Open Google Drive" title="Open Google Drive"><DriveIcon/></button>
 </div>;
}
