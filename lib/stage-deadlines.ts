import type {Project} from './projects.ts';
export function nextStageDeadline(projects:Project[]){
 return projects.filter(p=>!p.deliveredAt&&!p.onHold).flatMap(project=>project.stages.flatMap(stage=>{
  const dueAt=Date.parse(stage.deadline||'');
  const remaining=project.songs.filter(song=>!song.completed.includes(stage.id)).length;
  return Number.isFinite(dueAt)&&remaining?[{project,stage,dueAt,remaining}]:[];
 })).sort((a,b)=>a.dueAt-b.dueAt||a.project.client.localeCompare(b.project.client)||a.project.name.localeCompare(b.project.name)||a.project.stages.indexOf(a.stage)-b.project.stages.indexOf(b.stage))[0]||null;
}
export function stageCountdown(deadline:string,now:Date){
 const difference=Date.parse(deadline)-now.getTime();
 if(!Number.isFinite(difference))return '';
 if(difference===0)return 'Due now';
 const minutes=Math.max(1,Math.ceil(Math.abs(difference)/60000));
 const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),remaining=minutes%60;
 const text=[days?`${days}d`:'',hours?`${hours}h`:'',remaining?`${remaining}m`:''].filter(Boolean).join(' ');
 return difference<=0?`Overdue by ${text}`:`${text} left`;
}
export function localStageDeadline(value?:string){
 if(!value)return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
