'use client';
import {useEffect,useState} from 'react';
import {createBudget} from '@/lib/budget';
import {readBudgetModel,type BudgetModel} from '@/lib/budget-model';
import {preset} from '@/lib/rr-preset';
const starter=()=>readBudgetModel(createBudget({id:'preset',name:'Current',client:''}));
type Item={name:string;model:BudgetModel};
export default function BudgetPresets({model,change,open,setOpen}:{model:BudgetModel;change:(m:BudgetModel)=>void;open:boolean;setOpen:(open:boolean)=>void}){
 const [items,setItems]=useState<Item[]>([]),[selection,select]=useState('current'),[name,setName]=useState(''),[draft,edit]=useState(starter),[makeDefault,setDefault]=useState(true),[defaultName,setDefaultName]=useState(''),[message,msg]=useState(''),[busy,wait]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let live=true;async function load(){
  const r=await fetch('/api/templates',{cache:'no-store'});if(!r.ok)throw Error('Could not load templates.');const data=await r.json() as {items:Item[];seen:boolean;defaultName:string};
  if(!live)return;setItems(data.items);setDefaultName(data.defaultName);setLoaded(true);
  if(!data.seen){setOpen(true);const seen=await fetch('/api/templates',{method:'PATCH'});if(!seen.ok&&live)msg('Could not remember your first visit.')}
 }load().catch(e=>{if(live)msg(e.message)});return()=>{live=false}},[setOpen]);
 function choose(key:string){select(key);msg('');const saved=items.find(t=>'saved:'+t.name===key);edit(structuredClone(saved?.model||(key==='project'?preset(model):starter())));setName(saved?.name||'')}
 async function save(){const title=name.trim();if(items.some(t=>t.name===title)&&!confirm('Replace this saved template?'))return;
 wait(true);try{const r=await fetch('/api/templates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:title,model:draft,makeDefault})});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);setItems(old=>[...old.filter(t=>t.name!==title),{name:title,model:preset(draft)}].sort((a,b)=>a.name.localeCompare(b.name)));select('saved:'+title);if(makeDefault)setDefaultName(title);msg(makeDefault?'Default saved for future projects.':'Template saved.')}catch(e){msg((e as Error).message)}finally{wait(false)}}
 if(!open)return null;
 return <section className="rr-presets rr-template-editor" aria-label="Budget templates"><div className="rr-template-heading"><h3>Templates</h3><button onClick={()=>setOpen(false)}>Done</button></div><p>Choose your usual rates for future projects. Your current budget stays unchanged unless you apply the template.</p><label>Starting template<select value={selection} onChange={e=>choose(e.target.value)}><option value="current">Current</option><option value="project">This project's budget</option>{items.map(t=><option key={t.name} value={'saved:'+t.name}>{t.name}{t.name===defaultName?' (default)':''}</option>)}</select></label>
 <div className="rr-template-rates">{draft.sections.map((s,si)=><fieldset key={s.id}><legend>{s.name}</legend>{s.rows.map((r,ri)=><label key={r.id}><span>{r.name||r.details||'Item'}</span><input type="number" min={0} max={1e9} step="any" placeholder="0" aria-label={s.name+' '+r.name+' rate'} value={r.rate??''} onChange={e=>{const rate=e.target.value===''?null:Math.min(1e9,Math.max(0,Number(e.target.value)));edit(d=>({...d,sections:d.sections.map((v,i)=>i!==si?v:{...v,rows:v.rows.map((row,j)=>j===ri?{...row,rate}:row)})}))}}/><small>/ {r.unit}</small></label>)}</fieldset>)}</div>
 <label>Template name<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="My studio rates"/></label><label><input type="checkbox" checked={makeDefault} onChange={e=>setDefault(e.target.checked)}/> Default for future projects</label><div><button disabled={busy||!loaded||!name.trim()} onClick={save}>Save template</button><button disabled={busy||!loaded} onClick={()=>{if(confirm('Replace this budget’s expense rows and quantities?')){change({...model,sections:structuredClone(draft.sections)});msg('Applied to this budget.')}}}>Apply to this budget</button></div><small role="status">{message}</small></section>
}
