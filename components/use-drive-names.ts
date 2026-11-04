'use client';
import {useEffect,useRef,useState} from 'react';
import {DriveApi,DriveError,DRIVE_FOLDER,parseDriveLink} from '@/lib/drive-files';
import {currentDriveToken,forgetDriveToken,restoreDriveConnection} from '@/lib/google-drive-browser';
import {DriveFolderSetup} from '@/lib/drive-folders';
import type {Project} from '@/lib/projects';
type Saved=Project&{revision:number};
export function useDriveNames(projects:Saved[],paused:boolean,onSaved:(p:Saved)=>void){
 const state=useRef({paused,onSaved});state.current={paused,onSaved};
 const working=useRef(false),alive=useRef(true),requested=useRef(0);
 const [tick,setTick]=useState(0),[error,setError]=useState('');
 const signature=JSON.stringify(projects.map(p=>[p.id,p.client,p.clientId,p.driveClientPending,p.name,p.deliverablesUrl,p.driveNamePending,p.driveNameSynced]));
 useEffect(()=>{
  alive.current=true;const wake=()=>{if(document.visibilityState==='visible')setTick(n=>n+1)};
  const interval=setInterval(wake,15000);
  window.addEventListener('session-drive-auth',wake);window.addEventListener('session-drive-files-changed',wake);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
  return()=>{alive.current=false;clearInterval(interval);window.removeEventListener('session-drive-auth',wake);window.removeEventListener('session-drive-files-changed',wake);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)};
 },[]);
 useEffect(()=>{
  const token=currentDriveToken();if(!token||paused||document.visibilityState!=='visible')return;
  const run=++requested.current;if(working.current)return;
  working.current=true;
  const valid=()=>alive.current&&!state.current.paused&&currentDriveToken()===token;
  void(async()=>{
   try{
    // Read fresh records before changing Drive, including edits made in another tab.
    const response=await fetch('/api/projects',{cache:'no-store'});if(!response.ok)throw new Error('Could not check project folder names.');
    const latest=await response.json() as Saved[];const api=new DriveApi(token);const failures:string[]=[];let folders:DriveFolderSetup|null=null;
    for(const p of latest.sort((a,b)=>Number(!!(b.driveNamePending||b.driveClientPending))-Number(!!(a.driveNamePending||a.driveClientPending)))){
     if(!valid())break;
     const link=parseDriveLink(p.deliverablesUrl||'');if(!link)continue;
     if(link.resourceKey)api.keys.set(link.id,link.resourceKey);
     try{
      let folder=await api.get(link.id);if(!valid())break;
      if(folder.trashed||folder.mimeType!==DRIVE_FOLDER)continue;
      let clientFolder:Awaited<ReturnType<DriveFolderSetup['moveProjectToClient']>>=null;
      if(p.driveClientPending){
       if(!folders){folders=new DriveFolderSetup(api);await folders.initialize();if(!valid())break;}
       clientFolder=await folders.moveProjectToClient(folder.id,p.client);if(!valid())break;
       if(!clientFolder)continue;folder=clientFolder.project;
      }
      if(p.driveNamePending&&folder.name!==p.name){folder=await api.rename(folder.id,p.name);if(!valid())break;}
      if(!p.driveClientPending&&folder.name===p.name&&!p.driveNamePending&&p.driveNameSynced===p.name)continue;
      if(!folder.name.trim()||folder.name.length>160)throw new Error('Use a folder name of 1–160 characters to sync with Session.');
      const saved=await fetch('/api/projects',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,url:p.deliverablesUrl,clientSync:p.driveClientPending?{expectedClient:p.client,expectedClientId:p.clientId}:undefined,nameSync:{expectedName:p.name,expectedPending:!!p.driveNamePending,name:folder.name}})});
      const result=await saved.json() as Saved&{error?:string};if(!saved.ok)throw new Error(result.error||'Could not sync the folder name.');
      if(alive.current){state.current.onSaved(result);window.dispatchEvent(new CustomEvent('session-drive-name-synced',{detail:{id:folder.id,name:folder.name,parent:clientFolder?.parent}}));}
     }catch(e){
      // Deleted project folders are expected after delivery; never notify or recreate them.
      if(e instanceof DriveError&&e.status===404)continue;
      if(e instanceof DriveError&&e.status===401){forgetDriveToken();void restoreDriveConnection();break;}
      failures.push(`${p.client} / ${p.name}: ${(e as Error).message}`);
     }
    }
    if(alive.current)setError(failures[0]||'');
   }catch(e){if(alive.current)setError((e as Error).message)}finally{working.current=false;if(alive.current&&!state.current.paused&&requested.current!==run)setTick(n=>n+1);}
  })();
 },[signature,paused,tick]);
 return error;
}
