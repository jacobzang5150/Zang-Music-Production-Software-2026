'use client';
import {ArrowUpRight,Disc3,CalendarClock} from 'lucide-react';
import {daysLeft,type Project} from '@/lib/projects';
import {nextStageDeadline,stageCountdown} from '@/lib/stage-deadlines';
export default function NextSessionCards({project,projects,now,onOpen}:{project?:Project;projects:Project[];now:Date;onOpen:(id:string)=>void}){
 const next=nextStageDeadline(projects);
 const days=project?daysLeft(project,now):Infinity;
 const due=project?.deadline?(days<0?`${-days}d overdue`:days===0?'Due today':`${days}d left`):'No deadline';
 return <div className={'next-session-cards'+(next?' has-stage-deadline':'')}>
 {project&&<button type="button" className="focus" aria-label={`Open project: ${project.client} — ${project.name}`} onClick={()=>onOpen(project.id)}><div className="focus-art"><Disc3 size={60}/></div><div className="focus-copy"><div className="eyebrow">YOUR NEXT SESSION <span>RECOMMENDED PROJECT</span></div><h2>{project.client}</h2><p>{project.name} <b>·</b> <span className={days<0?'late':''}>{due}</span></p></div><span className="focus-open" aria-hidden="true">Open project <ArrowUpRight size={17}/></span></button>}
 {next&&<button type="button" className={'focus stage-deadline-focus'+(next.dueAt<=now.getTime()?' is-overdue':'')} aria-label={`Open ${next.stage.name} deadline: ${next.project.client} — ${next.project.name}`} onClick={()=>onOpen(next.project.id)}><div className="focus-art"><CalendarClock size={48}/></div><div className="focus-copy"><div className="eyebrow">YOUR NEXT SESSION <span>STAGE DEADLINE</span></div><h2>{next.project.client}</h2><p>{next.project.name}</p><div className="deadline-stage-name">{next.stage.name}</div><strong className="stage-countdown" role="timer">{stageCountdown(next.stage.deadline!,now)}</strong><p>Due <time suppressHydrationWarning dateTime={next.stage.deadline}>{new Date(next.dueAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time>{next.project.songs.length>1?` · ${next.remaining} of ${next.project.songs.length} songs remaining`:''}</p></div><span className="focus-open" aria-hidden="true"><ArrowUpRight size={17}/></span></button>}
 </div>;
}
