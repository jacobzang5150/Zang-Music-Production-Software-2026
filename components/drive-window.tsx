'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Folder,Music2,FileText,Upload,RefreshCw,ChevronRight,ArrowLeft,Pencil,Download,ExternalLink,LogOut,FolderOpen} from 'lucide-react';
import {DriveApi,DriveError,DRIVE_FOLDER,parseDriveLink,driveFileUrl,isAudio,isText,readableSize,type DriveFile} from '@/lib/drive-files';
import {prepareDrive,connectDrive,currentDriveToken,forgetDriveToken,disconnectDrive,restoreDriveConnection,pickDriveFolder,type DriveConfig} from '@/lib/google-drive-browser';

type Media={file:DriveFile;url?:string;text?:string};
export default function DriveWindow({url,onClose,onLinkChange,managed=false,syncMessage,syncError,onRetry}:{url:string;onClose:()=>void;onLinkChange:(url:string)=>Promise<boolean>;managed?:boolean;syncMessage?:string;syncError?:string;onRetry?:()=>void}){
 const [config,setConfig]=useState<DriveConfig|null>(null),[configLoading,setConfigLoading]=useState(true);
 const [token,setToken]=useState<string|null>(()=>currentDriveToken()),[connecting,setConnecting]=useState(false);
 const [files,setFiles]=useState<DriveFile[]>([]),[trail,setTrail]=useState<DriveFile[]>([]),[nextPage,setNextPage]=useState<string>();
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState('');
 const [operation,setOperation]=useState(''),[percent,setPercent]=useState(0),[dragging,setDragging]=useState(false),[picking,setPicking]=useState(false);
 const [media,setMedia]=useState<Media|null>(null),[textDraft,setTextDraft]=useState(''),[rename,setRename]=useState<DriveFile|null>(null),[name,setName]=useState('');
 const api=useRef<DriveApi|null>(null),panel=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),uploadInput=useRef<HTMLInputElement>(null),replaceInput=useRef<HTMLInputElement>(null);
 const [replacement,setReplacement]=useState<{target:DriveFile;file:File}|null>(null);
 const operationRef=useRef(false),pickerRef=useRef(false),alive=useRef(true),request=useRef(0),dragDepth=useRef(0);
 const readController=useRef<AbortController|null>(null),writeController=useRef<AbortController|null>(null),mediaController=useRef<AbortController|null>(null),objectUrl=useRef<string|null>(null);
 const folder=trail.at(-1);
 const busy=!!operation||loading||picking||!!syncMessage;
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const mediaDirty=media?.text!==undefined&&textDraft!==media.text;
 const dirtyRef=useRef(false);dirtyRef.current=mediaDirty;
 function clearMedia(){mediaController.current?.abort();if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=null}setMedia(null);setTextDraft('');setReplacement(null)}
 function close(){if(dirtyRef.current&&!confirm('Discard unsaved file edits?'))return;closeRef.current()}
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';closeButton.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(pickerRef.current)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}
   if(e.key==='Tab'){
    const focusRoot=panel.current?.querySelector<HTMLElement>('.drive-rename-overlay')||panel.current;
    const elements=Array.from(focusRoot?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),audio,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
    const first=elements[0],last=elements.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
   }
  };
  const leaving=(e:BeforeUnloadEvent)=>{if(operationRef.current||dirtyRef.current){e.preventDefault();e.returnValue=''}};
  document.addEventListener('keydown',key,true);window.addEventListener('beforeunload',leaving);
  return()=>{alive.current=false;request.current++;readController.current?.abort();writeController.current?.abort();mediaController.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);window.removeEventListener('beforeunload',leaving);previous?.focus()};
 },[]);
 async function setup(){setConfigLoading(true);setError('');try{const c=await prepareDrive();if(alive.current)setConfig(c)}catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setConfigLoading(false)}}
 useEffect(()=>{void setup();const auth=()=>setToken(currentDriveToken());window.addEventListener('session-drive-auth',auth);void restoreDriveConnection();return()=>window.removeEventListener('session-drive-auth',auth)},[]);
 function failure(e:unknown){if(!alive.current||(e as Error).name==='AbortError')return;if(e instanceof DriveError&&e.status===401){forgetDriveToken();setToken(null);void restoreDriveConnection()}setError((e as Error).message||'Something went wrong. Please retry.')}
 async function listFolder(target:DriveFile,path:DriveFile[],more?:string){
  if(!api.current)return;readController.current?.abort();const controller=new AbortController();readController.current=controller;const seq=++request.current;
  setLoading(true);setError('');if(!more){clearMedia();setFiles([]);setTrail(path);setNextPage(undefined);setQuery('')}
  try{const result=await api.current.list(target.id,more,controller.signal);if(seq!==request.current||!alive.current)return;setFiles(prev=>more?[...prev,...result.files]:result.files);setNextPage(result.nextPageToken)}catch(e){failure(e)}finally{if(seq===request.current&&alive.current)setLoading(false)}
 }
 useEffect(()=>{
  if(!token)return;
  const client=new DriveApi(token);api.current=client;const parsed=parseDriveLink(url);const controller=new AbortController();readController.current?.abort();readController.current=controller;const seq=++request.current;
  setError('');setFiles([]);setTrail([]);setNextPage(undefined);clearMedia();
  if(!parsed){setNotice(managed?'Session automatically prepares your client and project folders.':'Choose a Google Drive folder to use in this project.');return}
  if(parsed.resourceKey)client.keys.set(parsed.id,parsed.resourceKey);
  setLoading(true);
  void(async()=>{try{
   let root=await client.get(parsed.id,controller.signal);
   if(root.shortcutDetails)root=await client.get(root.shortcutDetails.targetId,controller.signal);
   if(seq!==request.current||!alive.current)return;
   if(root.mimeType===DRIVE_FOLDER){setTrail([root]);const result=await client.list(root.id,undefined,controller.signal);if(seq!==request.current||!alive.current)return;setFiles(result.files);setNextPage(result.nextPageToken)}else setFiles([root]);
   setNotice('');
  }catch(e){failure(e)}finally{if(seq===request.current&&alive.current)setLoading(false)}})();
  return()=>controller.abort();
 },[token,url]);
 async function connect(){if(!config||connecting)return;setConnecting(true);setError('');try{const value=await connectDrive(config);if(alive.current)setToken(value)}catch(e){failure(e)}finally{if(alive.current)setConnecting(false)}}
 async function chooseFolder(){
  if(!config||!token||busy)return;setPicking(true);pickerRef.current=true;setError('');
  try{const picked=await pickDriveFolder(config,token,folder?.id);if(picked&&alive.current){const link='https://drive.google.com/drive/folders/'+encodeURIComponent(picked.id)+(picked.resourceKey?'?resourcekey='+encodeURIComponent(picked.resourceKey):'');if(!await onLinkChange(link))throw new Error('Could not save the folder link to this project.')}}catch(e){failure(e)}finally{pickerRef.current=false;if(alive.current){setPicking(false);closeButton.current?.focus()}}
 }
 async function openFile(file:DriveFile){
  if(busy)return;if(mediaDirty&&!confirm('Discard unsaved file edits?'))return;
  setError('');clearMedia();
  if(file.shortcutDetails){try{const resolved=await api.current!.get(file.shortcutDetails.targetId);if(alive.current)await openFile(resolved)}catch(e){failure(e)}return}
  if(file.mimeType===DRIVE_FOLDER){await listFolder(file,[...trail,file]);return}
  setMedia({file});
  if(!isAudio(file)&&!isText(file))return;
  const limit=isText(file)?1024*1024:256*1024*1024;
  if(Number(file.size)>limit){setNotice(isText(file)?'This text file is too large for the inline editor. Open it in Google Drive.':'This audio file is over 256 MB. Use the Google preview or open it in Drive.');return}
  const controller=new AbortController();mediaController.current=controller;setLoading(true);
  try{const blob=await api.current!.content(file,controller.signal);if(controller.signal.aborted||!alive.current)return;
   if(isText(file)){const text=await blob.text();if(controller.signal.aborted||!alive.current)return;setMedia({file,text});setTextDraft(text)}
   else{const src=URL.createObjectURL(blob);objectUrl.current=src;setMedia({file,url:src})}
  }catch(e){failure(e)}finally{if(!controller.signal.aborted&&alive.current)setLoading(false)}
 }
 async function transfer(selected:File[],target?:DriveFile){
  if(!api.current||operationRef.current||!selected.length||!target&&!folder)return;
  operationRef.current=true;const controller=new AbortController();writeController.current=controller;
  setError('');setNotice('');setPercent(0);let completed=0;
  try{
   for(const file of selected){setOperation((target?'Replacing ':'Uploading ')+file.name);setPercent(0);
    await api.current.upload(file,folder?.id||'',value=>{if(alive.current)setPercent(value)},controller.signal,target?.id);completed++;
   }
   if(alive.current){setNotice(target?'File updated.':`${completed} ${completed===1?'file':'files'} uploaded.`);setReplacement(null);clearMedia();if(folder)await listFolder(folder,trail);else if(target)setFiles([await api.current.get(target.id)])}
  }catch(e){if(controller.signal.aborted){if(alive.current)setNotice('Transfer stopped. Refresh the folder to check which files finished.')}else failure(e)}
  finally{operationRef.current=false;if(alive.current)setOperation('')}
 }
 async function saveRename(e:React.FormEvent){e.preventDefault();if(!rename||!name.trim()||operationRef.current)return;operationRef.current=true;setOperation('Renaming file…');setError('');try{const updated=await api.current!.rename(rename.id,name.trim());if(alive.current){setFiles(prev=>prev.map(f=>f.id===updated.id?updated:f));if(media?.file.id===updated.id)setMedia({...media,file:updated});setRename(null);setNotice('Name updated.')}}catch(e){failure(e)}finally{operationRef.current=false;if(alive.current)setOperation('')}}
 async function saveText(){
  if(!media||media.text===undefined||!mediaDirty||operationRef.current)return;
  const latest=await api.current!.get(media.file.id).catch(e=>{failure(e);return null});if(!latest)return;
  if(latest.modifiedTime!==media.file.modifiedTime){setError('This file changed in Drive while you were editing. Copy your edits, then reopen the file before saving.');return}
  await transfer([new File([textDraft],media.file.name,{type:media.file.mimeType||'text/plain'})],media.file);
 }
 function drop(e:React.DragEvent){e.preventDefault();dragDepth.current=0;setDragging(false);if(token&&folder?.capabilities?.canAddChildren&&!busy){const items=Array.from(e.dataTransfer.items);if(items.some(item=>item.webkitGetAsEntry?.()?.isDirectory)){setError('Drop files rather than folders.');return}void transfer(Array.from(e.dataTransfer.files))}}
 const shown=files.filter(file=>file.name.toLowerCase().includes(query.toLowerCase()));
 return createPortal(<div className="drive-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pickerRef.current)close()}}><div ref={panel} className={'drive-window'+(dragging?' is-dragging':'')} role="dialog" aria-modal="true" aria-labelledby="drive-title" onDragEnter={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth.current++;setDragging(true)}}} onDragLeave={()=>{if(--dragDepth.current<=0)setDragging(false)}} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={drop}>
  <div className="drive-window-head"><div><div className="eyebrow">SESSION FILES</div><h2 id="drive-title">Google Drive</h2></div><div className="drive-window-head-actions">{token&&<button type="button" className="drive-icon-action" aria-label="Disconnect and forget Google Drive" title="Disconnect and forget Google Drive" disabled={busy||connecting} onClick={async()=>{setConnecting(true);try{await disconnectDrive();api.current=null;setToken(null);setFiles([]);setTrail([]);clearMedia()}catch(e){failure(e)}finally{setConnecting(false)}}}><LogOut size={18}/></button>}<button ref={closeButton} type="button" className="drive-icon-action" aria-label="Close Google Drive" onClick={close}><X size={22}/></button></div></div>
  {error&&<div className="drive-error" role="alert">{error}</div>}
  {!token?<div className="drive-connect"><FolderOpen size={54}/><h3>Your project files, right here.</h3><p>Connect the Google account that holds your deliverables to browse folders, upload files, and listen to audio.</p><p className="drive-consent">Google will ask for access to view and manage your Drive files. Session automatically creates Client / Project / EDITS, MIXES, MASTERS folders for existing and new projects. Other file changes happen when you upload, rename, replace, or save an edit. {config?.rememberConnection?'Your connection is remembered securely so you won’t need to reconnect on each visit. Use Disconnect to forget it.':'Your Google access token stays in this browser session.'}</p><button className="primary" disabled={!config||connecting} onClick={connect}>{connecting?'Connecting…':configLoading?'Loading Google…':'Connect Google Drive'}</button>{!config&&!configLoading&&<button className="secondary" onClick={setup}>Retry setup</button>}</div>:<>
  <div className="drive-toolbar"><div className="drive-breadcrumbs">{media?<button onClick={()=>{if(!mediaDirty||confirm('Discard unsaved file edits?'))clearMedia()}}><ArrowLeft size={16}/> Files</button>:trail.length?trail.map((part,index)=><span key={part.id}>{index>0&&<ChevronRight size={13}/>}<button disabled={busy||index===trail.length-1} onClick={()=>listFolder(part,trail.slice(0,index+1))}>{part.name}</button></span>):<span>Project files</span>}</div><div className="drive-tool-actions">{!managed&&<button className="secondary" disabled={busy||!config} onClick={chooseFolder}><FolderOpen size={15}/> Change folder</button>}{folder&&<button className="secondary" disabled={busy} onClick={()=>listFolder(folder,trail)} aria-label="Refresh folder"><RefreshCw size={16}/></button>}<button className="primary" disabled={busy||!folder?.capabilities?.canAddChildren} onClick={()=>uploadInput.current?.click()}><Upload size={15}/> Upload</button><input ref={uploadInput} type="file" multiple hidden onChange={e=>{const selected=Array.from(e.target.files||[]);e.target.value='';void transfer(selected)}}/></div></div>
  {syncMessage&&<p className="drive-notice" role="status">{syncMessage}</p>}{syncError&&<div className="drive-error" role="alert">{syncError} <button className="secondary" disabled={!!syncMessage} onClick={onRetry}>Retry folder setup</button></div>}{notice&&<p className="drive-notice" role="status">{notice}</p>}
  {operation&&<div className="drive-transfer" role="status"><span>{operation}</span>{operation.startsWith('Uploading')||operation.startsWith('Replacing')?<><progress max={100} value={percent}/><span>{percent}%</span><button className="secondary" onClick={()=>writeController.current?.abort()}>Cancel</button></>:null}</div>}
  {media?<div className="drive-file-preview"><div className="drive-file-heading"><div><h3>{media.file.name}</h3><span>{readableSize(media.file.size)}</span></div><div><button className="secondary" disabled={busy||!media.file.capabilities?.canEdit} onClick={()=>{setRename(media.file);setName(media.file.name)}}><Pencil size={14}/> Rename</button><a className="secondary" href={driveFileUrl(media.file)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Open in Google</a></div></div>
   {loading?<div className="drive-empty">Loading file…</div>:media.url?<div className="drive-audio"><Music2 size={56}/><audio key={media.url} controls preload="metadata" src={media.url} onError={()=>setError('Your browser cannot play this audio format. Open it in Google Drive or download the file.')} aria-label={'Play '+media.file.name}/><a className="secondary" href={media.url} download={media.file.name}><Download size={16}/> Download</a></div>:media.text!==undefined?<div className="drive-text-editor"><textarea aria-label={'Edit '+media.file.name} value={textDraft} readOnly={!media.file.capabilities?.canEdit} disabled={!!operation} onChange={e=>setTextDraft(e.target.value)}/><button className="primary" disabled={busy||!mediaDirty||!media.file.capabilities?.canEdit} onClick={saveText}>Save file changes</button></div>:<><iframe title={'Preview '+media.file.name} src={'https://drive.google.com/file/d/'+encodeURIComponent(media.file.id)+'/preview'+(media.file.resourceKey?'?resourcekey='+encodeURIComponent(media.file.resourceKey):'')} allow="autoplay; fullscreen" referrerPolicy="strict-origin-when-cross-origin"/><p className="drive-preview-hint">If Google cannot preview this file, use Open in Google. Google Docs and Sheets use Google’s own editors.</p></>}
   {!media.file.mimeType.startsWith('application/vnd.google-apps.')&&media.file.capabilities?.canEdit&&<div className="drive-replace"><button className="secondary" disabled={busy} onClick={()=>replaceInput.current?.click()}>Replace file contents</button><input ref={replaceInput} type="file" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)setReplacement({target:media.file,file})}}/>{replacement&&<div><p>Replace the contents of <strong>{replacement.target.name}</strong> with <strong>{replacement.file.name}</strong>?</p><button className="secondary" disabled={busy} onClick={()=>setReplacement(null)}>Cancel</button><button className="primary" disabled={busy} onClick={()=>transfer([replacement.file],replacement.target)}>Replace contents</button></div>}</div>}
  </div>:<div className="drive-file-browser"><input className="drive-search" type="search" aria-label="Filter files in this folder" placeholder="Filter this folder…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="drive-file-list" aria-busy={loading}>{loading&&!files.length?<div className="drive-empty">Loading your files…</div>:!shown.length?<div className="drive-empty"><FolderOpen size={38}/><p>{query?'No matching files.':folder?'This folder is empty. Drop files here to upload.':managed?'Your project folders will appear here after automatic setup.':'Choose a project folder to get started.'}</p></div>:shown.map(file=><div className="drive-file-row" key={file.id}><button className="drive-file-open" disabled={busy} onClick={()=>openFile(file)}>{file.mimeType===DRIVE_FOLDER?<Folder size={22}/>:isAudio(file)?<Music2 size={22}/>:<FileText size={22}/>}<span><strong>{file.name}</strong><small>{file.mimeType===DRIVE_FOLDER?'Folder':readableSize(file.size)||'Google file'}</small></span></button><span className="drive-file-date">{file.modifiedTime?new Date(file.modifiedTime).toLocaleDateString():''}</span><button className="drive-icon-action" disabled={busy||!file.capabilities?.canEdit} aria-label={'Rename '+file.name} onClick={()=>{setRename(file);setName(file.name)}}><Pencil size={15}/></button></div>)}</div>{nextPage&&folder&&<button className="secondary drive-load-more" disabled={busy} onClick={()=>listFolder(folder,trail,nextPage)}>Load more files</button>}</div>}
  <div className="drive-window-footer"><span>{folder?.capabilities?.canAddChildren?'Drop files anywhere in this window to upload.':'Access follows your Google Drive permissions.'}</span><span>{operation?'Closing stops unfinished transfers.':'Click outside or press Esc to close.'}</span></div>
  </>}
  {dragging&&<div className="drive-drop-overlay"><Upload size={44}/><strong>{token&&folder?.capabilities?.canAddChildren&&!busy?'Drop to upload to '+folder.name:'Open a writable folder before uploading'}</strong></div>}
  {rename&&<div className="drive-rename-overlay"><form onSubmit={saveRename}><h3>Rename file</h3><input autoFocus aria-label="File name" maxLength={255} required value={name} disabled={!!operation} onChange={e=>setName(e.target.value)}/><div><button type="button" className="secondary" disabled={!!operation} onClick={()=>setRename(null)}>Cancel</button><button className="primary" disabled={!!operation||!name.trim()}>Save name</button></div></form></div>}
 </div></div>,document.body);
}
