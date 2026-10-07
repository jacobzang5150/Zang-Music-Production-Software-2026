'use client';
import {ChartNoAxesColumnIncreasing,ArrowUpRight} from 'lucide-react';
import {projectBars,type Project} from '@/lib/projects';
export default function ProjectGraphs({projects,loaded,onOpen}:{projects:Project[];loaded:boolean;onOpen:(id:string)=>void}){
 const bars=projectBars(projects);
 return <section aria-labelledby="graphs-title"><div className="title-row"><div><h1 id="graphs-title">Graphs</h1><p>Current completion for every project and overdub.</p></div></div>
 {!loaded?<div className="empty">Loading project progress…</div>:bars.length===0?<div className="empty"><div className="empty-icon"><ChartNoAxesColumnIncreasing size={28}/></div><h2>No projects yet</h2><p>Create a project or overdub to see its completion here.</p></div>:<figure className="completion-chart" aria-label="Project completion bar graph"><figcaption><div><h2>Project completion</h2><p>{bars.length} {bars.length===1?'project':'projects'} · 0–100%</p></div><span className="chart-legend"><i/>Completed</span></figcaption><div className="chart-scale" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div className="chart-rows">{bars.map(p=><button className="chart-row" key={p.id} onClick={()=>onOpen(p.id)} aria-label={`Open ${p.name} by ${p.client}, ${Number(p.value.toFixed(1))}% complete`}><span className="chart-label"><strong>{p.name}</strong><small>{p.client} · {p.type}</small></span><span className="chart-track" aria-hidden="true"><i style={{width:`${p.value}%`}}/></span><span className="chart-value">{Number(p.value.toFixed(1))}%<ArrowUpRight size={14}/></span></button>)}</div><p className="chart-note">Select a bar to open its project. Completion updates when you check off a stage.</p></figure>}
 </section>;
}
