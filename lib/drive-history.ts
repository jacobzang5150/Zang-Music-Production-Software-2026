import type {DriveFile} from './drive-files.ts';
type Host=Pick<Window,'location'|'history'|'addEventListener'|'removeEventListener'>;
export function connectDriveHistory(host:Host,onFolder:(path:DriveFile[])=>void,onExit:()=>void,canLeave:()=>boolean,onState:(back:boolean,forward:boolean)=>void){
 const key='sessionDriveNavigation',session=crypto.randomUUID();let cursor=0;const paths:DriveFile[][]=[];
 const state=(position:number)=>({...host.history.state,[key]:{session,position}});
 const notify=()=>onState(cursor>0,cursor<paths.length-1);
 // Opening Drive adds a boundary so Back exits Drive without leaving the project.
 host.history.pushState(state(0),'',host.location.href);
 const pop=()=>{
  const entry=host.history.state?.[key];
  if(entry?.session!==session){if(!canLeave()){host.history.go(1);return}onExit();return}
  const next=entry.position;if(!paths[next])return;
  if(!canLeave()){if(next!==cursor)host.history.go(cursor-next);return}
  cursor=next;notify();onFolder(paths[cursor]);
 };
 host.addEventListener('popstate',pop);
 return {
  record(path:DriveFile[]){if(!path.length)return;if(!paths.length){paths.push([...path]);host.history.replaceState(state(0),'',host.location.href)}else if(paths[cursor].at(-1)?.id===path.at(-1)?.id){paths[cursor]=[...path]}else{paths.splice(cursor+1);paths.push([...path]);cursor++;host.history.pushState(state(cursor),'',host.location.href)}notify()},
  back(){host.history.go(-1)},forward(){if(cursor<paths.length-1)host.history.go(1)},
  dispose(){host.removeEventListener('popstate',pop);if(host.history.state?.[key]?.session===session){const next={...host.history.state};delete next[key];host.history.replaceState(next,'',host.location.href)}}
 };
}
