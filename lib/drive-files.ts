export const DRIVE_FOLDER='application/vnd.google-apps.folder';
export type DriveFile={id:string;name:string;mimeType:string;size?:string;modifiedTime?:string;trashed?:boolean;webViewLink?:string;resourceKey?:string;parents?:string[];capabilities?:{canEdit?:boolean;canTrash?:boolean;canShare?:boolean;canDownload?:boolean;canAddChildren?:boolean};shortcutDetails?:{targetId:string;targetMimeType:string;targetResourceKey?:string}};
export function parseDriveLink(value:string):{id:string;resourceKey?:string}|null{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname))return null;
  const id=u.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1]||u.searchParams.get('id');
  if(!id||!/^[-\w]+$/.test(id))return null;
  return {id,resourceKey:u.searchParams.get('resourcekey')||undefined};
 }catch{return null}
}
export function driveFileUrl(file:DriveFile){
 // Construct a trusted destination rather than opening arbitrary provider text.
 return `https://drive.google.com/${file.mimeType===DRIVE_FOLDER?'drive/folders/':'file/d/'}${encodeURIComponent(file.id)}${file.mimeType===DRIVE_FOLDER?'':'/view'}`;
}
export function readableSize(value?:string){const n=Number(value);if(!Number.isFinite(n)||n<=0)return '';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';if(n<1073741824)return (n/1048576).toFixed(1)+' MB';return (n/1073741824).toFixed(1)+' GB'}
export function isAudio(file:DriveFile){return file.mimeType.startsWith('audio/')||/\.(wav|mp3|m4a|aac|ogg|flac|aif|aiff)$/i.test(file.name)}
export function isText(file:DriveFile){return file.mimeType==='text/plain'||/\.(txt|md|csv|json)$/i.test(file.name)&&!file.mimeType.startsWith('application/vnd.google-apps.')}
export const DRIVE_FIELDS='id,name,mimeType,size,modifiedTime,trashed,webViewLink,resourceKey,parents,capabilities(canEdit,canDownload,canAddChildren,canTrash,canShare),shortcutDetails';
export class DriveError extends Error{status:number;constructor(message:string,status=0){super(message);this.status=status}}
export async function checkDriveResponse(response:Response){
 if(response.ok||response.status===308)return response;
 if(response.status===401)throw new DriveError('Your Google session expired. Reconnect to continue.',401);
 const body=await response.json().catch(()=>null) as {error?:{message?:string}}|null;
 throw new DriveError(body?.error?.message||(response.status===403?'This Google account does not have permission for that action.':`Google Drive request failed (${response.status}).`),response.status);
}
export class DriveApi{
 token:string;keys=new Map<string,string>();
 constructor(token:string){this.token=token}
 remember(file:DriveFile){if(file.resourceKey)this.keys.set(file.id,file.resourceKey);if(file.shortcutDetails?.targetResourceKey)this.keys.set(file.shortcutDetails.targetId,file.shortcutDetails.targetResourceKey)}
 async request(path:string,init:RequestInit={}){
  const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+this.token);
  if(this.keys.size)headers.set('X-Goog-Drive-Resource-Keys',[...this.keys].map(([id,key])=>id+'/'+key).join(','));
  return checkDriveResponse(await fetch('https://www.googleapis.com/drive/v3/'+path,{...init,headers,cache:'no-store',credentials:'omit'}));
 }
 async get(id:string,signal?:AbortSignal):Promise<DriveFile>{const file=await (await this.request('files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields='+encodeURIComponent(DRIVE_FIELDS),{signal})).json() as DriveFile;this.remember(file);return file}
 async list(id:string,pageToken?:string,signal?:AbortSignal):Promise<{files:DriveFile[];nextPageToken?:string}>{
  const q=new URLSearchParams({q:`'${id.replace(/['\\]/g,'\\$&')}' in parents and trashed = false`,fields:`nextPageToken,files(${DRIVE_FIELDS})`,pageSize:'100',orderBy:'folder,name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  if(pageToken)q.set('pageToken',pageToken);
  const result=await (await this.request('files?'+q,{signal})).json() as {files:DriveFile[];nextPageToken?:string};result.files.forEach((file:DriveFile)=>this.remember(file));return result;
 }
 /** Missing or trashed folders are deliberately ignored; this never creates folders. */
 async shareFolderByLink(url:string){
  const parsed=parseDriveLink(url);if(!parsed)throw new DriveError('This is not a Google Drive link.');if(parsed.resourceKey)this.keys.set(parsed.id,parsed.resourceKey);
  let folder:DriveFile;
  try{folder=await this.get(parsed.id)}catch(e){if(e instanceof DriveError&&e.status===404)return false;throw e}
  if(folder.trashed)return false;
  if(folder.mimeType!==DRIVE_FOLDER)throw new DriveError('Automatic link sharing applies to project folders, not individual files.');
  let pageToken:string|undefined;
  do{
   const q=new URLSearchParams({supportsAllDrives:'true',pageSize:'100',fields:'nextPageToken,permissions(id,type,role,allowFileDiscovery)'});if(pageToken)q.set('pageToken',pageToken);
   const result=await (await this.request('files/'+encodeURIComponent(folder.id)+'/permissions?'+q)).json() as {permissions:{id:string;type:string;role:string;allowFileDiscovery?:boolean}[];nextPageToken?:string};
   // Existing public access already satisfies the request. Preserve explicit roles.
   if(result.permissions.some(p=>p.type==='anyone'&&['reader','commenter','writer'].includes(p.role)))return true;
   pageToken=result.nextPageToken;
  }while(pageToken);
  if(folder.capabilities?.canShare===false)throw new DriveError('This Google account cannot change sharing for this folder.');
  await this.request('files/'+encodeURIComponent(folder.id)+'/permissions?supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
  return true;
 }
 async reserveFolderId(){const result=await (await this.request('files/generateIds?count=1&space=drive&type=files')).json() as {ids:string[]};if(!result.ids?.[0])throw new DriveError('Could not reserve a new folder. Please retry.');return result.ids[0]}
 async createFolder(parent:DriveFile,name:string,id:string){
  const trimmed=name.trim();if(!trimmed||trimmed.length>255)throw new DriveError('Enter a folder name between 1 and 255 characters.');
  if(parent.mimeType!==DRIVE_FOLDER||parent.capabilities?.canAddChildren!==true)throw new DriveError('You cannot create folders here.');
  try{return await (await this.request('files?supportsAllDrives=true&fields='+encodeURIComponent(DRIVE_FIELDS),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:trimmed,mimeType:DRIVE_FOLDER,parents:[parent.id]})})).json() as DriveFile}
  catch(e){if(e instanceof DriveError&&e.status===409)return this.get(id);throw e}
 }
 async trashFolder(file:DriveFile){
  if(file.mimeType!==DRIVE_FOLDER||file.capabilities?.canTrash!==true)throw new DriveError('This folder cannot be moved to Trash by this account.');
  await this.request('files/'+encodeURIComponent(file.id)+'?supportsAllDrives=true',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});
 }
 async rename(id:string,name:string){return (await this.request('files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields='+encodeURIComponent(DRIVE_FIELDS),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})).json() as Promise<DriveFile>}
 async content(file:DriveFile,signal?:AbortSignal){
  if(file.capabilities?.canDownload===false)throw new DriveError('The owner has disabled downloads and playback for this file.');
  return (await this.request('files/'+encodeURIComponent(file.id)+'?alt=media&supportsAllDrives=true',{signal})).blob();
 }
 async upload(file:File,parent:string,onProgress:(percent:number)=>void,signal:AbortSignal,replaceId?:string):Promise<DriveFile>{
  const type=file.type||'application/octet-stream';
  const headers:Record<string,string>={Authorization:'Bearer '+this.token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':type,'X-Upload-Content-Length':String(file.size)};
  if(this.keys.size)headers['X-Goog-Drive-Resource-Keys']=[...this.keys].map(([id,key])=>id+'/'+key).join(',');
  const start=await checkDriveResponse(await fetch('https://www.googleapis.com/upload/drive/v3/files'+(replaceId?'/'+encodeURIComponent(replaceId):'')+'?uploadType=resumable&supportsAllDrives=true&fields='+encodeURIComponent(DRIVE_FIELDS),{method:replaceId?'PATCH':'POST',headers,body:JSON.stringify(replaceId?{}:{name:file.name,parents:[parent]}),signal,credentials:'omit'}));
  const location=start.headers.get('Location');
  if(!location||new URL(location).origin!=='https://www.googleapis.com')throw new DriveError('Google did not return a valid upload destination.');
  let offset=0,recoveries=0;
  do{
   const end=Math.min(file.size,offset+8*1024*1024);
   let result:Response;
   try{
    result=await fetch(location,{method:'PUT',headers:{'Content-Type':type,'Content-Range':file.size?`bytes ${offset}-${end-1}/${file.size}`:'bytes */0'},body:file.slice(offset,end),signal,credentials:'omit'});
    if(result.status>=500)throw new Error('Temporary upload interruption');
   }catch(error){
    if(signal.aborted||recoveries++>=2)throw error;
    // Ask this same upload session for its offset; never create a duplicate upload.
    result=await fetch(location,{method:'PUT',headers:{'Content-Range':`bytes */${file.size}`},body:new Blob([]),signal,credentials:'omit'});
   }
   await checkDriveResponse(result);
   if(result.status!==308){onProgress(100);return result.json() as Promise<DriveFile>}
   const range=result.headers.get('Range');
   const next=range?Number(range.match(/-(\d+)$/)?.[1])+1:0;
   if(!Number.isFinite(next)||next<0||next>file.size||next===offset&&recoveries++>=2)throw new DriveError('Upload stalled. Refresh the folder before trying again.');
   offset=next;onProgress(file.size?Math.round(offset/file.size*100):0);
  }while(offset<=file.size);
  throw new DriveError('Could not confirm the upload. Refresh the folder before trying again.');
 }
}
