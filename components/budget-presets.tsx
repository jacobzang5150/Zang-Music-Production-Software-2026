'use client';
import {useEffect,useState} from 'react';
import {createBudget} from '@/lib/budget';
import {readBudgetModel,type BudgetModel} from '@/lib/budget-model';
export default function BudgetPresets({model,change}:{model:BudgetModel;change:(m:BudgetModel)=>void}){
 const [items,set]=useState<{name:string;model:BudgetModel}[]>([]),[selection,select]=useState('Template'),[name,rename]=useState(''),[message,msg]=useState(''),[busy,wait]=useState(false);
 async function reload(){const r=await fetch('/api/templates',{cache:'no-store'});if(!r.ok)throw Error('Could not load templates.');set(await r.json())}
 useEffect(()=>{reload().catch(e=>msg(e.message))},[]);
 async function save(){wait(true);try{const r=await fetch('/api/templates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,model})});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);await reload();select(name.trim());rename('');msg('Template saved.')}catch(e){msg((e as Error).message)}finally{wait(false)}}
 return <details className="rr-presets"><summary>Budget templates</summary><p>Set your rates here, then save them as a template for your next project.</p><label>Saved templates<select value={selection} onChange={e=>select(e.target.value)}><option>Template</option>{items.map(t=><option key={t.name}>{t.name}</option>)}</select></label><button onClick={()=>{const template=items.find(t=>t.name===selection)?.model||readBudgetModel(createBudget({id:'preset',name:'Template',client:''}));if(confirm('Replace expense rows and quantities for this budget?')){change({...model,sections:structuredClone(template.sections)});msg('Template applied.')}}}>Load template</button><label>Template name<input maxLength={80} value={name} onChange={e=>rename(e.target.value)}/></label><button disabled={busy||!name.trim()} onClick={()=>{if(!items.some(t=>t.name===name.trim())||confirm('Replace this saved template?'))void save()}}>Save as template</button><small role="status">{message}</small></details>
}
