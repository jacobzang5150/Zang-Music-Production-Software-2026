'use client';
import {useEffect,useRef,useState} from 'react';
import {DriveApi,DriveError} from '@/lib/drive-files';
import {DriveFolderSetup,folderRequest} from '@/lib/drive-folders';
import {currentDriveToken,forgetDriveToken,keepDriveConnected,restoreDriveConnection} from '@/lib/google-drive-browser';
import type {Project} from '@/lib/projects';
type SavedProject=Project&{revision:number};
const signature=(p:SavedProject)=>JSON.stringify([p.id,p.client,p.name,p.deliverablesUrl||'']);
export function useDriveFolders(projects:SavedProject[],paused:boolean,onSaved:(p:SavedProject)=>void){
 const [token,setToken]=useState<string|null>(null),[running,setRunning]=useState(false),[message,setMessage]=useState(''),[errors,setErrors]=useState<string[]>([]),[epoch,setEpoch]=useState(0);
 const state=useRef({projects,paused,onSaved});state.current={projects,paused,onSaved};
 const working=useRef(false),alive=useRef(true),completed=useRef(new Set<string>()),failed=useRef(new Set<string>()),setup=useRef<DriveFolderSetup|null>(null);
 useEffect(()=>{alive.current=true;const auth=()=>{setToken(currentDriveToken());completed.current.clear();failed.current.clear();setup.current=null;setErrors([])};auth();window.addEventListener('session-drive-auth',auth);const stop=keepDriveConnected();return()=>{stop();alive.current=false;window.removeEventListener('session-drive-auth',auth)}},[]);
 useEffect(()=>{
  if(!token||paused||working.current)return;
  const pending=projects.some(p=>!completed.current.has(signature(p))&&!failed.current.has(signature(p)));if(!pending)return;
  working.current=true;setRunning(true);
  void(async()=>{
   try{
    if(!setup.current){const manager=new DriveFolderSetup(new DriveApi(token));await manager.initialize();if(currentDriveToken()!==token)return;setup.current=manager}
    while(alive.current&&currentDriveToken()===token&&!state.current.paused){
     const project=state.current.projects.find(p=>!completed.current.has(signature(p))&&!failed.current.has(signature(p)));if(!project)break;
     const before=signature(project);setMessage(`Preparing Drive folders · ${project.client} / ${project.name}`);
     try{
      const folder=await setup.current!.project(project);
      if(!alive.current||currentDriveToken()!==token)break;
      const saved=await folderRequest<SavedProject>('PATCH',{projectId:project.id,reservationId:folder.reservation.id,expectedUrl:project.deliverablesUrl||''});
      completed.current.add(before);completed.current.add(signature(saved));state.current.onSaved(saved);
     }catch(e){
      if(e instanceof DriveError&&e.status===401){forgetDriveToken();void restoreDriveConnection();break}
      failed.current.add(before);setErrors(prev=>[...prev,`${project.client} / ${project.name}: ${(e as Error).message}`]);
     }
    }
   }catch(e){if(e instanceof DriveError&&e.status===401)forgetDriveToken();else{for(const p of state.current.projects)failed.current.add(signature(p));setErrors([(e as Error).message])}}
   finally{working.current=false;if(alive.current){setRunning(false);setMessage('');setEpoch(n=>n+1)}}
  })();
 },[token,projects,paused,epoch]);
 function retry(){failed.current.clear();setup.current=null;setErrors([]);setEpoch(n=>n+1)}
 return {connected:!!token,running,message,errors,retry};
}
