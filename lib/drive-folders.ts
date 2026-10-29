import {DriveApi,DriveError,DRIVE_FOLDER,DRIVE_FIELDS,parseDriveLink,type DriveFile} from './drive-files.ts';
import type {FolderReservation} from './drive-folders-schema.ts';
export const normalizeFolderName=(name:string)=>name.trim().normalize('NFKC').toLowerCase();
// The saved link is the durable completion marker, including links created before this rule.
export function needsDriveFolderSetup(project:{deliverablesUrl?:string}){return !project.deliverablesUrl?.trim()}
export function needsDriveLinkSharing(project:{deliverablesUrl?:string;driveSharingProcessedUrl?:string}){return !!project.deliverablesUrl&&!!parseDriveLink(project.deliverablesUrl)&&project.driveSharingProcessedUrl!==project.deliverablesUrl}
const quote=(value:string)=>value.replace(/['\\]/g,'\\$&');
export async function folderKey(account:string,key:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([account,key])));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
export async function folderRequest<T>(method:string,body?:unknown):Promise<T>{
 const r=await fetch('/api/drive/folders',{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await r.json() as T&{error?:string};if(!r.ok)throw new Error(data.error||'Could not save Drive folder setup.');return data as T;
}
/** Supabase elects one pre-generated Drive ID before any create request is sent. */
export class DriveFolderSetup{
 api:DriveApi;account='';root='';records=new Map<string,FolderReservation>();verified=new Map<string,DriveFile>();
 constructor(api:DriveApi){this.api=api}
 async initialize(){
  const about=await (await this.api.request('about?fields=user(permissionId)')).json() as {user:{permissionId:string}};
  if(!about.user?.permissionId)throw new Error('Could not identify your Google Drive account.');this.account=about.user.permissionId;
  this.root=(await this.api.get('root')).id;
  const records=await folderRequest<FolderReservation[]>('GET');for(const record of records)if(record.account===this.account)this.records.set(record.id,record);
 }
 async find(name:string,parent?:string){
  let pageToken:string|undefined;
  do{
   const params=new URLSearchParams({q:`mimeType = '${DRIVE_FOLDER}' and trashed = false and ${parent?`'${quote(parent)}' in parents`:"'me' in owners"}`,fields:`nextPageToken,files(${DRIVE_FIELDS})`,pageSize:'1000',orderBy:'createdTime',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
   if(pageToken)params.set('pageToken',pageToken);
   const result=await (await this.api.request('files?'+params)).json() as {files:DriveFile[];nextPageToken?:string};
   const match=result.files.find(file=>normalizeFolderName(file.name)===normalizeFolderName(name));if(match)return match;pageToken=result.nextPageToken;
  }while(pageToken);
 }
 async ensure(key:string,name:string,parent:string,client=false):Promise<{file:DriveFile;reservation:FolderReservation}>{
  const id=await folderKey(this.account,key);let reservation=this.records.get(id);
  if(!reservation){
   const existing=await this.find(name,client?undefined:parent);
   const generated=existing?existing.id:((await (await this.api.request('files/generateIds?count=1&space=drive&type=files')).json()) as {ids:string[]}).ids[0];
   if(!generated)throw new Error('Google could not reserve a folder ID. Please retry.');
   reservation=await folderRequest<FolderReservation>('PUT',{id,account:this.account,folderId:generated,parent:existing?.parents?.[0]||parent,name,mayCreate:!existing});
   this.records.set(id,reservation);
  }
  let file=this.verified.get(reservation.folderId);
  if(!file){
   try{file=await this.api.get(reservation.folderId)}catch(e){
    if(!(e instanceof DriveError)||e.status!==404||!reservation.mayCreate)throw e;
    try{
     file=await (await this.api.request('files?supportsAllDrives=true&fields='+encodeURIComponent(DRIVE_FIELDS),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:reservation.folderId,name:reservation.name,mimeType:DRIVE_FOLDER,parents:[reservation.parent],appProperties:{sessionFolder:id}})})).json() as DriveFile;
    }catch(createError){
     // A concurrent device or a lost response may have already created this exact ID.
     if(createError instanceof DriveError&&createError.status!==409)throw createError;
     file=await this.api.get(reservation.folderId);
    }
   }
   if(file.trashed)throw new Error(`“${file.name}” is in Drive Trash. Restore it, then retry folder setup.`);
   if(file.mimeType!==DRIVE_FOLDER||file.capabilities?.canAddChildren===false)throw new Error(`Cannot add files to “${file.name}”. Check this folder’s Drive permissions.`);
   if(!client&&!file.parents?.includes(parent))throw new Error(`“${file.name}” was moved out of its client/project folder. Move it back, then retry.`);
   this.verified.set(file.id,file);
  }
  return {file,reservation};
 }
 async project(project:{id:string;client:string;name:string}){
  const client=await this.ensure('client:'+normalizeFolderName(project.client),project.client.trim(),this.root,true);
  const folder=await this.ensure('project:'+project.id,project.name.trim(),client.file.id);
  for(const name of ['EDITS','MIXES','MASTERS'])await this.ensure('child:'+folder.file.id+':'+name,name,folder.file.id);
  return folder;
 }
}
