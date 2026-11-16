import {DriveApi,DriveError,DRIVE_FOLDER,driveFileUrl,parseDriveLink} from './drive-files.ts';
import {normalizeFolderName} from './drive-folders.ts';
/** Only share the direct, correctly named client parent. Never share My Drive or
 * an unrelated ancestor, and never create or restore missing folders. */
export async function shareProjectClientFolder(api:DriveApi,project:{client:string;deliverablesUrl?:string},shared:Set<string>){
 const link=parseDriveLink(project.deliverablesUrl||'');if(!link)return;
 if(link.resourceKey)api.keys.set(link.id,link.resourceKey);
 try{
  const folder=await api.get(link.id);if(folder.trashed||folder.mimeType!==DRIVE_FOLDER)return;
  for(const id of folder.parents||[]){
   if(shared.has(id))continue;
   const parent=await api.get(id);
   if(parent.trashed||parent.mimeType!==DRIVE_FOLDER||normalizeFolderName(parent.name)!==normalizeFolderName(project.client))continue;
   // The Drive root must never become publicly accessible, even for a client
   // whose name happens to be “My Drive”.
   const root=await api.get('root');if(parent.id===root.id)continue;
   if(await api.shareFolderByLink(driveFileUrl(parent)))shared.add(parent.id);
  }
 }catch(error){if(error instanceof DriveError&&error.status===404)return;throw error}
}
