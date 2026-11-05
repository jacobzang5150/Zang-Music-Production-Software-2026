'use client';
import {useState} from 'react';
import {Link2,Unlink} from 'lucide-react';
import type {SavedBudget} from '@/lib/budget-sharing';
export default function BudgetSharing({budget,busy,onChange}:{budget:SavedBudget;busy:boolean;onChange:(action:'link'|'unlink',targetId?:string)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[target,setTarget]=useState('');
 const members=budget.linkedProjects||[],choices=budget.availableProjects||[],shared=budget.budgetKey?.startsWith('shared:');
 return <section className="budget-sharing" aria-label="Budget sharing">
  <div className="budget-sharing-bar"><div><strong>{shared?'Shared budget':'Separate budget'}</strong>{shared&&<span>{members.map(p=>p.client+' — '+p.name).join(' · ')}</span>}</div><button type="button" className="budget-text-button" disabled={busy} aria-expanded={open} onClick={()=>setOpen(!open)}><Link2 size={15}/>{open?'Close links':'Link projects'}</button></div>
  {shared&&<p className="budget-sharing-caption">Expenses, sessions, estimate, and totals apply to all linked projects.</p>}
  {open&&<div className="budget-sharing-panel">
   <label>Use another project’s budget<select aria-label="Project budget to share" value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">Choose a project…</option>{choices.map(p=><option key={p.id} value={p.id}>{p.client} — {p.name}</option>)}</select></label>
   <p>This project will use the selected project’s budget. Separate budgets stay saved; expenses are not merged.</p>
   <button type="button" className="secondary" disabled={busy||!target} onClick={async()=>{if(await onChange('link',target)){setTarget('');setOpen(false)}}}><Link2 size={15}/> Share selected budget</button>
   {shared&&<div className="budget-unlink"><p>Unlink to restore this project’s separate budget from before linking. The shared budget stays with the other projects.</p><button type="button" className="budget-text-button" disabled={busy} onClick={async()=>{if(await onChange('unlink')){setTarget('');setOpen(false)}}}><Unlink size={15}/> Restore separate budget</button></div>}
  </div>}
 </section>;
}
