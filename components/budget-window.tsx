'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {Download,Upload,X,RotateCcw,Plus,Trash2,ChevronRight} from 'lucide-react';
import {BudgetSchema,type Budget} from '@/lib/budget';
import {BudgetModelSchema,readBudgetModel,writeBudgetModel,newBudgetLine,isPianoTuning,lineTotal,sectionTotal,budgetTotal,budgetRemaining,groupBudgetRows,type BudgetModel,type BudgetLine} from '@/lib/budget-model';
import './budget.css';
type SavedBudget=Budget&{revision:number};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const units=[['song','per song'],['hour','per hour'],['day','per day'],['session','per session'],['tuning','per tuning']] as const;
const numberValue=(value:string,max:number)=>value===''?null:Math.min(max,Math.max(0,Number(value)||0));
export default function BudgetWindow({project,importFile,onClose}:{project:{id:string;client:string;name:string};importFile:File|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const [model,setModel]=useState<BudgetModel|null>(null),[status,setStatus]=useState('Opening budget…'),[error,setError]=useState(''),[working,setWorking]=useState(false),[undo,setUndo]=useState<BudgetModel|null>(null);
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const record=useRef<SavedBudget|null>(null),modelRef=useRef<BudgetModel|null>(null),pending=useRef<BudgetModel|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),saving=useRef<Promise<boolean>|null>(null),imported=useRef(false),mounted=useRef(true);
 const flush=useCallback(async():Promise<boolean>=>{
  if(timer.current)clearTimeout(timer.current);
  if(saving.current){if(!await saving.current)return false;return flush()}
  if(!pending.current||!record.current)return true;
  const run=async()=>{
   while(pending.current&&record.current){
    const next=pending.current;setStatus('Saving…');setError('');
    try{
     const snapshot={...writeBudgetModel(record.current,BudgetModelSchema.parse(next)),revision:record.current.revision};
     const checked=BudgetSchema.safeParse(snapshot);if(!checked.success)throw new Error(checked.error.issues[0].message);
     const r=await fetch('/api/budget',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
     const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not save. Retry when connected.');
     record.current={...snapshot,revision:data.revision};if(pending.current===next)pending.current=null;
    }catch(e){setStatus('Not saved');setError((e as Error).message);return false}
   }
   setStatus('Saved');return true;
  };
  saving.current=run();const ok=await saving.current;saving.current=null;return ok;
 },[]);
 const changed=useCallback((next:BudgetModel)=>{
  setUndo(null);modelRef.current=next;setModel(next);pending.current=next;setStatus('Waiting to save…');
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),650);
 },[flush]);
 const replace=useCallback(async(file:File)=>{
  setWorking(true);setError('');
  try{
   if(!await flush())return;
   const {importBudgetExcel}=await import('@/lib/budget-excel');
   const next=await importBudgetExcel(file),previous=modelRef.current;changed(next);setUndo(previous);await flush();
  }catch(e){setError((e as Error).message||'Could not open this budget. Your existing budget is unchanged.')}
  finally{setWorking(false);if(input.current)input.current.value=''}
 },[flush,changed]);
 useEffect(()=>{
  mounted.current=true;dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const warn=(e:BeforeUnloadEvent)=>{if(pending.current||saving.current){e.preventDefault();e.returnValue=''}};
  const online=()=>void flush();window.addEventListener('beforeunload',warn);window.addEventListener('online',online);
  return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);document.body.style.overflow=overflow;window.removeEventListener('beforeunload',warn);window.removeEventListener('online',online)};
 },[flush]);
 const load=useCallback(async()=>{
  setError('');setStatus('Opening budget…');
  try{
   const r=await fetch('/api/budget?id='+encodeURIComponent(project.id));const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not open the budget.');
   if(!mounted.current)return;const next=readBudgetModel(data);record.current=data;modelRef.current=next;pending.current=null;setModel(next);setUndo(null);setStatus('Saved');
   if(importFile&&!imported.current){imported.current=true;await replace(importFile)}
  }catch(e){setStatus('Not loaded');setError((e as Error).message)}
 },[project.id,importFile,replace]);
 useEffect(()=>{void load()},[load]);
 async function close(){if(working)return;setWorking(true);try{if(await flush()){dialog.current?.close();onClose()}}finally{if(mounted.current)setWorking(false)}}
 async function download(){if(!modelRef.current)return;setError('');try{const {exportBudgetExcel}=await import('@/lib/budget-excel');const blob=await exportBudgetExcel(modelRef.current,project),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.client} - ${project.name} - Budget.xlsx`.replace(/[\\/:*?"<>|]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setError('Could not export this budget. Please retry.')}}
 function updateRow(sectionId:string,rowId:string,patch:Partial<BudgetLine>){if(!model)return;changed({...model,sections:model.sections.map(section=>section.id!==sectionId?section:{...section,rows:section.rows.map(row=>{if(row.id!==rowId)return row;const next={...row,...patch};if(next.unit==='tuning'&&!isPianoTuning(next.name))next.unit='hour';return next})})})}
 function renameCategory(sectionId:string,categoryId:string,name:string){
  if(!model)return;const section=model.sections.find(s=>s.id===sectionId),category=section&&groupBudgetRows(section.rows).find(c=>c.id===categoryId);if(!category)return;
  const ids=new Set(category.rows.map(row=>row.id));
  changed({...model,sections:model.sections.map(s=>s.id!==sectionId?s:{...s,rows:s.rows.map(row=>ids.has(row.id)?{...row,categoryId,name,unit:row.unit==='tuning'&&!isPianoTuning(name)?'hour':row.unit}:row)})});
 }
 function addCategoryItem(sectionId:string,categoryId:string){
  if(!model)return;const section=model.sections.find(s=>s.id===sectionId),category=section&&groupBudgetRows(section.rows).find(c=>c.id===categoryId);if(!category)return;
  const ids=new Set(category.rows.map(row=>row.id)),lastIndex=Math.max(...category.rows.map(row=>section!.rows.indexOf(row)));
  const rows=section!.rows.map(row=>ids.has(row.id)?{...row,categoryId}:row);
  rows.splice(lastIndex+1,0,{...newBudgetLine(),categoryId,name:category.name,unit:category.rows[0].unit});
  changed({...model,sections:model.sections.map(s=>s.id===sectionId?{...s,rows}:s)});
 }
 function remove(next:BudgetModel){const previous=model;changed(next);setUndo(previous)}
 return <dialog ref={dialog} className="budget-dialog" aria-labelledby="budget-title" onCancel={e=>{e.preventDefault();void close()}} onClick={e=>{if(e.target===dialog.current)void close()}}><div className="budget-frame" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();if(!working&&record.current&&e.dataTransfer.files[0])void replace(e.dataTransfer.files[0])}}>
  <div className="budget-toolbar"><div><div className="budget-eyebrow">PROJECT BUDGET</div><h2 id="budget-title">{project.client} <span>— {project.name}</span></h2><small role="status">{status}</small></div><div className="budget-actions"><input ref={input} type="file" accept=".xlsx" hidden onChange={e=>{if(e.target.files?.[0])void replace(e.target.files[0])}}/><button className="secondary" aria-label="Import .xlsx" disabled={!model||working} onClick={()=>input.current?.click()}><Upload size={16}/><span>Import .xlsx</span></button><button className="secondary" aria-label="Download .xlsx" disabled={!model||working} onClick={()=>void download()}><Download size={16}/><span>Download .xlsx</span></button><button className="budget-close" aria-label="Close budget" disabled={working} onClick={()=>void close()}><X size={22}/></button></div></div>
  {error&&<div className="budget-error" role="alert">{error}<button onClick={()=>void(model?flush():load())}><RotateCcw size={14}/> Retry</button>{model&&<button onClick={()=>{if(confirm('Discard unsaved budget changes and reload the saved budget?'))void load()}}>Reload saved budget</button>}</div>}
  <div className="budget-scroll">{!model?<div className="budget-placeholder">{status}</div>:<>
   <div className="budget-body-title">{undo&&<button className="budget-text-button" disabled={working} onClick={()=>{changed(undo);setUndo(null)}}><RotateCcw size={14}/> Undo removal / import</button>}<div className="budget-summary"><label className="budget-estimate"><span>AGREED ESTIMATE</span><div><span aria-hidden="true">$</span><input aria-label="Agreed project estimate" type="number" inputMode="decimal" min={0} max={1e12} step="any" placeholder="0.00" disabled={working} value={model.estimate??''} onChange={e=>changed({...model,estimate:numberValue(e.target.value,1e12)})}/></div></label><span className="budget-total-caption">PROJECT TOTAL <strong>{money.format(budgetTotal(model))}</strong></span><span className={'budget-total-caption budget-remaining'+((budgetRemaining(model)??0)<0?' is-over-budget':'')}><span>{(budgetRemaining(model)??0)<0?'OVER BUDGET':'REMAINING'}</span><output aria-label="Remaining project budget">{budgetRemaining(model)===null?'—':money.format(Math.abs(budgetRemaining(model)!))}</output></span></div></div>
   <fieldset className="budget-fields" disabled={working}><div className="budget-layout"><div className="budget-expenses">
    {model.sections.map(section=><div className="budget-section" key={section.id}>
     <div className="budget-columns budget-section-heading"><label className="budget-section-name"><span className="sr-only">Section name</span><input aria-label={`Section name: ${section.name}`} maxLength={200} value={section.name} placeholder="Section name" onChange={e=>changed({...model,sections:model.sections.map(s=>s.id===section.id?{...s,name:e.target.value}:s)})}/></label><span>Rate</span><span>Quantity</span><span>Total</span><button className="budget-remove" aria-label={`Remove section ${section.name}`} title="Remove section" disabled={model.sections.length===1} onClick={()=>remove({...model,sections:model.sections.filter(s=>s.id!==section.id)})}><Trash2 size={15}/></button></div>
     {groupBudgetRows(section.rows).map(category=>{
      const key=section.id+'-'+category.id,open=!collapsed[key],contentId='budget-category-'+key.replace(/[^a-zA-Z0-9_-]/g,'_');
      return <div className="budget-category" key={category.id}><div className="budget-category-heading"><button type="button" className={'budget-category-toggle'+(open?' is-open':'')} aria-label={(open?'Collapse ':'Expand ')+(category.name||'category')} aria-expanded={open} aria-controls={contentId} onClick={()=>setCollapsed({...collapsed,[key]:open})}><ChevronRight size={17}/></button><input aria-label={section.name+' category '+(category.name||'New category')} maxLength={200} placeholder="Category name" value={category.name} onChange={e=>renameCategory(section.id,category.id,e.target.value)}/><output aria-label={(category.name||'Category')+' category total'}>{money.format(sectionTotal(category.rows))}</output><span className="budget-category-count">{category.rows.length} {category.rows.length===1?'item':'items'}</span></div><div id={contentId} hidden={!open}>
      {category.rows.map(row=>{const index=section.rows.findIndex(r=>r.id===row.id);return <div className="budget-columns budget-line budget-thread-line" key={row.id}>
      <label className="budget-line-details"><span className="budget-mobile-label">details</span><input aria-label={`${section.name} item ${index+1} details`} maxLength={300} value={row.details} placeholder="details" onChange={e=>updateRow(section.id,row.id,{details:e.target.value})}/></label>
      <div className="budget-line-rate"><span className="budget-mobile-label">Rate</span><div className="budget-rate-controls"><label><span aria-hidden="true">$</span><input aria-label={`${section.name} item ${index+1} rate`} type="number" inputMode="decimal" min={0} max={1e9} step="any" placeholder="0.00" value={row.rate??''} onChange={e=>updateRow(section.id,row.id,{rate:numberValue(e.target.value,1e9)})}/></label><select aria-label={`${section.name} item ${index+1} rate unit`} value={row.unit} onChange={e=>updateRow(section.id,row.id,{unit:e.target.value as BudgetLine['unit']})}>{units.filter(([unit])=>unit!=='tuning'||isPianoTuning(row.name)).map(([unit,label])=><option key={unit} value={unit}>{label}</option>)}</select></div></div>
      <label className="budget-line-quantity"><span className="budget-mobile-label">Quantity</span><input aria-label={`${section.name} item ${index+1} quantity`} type="number" inputMode="decimal" min={0} max={1e6} step="any" placeholder="0" value={row.quantity??''} onChange={e=>updateRow(section.id,row.id,{quantity:numberValue(e.target.value,1e6)})}/></label>
      <output className="budget-line-total" aria-label={`${row.name||'Expense'} total`}><span className="budget-mobile-label">Total</span>{money.format(lineTotal(row))}</output>
      <button className="budget-remove" aria-label={`Remove ${row.name||'item '+(index+1)}`} title="Remove row" onClick={()=>remove({...model,sections:model.sections.map(s=>s.id===section.id?{...s,rows:s.rows.filter(r=>r.id!==row.id)}:s)})}><X size={16}/></button>
     </div>})}
      <button type="button" className="budget-text-button budget-add-item" disabled={section.rows.length>=500} onClick={()=>addCategoryItem(section.id,category.id)}><Plus size={14}/> Add item</button>
      </div></div>;
     })}
     <div className="budget-section-footer"><button className="budget-text-button" disabled={section.rows.length>=500} onClick={()=>changed({...model,sections:model.sections.map(s=>s.id===section.id?{...s,rows:[...s.rows,newBudgetLine()]}:s)})}><Plus size={15}/> Add category</button><div><span>Sub Total</span><output aria-label={`${section.name} subtotal`}>{money.format(sectionTotal(section.rows))}</output></div></div>
    </div>)}
    <button className="budget-text-button budget-add-section" disabled={model.sections.length>=50} onClick={()=>changed({...model,sections:[...model.sections,{id:crypto.randomUUID(),name:'Other expenses',rows:[newBudgetLine()]}]})}><Plus size={16}/> Add section</button>
    <div className="budget-grand-total"><span>Total</span><output aria-label="Project budget total">{money.format(budgetTotal(model))}</output></div>
   </div><div className="budget-dates"><div className="budget-dates-heading"><h4>Dates</h4><span>Hours</span></div>{model.sessions.map((session,index)=><div className="budget-session" key={session.id}><input aria-label={`Session ${index+1} date`} placeholder="Date / session" maxLength={200} value={session.date} onChange={e=>changed({...model,sessions:model.sessions.map(s=>s.id===session.id?{...s,date:e.target.value}:s)})}/><input aria-label={`Session ${index+1} hours`} type="number" inputMode="decimal" min={0} max={1e6} step="any" value={session.hours??''} placeholder="0" onChange={e=>changed({...model,sessions:model.sessions.map(s=>s.id===session.id?{...s,hours:numberValue(e.target.value,1e6)}:s)})}/><button className="budget-remove" aria-label={`Remove session ${index+1}`} onClick={()=>remove({...model,sessions:model.sessions.filter(s=>s.id!==session.id)})}><X size={14}/></button></div>)}<button className="budget-text-button" disabled={model.sessions.length>=500} onClick={()=>changed({...model,sessions:[...model.sessions,{id:crypto.randomUUID(),date:'',hours:null}]})}><Plus size={15}/> Add session</button><div className="budget-hours-total"><span>Total hours</span><strong>{model.sessions.reduce((sum,s)=>sum+(s.hours??0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</strong></div></div></div>
    <label className="budget-notes">Budget notes<textarea maxLength={10000} rows={3} value={model.notes} placeholder="Budget details, estimates, or additional expenses…" onChange={e=>changed({...model,notes:e.target.value})}/></label>
   </fieldset>
  </>}</div>
 </div></dialog>;
}
