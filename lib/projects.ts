import { z } from 'zod';
const id=z.string().min(1).max(80);
export const ProjectSchema=z.object({id,client:z.string().trim().min(1).max(120),name:z.string().trim().min(1).max(160),type:z.enum(['LP','EP','Single']),deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}),priority:z.number().int().min(1).max(5),stages:z.array(z.object({id,name:z.string().trim().min(1).max(80),weight:z.number().min(0).max(100)})).min(1).max(30),songs:z.array(z.object({id,name:z.string().trim().min(1).max(160),completed:z.array(id)})).min(1).max(100)}).superRefine((p,c)=>{if(Math.abs(p.stages.reduce((s,x)=>s+x.weight,0)-100)>.001)c.addIssue({code:'custom',message:'Stage weights must total 100%'});if(p.type==='Single'&&p.songs.length!==1)c.addIssue({code:'custom',message:'Singles need exactly one song'});if(new Set(p.stages.map(x=>x.id)).size!==p.stages.length||new Set(p.songs.map(x=>x.id)).size!==p.songs.length)c.addIssue({code:'custom',message:'Duplicate IDs'});if(p.songs.some(s=>s.completed.some(id=>!p.stages.some(t=>t.id===id))))c.addIssue({code:'custom',message:'Unknown stage'});});
export type Project=z.infer<typeof ProjectSchema>;
export function songProgress(p:Project,s:Project['songs'][number]){return p.stages.reduce((v,t)=>v+(s.completed.includes(t.id)?t.weight:0),0);}
export function progress(p:Project){return p.songs.reduce((v,s)=>v+songProgress(p,s),0)/p.songs.length;}
export function daysLeft(p:Project,today=new Date()){const day=new Date(today.getFullYear(),today.getMonth(),today.getDate());const [y,m,d]=p.deadline.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(day.getFullYear(),day.getMonth(),day.getDate()))/86400000);}
export function score(p:Project,today=new Date()){const remaining=p.songs.reduce((v,s)=>v+(100-songProgress(p,s))/100,0);if(remaining<.00001)return 0;const days=daysLeft(p,today);return p.priority*remaining/Math.max(1,days+1);}
export function rankProjects(ps:Project[],today=new Date()){return [...ps].filter(p=>progress(p)<99.9999).sort((a,b)=>{const da=daysLeft(a,today),db=daysLeft(b,today);return Number(db<0)-Number(da<0)||score(b,today)-score(a,today)||da-db||a.name.localeCompare(b.name);});}

/** Move a stage in 5-point steps, consuming/giving weight only below it. */
export function adjustStageWeight(stages:Project['stages'],index:number,requested:number):Project['stages'] {
  if(index<0||index>=stages.length-1||!Number.isFinite(requested))return stages;
  const result=stages.map(s=>({...s}));
  const available=100-result.slice(0,index).reduce((sum,s)=>sum+s.weight,0);
  const weight=Math.max(0,Math.min(available,Math.round(requested/5)*5));
  let difference=weight-result[index].weight;
  result[index].weight=weight;
  if(difference<0)result[index+1].weight-=difference;
  else for(let i=index+1;i<result.length&&difference>0;i++){
    const take=Math.min(result[i].weight,difference);
    result[i].weight-=take;difference-=take;
  }
  return result;
}
/** Deleting a stage gives its weight to the next stage, or the new last stage. */
export function removeStage(stages:Project['stages'],index:number):Project['stages'] {
  if(stages.length===1||index<0||index>=stages.length)return stages;
  const result=stages.filter((_,i)=>i!==index).map(s=>({...s}));
  result[Math.min(index,result.length-1)].weight+=stages[index].weight;
  return result;
}
