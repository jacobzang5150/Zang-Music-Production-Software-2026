'use client';
import {useEffect,useRef,useState} from 'react';
import {connectWorkspaceHistory,type WorkspaceRoute} from '@/lib/navigation';

export function useWorkspaceNavigation(beforeBackOrForward:()=>boolean){
 const [route,setRoute]=useState<WorkspaceRoute>({view:'Projects',selected:null});
 const controller=useRef<ReturnType<typeof connectWorkspaceHistory>|null>(null);
 const guard=useRef(beforeBackOrForward);guard.current=beforeBackOrForward;
 useEffect(()=>{
  const history=connectWorkspaceHistory(window,setRoute,()=>guard.current());
  controller.current=history;
  return()=>{history.dispose();controller.current=null};
 },[]);
 return {...route,navigate:(next:WorkspaceRoute,replace=false)=>controller.current?.navigate(next,replace)};
}
