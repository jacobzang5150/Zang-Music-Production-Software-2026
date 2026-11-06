'use client';
import {useState} from 'react';
import {Link2,X} from 'lucide-react';
import type {SavedBudget} from '@/lib/budget-sharing';
export default function BudgetSharing({budget,busy,open,onClose,onChange}:{budget:SavedBudget;busy:boolean;open:boolean;onClose:()=>void;onChange:(action:'link'|'unlink',targetId?:string)=>Promise<boolean>}){
 const [target,setTarget]=useState('');
 const choices=budget.availableProjects||[],shared=budget.budgetKey?.startsWith('shared:');
 if(!open)return null;
 return <section id="budget-sharing-panel" className="budget-sharing" aria-label="Budget sharing">
  <div className="budget-sharing-panel-heading"><strong>Link Projects</strong><button type="button" className="budget-text-button" aria-label="Close budget links" disabled={busy} onClick={onClose}><X size={16}/></button></div>
  <div className="budget-sharing-panel">
   <label>{shared?'Add another project to this budget':'Use another project’s budget'}<select aria-label="Project budget to share" value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">Choose a project…</option>{choices.map(p=><option key={p.id} value={p.id}>{p.client} — {p.name}</option>)}</select></label>
   <p>{shared?'The selected project will join this shared budget. Existing links and expenses stay in place.':'This project will use the selected project’s budget. Separate budgets stay saved; expenses are not merged.'}</p>
   <button type="button" className="secondary" disabled={busy||!target} onClick={async()=>{if(await onChange('link',target)){setTarget('')}}}><Link2 size={15}/>{shared?'Add project to budget':'Share selected budget'}</button>

  </div>
 </section>;
}
