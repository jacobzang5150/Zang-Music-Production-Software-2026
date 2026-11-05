'use client';
import {useEffect,useRef,useState,useCallback,type PointerEvent as ReactPointerEvent} from 'react';
import {Download,Upload,X,RotateCcw,Plus,Trash2,ChevronRight,MoreHorizontal,GripVertical,Link2,Unlink} from 'lucide-react';
import {BudgetSchema,type Budget} from '@/lib/budget';
import {BudgetModelSchema,readBudgetModel,writeBudgetModel,newBudgetLine,isPianoTuning,lineTotal,sectionTotal,budgetTotal,budgetRemaining,groupBudgetRows,setBudgetDropdown,type BudgetModel,type BudgetLine} from '@/lib/budget-model';
import {emptyBudgetHistory,recordBudgetChange,undoBudgetChange,redoBudgetChange} from '@/lib/budget-history';
import {moveBudgetRow,type BudgetMove} from '@/lib/budget-order';
import {useBudgetDrag} from './budget-drag';
import './budget.css';
import BudgetSharing from './budget-sharing';
import {sameBudgetVersion,budgetHeading,type SavedBudget} from '@/lib/budget-sharing';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const units=[['song','per song'],['hour','per hour'],['day','per day'],['session','per session'],['tuning','per tuning']] as const;
const numberValue=(value:string,max:number)=>value===''?null:Math.min(max,Math.max(0,Number(value)||0));
export default function BudgetWindow({project,importFile,onClose}:{project:{id:string;client:string;name:string};importFile:File|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const [model,setModel]=useState<BudgetModel|null>(null),[status,setStatus]=useState('Opening budget…'),[error,setError]=useState(''),[working,setWorking]=useState(false),[canUndo,setCanUndo]=useState(false);
 const [sharingOpen,setSharingOpen]=useState(false);
 const [budgetInfo,setBudgetInfo]=useState<SavedBudget|null>(null);
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const record=useRef<SavedBudget|null>(null),modelRef=useRef<BudgetModel|null>(null),pending=useRef<BudgetModel|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),saving=useRef<Promise<boolean>|null>(null),imported=useRef(false),mounted=useRef(true);
 const history=useRef(emptyBudgetHistory());
 const flush=useCallback(async():Promise<boolean>=>{
  if(timer.current)clearTimeout(timer.current);
  if(saving.current){if(!await saving.current)return false;return flush()}
  if(!pending.current||!record.current)return true;
  const run=async()=>{
   while(pending.current&&record.current){
    const next=pending.current;setStatus('Saving…');setError('');
    try{
     const snapshot={...writeBudgetModel(record.current,BudgetModelSchema.parse(next)),revision:record.current.revision,budgetKey:record.current.budgetKey};
     const checked=BudgetSchema.safeParse(snapshot);if(!checked.success)throw new Error(checked.error.issues[0].message);
     const r=await fetch('/api/budget',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...checked.data,revision:snapshot.revision,budgetKey:snapshot.budgetKey})});
     const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not save. Retry when connected.');
     record.current={...snapshot,revision:data.revision};if(pending.current===next)pending.current=null;
    }catch(e){setStatus('Not saved');setError((e as Error).message);return false}
   }
   setStatus('Saved');return true;
  };
  saving.current=run();const ok=await saving.current;saving.current=null;return ok;
 },[]);
 const apply=useCallback((next:BudgetModel)=>{
  modelRef.current=next;setModel(next);pending.current=next;setStatus('Waiting to save…');
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),650);
 },[flush]);
 const changed=useCallback((next:BudgetModel,editKey:string|null=null)=>{
  const current=modelRef.current;if(!current)return;const updated=recordBudgetChange(history.current,current,next,editKey);if(updated===history.current)return;
  history.current=updated;setCanUndo(updated.past.length>0);apply(next);
 },[apply]);
 const undoBudget=useCallback(()=>{if(working||!modelRef.current)return;const result=undoBudgetChange(history.current,modelRef.current);if(result.model===modelRef.current)return;history.current=result.history;setCanUndo(result.history.past.length>0);apply(result.model)},[apply,working]);
 const redoBudget=useCallback(()=>{if(working||!modelRef.current)return;const result=redoBudgetChange(history.current,modelRef.current);if(result.model===modelRef.current)return;history.current=result.history;setCanUndo(result.history.past.length>0);apply(result.model)},[apply,working]);
 const drag=useBudgetDrag(dialog,working,(source,target)=>{if(modelRef.current)changed(moveBudgetRow(modelRef.current,source,target))});
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!dialog.current?.open||e.isComposing||e.altKey||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z')return;e.preventDefault();e.stopPropagation();if(e.shiftKey)redoBudget();else undoBudget()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[undoBudget,redoBudget]);
 const replace=useCallback(async(file:File)=>{
  setWorking(true);setError('');
  try{
   if(!await flush())return;
   const {importBudgetExcel}=await import('@/lib/budget-excel');
   const next=await importBudgetExcel(file);changed(next);await flush();
  }catch(e){setError((e as Error).message||'Could not open this budget. Your existing budget is unchanged.')}
  finally{setWorking(false);if(input.current)input.current.value=''}
 },[flush,changed]);
 useEffect(()=>{
  mounted.current=true;dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const warn=(e:BeforeUnloadEvent)=>{if(pending.current||saving.current){e.preventDefault();e.returnValue=''}};
  const online=()=>void flush();const dismiss=(e:PointerEvent)=>{dialog.current?.querySelectorAll<HTMLDetailsElement>('.budget-category-options[open]').forEach(menu=>{if(!menu.contains(e.target as Node))menu.open=false})};document.addEventListener('pointerdown',dismiss);window.addEventListener('beforeunload',warn);window.addEventListener('online',online);
  return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);document.body.style.overflow=overflow;document.removeEventListener('pointerdown',dismiss);window.removeEventListener('beforeunload',warn);window.removeEventListener('online',online)};
 },[flush]);
 const acceptBudget=useCallback((data:SavedBudget)=>{const next=readBudgetModel(data);record.current=data;modelRef.current=next;pending.current=null;setModel(next);setBudgetInfo(data);history.current=emptyBudgetHistory();setCanUndo(false);setCollapsed({});setStatus('Saved')},[]);
 const load=useCallback(async()=>{
  setError('');setStatus('Opening budget…');
  try{
   const r=await fetch('/api/budget?id='+encodeURIComponent(project.id));const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not open the budget.');
   if(!mounted.current)return;acceptBudget(data);
   if(importFile&&!imported.current){imported.current=true;await replace(importFile)}
  }catch(e){setStatus('Not loaded');setError((e as Error).message)}
 },[project.id,importFile,replace,acceptBudget]);
 useEffect(()=>{void load()},[load]);
 async function changeSharing(action:'link'|'unlink',targetId?:string):Promise<boolean>{
  if(working)return false;drag.cancel();setWorking(true);setError('');
  try{
   if(!await flush()||!record.current)return false;
   const current=record.current;
   const r=await fetch('/api/budget',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:project.id,action,targetId,revision:current.revision,budgetKey:current.budgetKey})});
   const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not change budget links.');acceptBudget(data);return true;
  }catch(e){setError((e as Error).message);return false}finally{setWorking(false)}
 }
 // Quietly refresh clean budgets when another linked project or tab saves.
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{if(working||!record.current||pending.current||saving.current||document.visibilityState==='hidden')return;const before=record.current;
   try{const r=await fetch('/api/budget?id='+encodeURIComponent(project.id));if(!r.ok)return;const next=await r.json() as SavedBudget;
    if(!active||pending.current||saving.current||record.current!==before)return;
    if(!sameBudgetVersion(before,next))acceptBudget(next);else{record.current=next;setBudgetInfo(next)}
   }catch{/* Keep the current budget available while offline. */}
  };
  const interval=setInterval(()=>void refresh(),15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[project.id,working,acceptBudget]);

 async function close(){if(working)return;drag.cancel();setWorking(true);try{if(await flush()){dialog.current?.close();onClose()}}finally{if(mounted.current)setWorking(false)}}
 async function download(){if(!modelRef.current)return;setError('');try{const heading=budgetHeading(project,record.current);const {exportBudgetExcel}=await import('@/lib/budget-excel');const blob=await exportBudgetExcel(modelRef.current,heading),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${heading.client} - ${heading.name} - Budget.xlsx`.replace(/[\\/:*?"<>|]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setError('Could not export this budget. Please retry.')}}
 function updateRow(sectionId:string,rowId:string,patch:Partial<BudgetLine>){if(!model)return;changed({...model,sections:model.sections.map(section=>section.id!==sectionId?section:{...section,rows:section.rows.map(row=>{if(row.id!==rowId)return row;const next={...row,...patch};if(next.unit==='tuning'&&!isPianoTuning(next.name))next.unit='hour';return next})})},sectionId+':'+rowId+':'+Object.keys(patch).join(','))}
 function renameCategory(sectionId:string,categoryId:string,name:string){
  if(!model)return;const section=model.sections.find(s=>s.id===sectionId),category=section&&groupBudgetRows(section.rows).find(c=>c.id===categoryId);if(!category)return;
  const ids=new Set(category.rows.map(row=>row.id));
  changed({...model,sections:model.sections.map(s=>s.id!==sectionId?s:{...s,rows:s.rows.map(row=>ids.has(row.id)?{...row,categoryId,name,unit:row.unit==='tuning'&&!isPianoTuning(name)?'hour':row.unit}:row)})},sectionId+':category:'+categoryId);
 }
 function addCategoryItem(sectionId:string,categoryId:string){
  if(!model)return;const section=model.sections.find(s=>s.id===sectionId),category=section&&groupBudgetRows(section.rows).find(c=>c.id===categoryId);if(!category)return;
  const lastIndex=Math.max(...category.rows.map(row=>section!.rows.indexOf(row)));
  const rows=[...section!.rows];
  rows.splice(lastIndex+1,0,{...newBudgetLine(),parentId:category.id,name:category.name,unit:category.rows.find(row=>row.id===category.id)!.unit});
  changed({...model,sections:model.sections.map(s=>s.id===sectionId?{...s,rows}:s)});
 }
 function categoryOptions(sectionId:string,category:{id:string;name:string;dropdown:boolean}){
  return <details className="budget-category-options" onKeyDown={e=>{if(e.key==='Escape'&&e.currentTarget.open){e.preventDefault();e.stopPropagation();e.currentTarget.open=false}}}><summary aria-label={'Options for '+(category.name||'category')} title="Category options"><MoreHorizontal size={18}/></summary><div className="budget-category-menu"><button type="button" onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');if(!model)return;changed({...model,sections:model.sections.map(s=>s.id===sectionId?{...s,rows:setBudgetDropdown(s.rows,category.id,!category.dropdown)}:s)});setCollapsed({...collapsed,[sectionId+'-'+category.id]:false})}}>{category.dropdown?'Remove dropdown':'Add dropdown'}</button></div></details>;
 }
 function dragAttributes(move:BudgetMove){return {'data-budget-drag-kind':move.kind,'data-budget-section':move.sectionId,'data-budget-row':move.rowId,'data-budget-group':move.groupId,onPointerDown:(e:ReactPointerEvent<HTMLElement>)=>drag.start(e,move)}}
 function dragGrip(move:BudgetMove,label:string){
  return <button type="button" className="budget-row-grip" aria-label={'Reorder '+label} title="Drag to reorder, or use Up and Down" disabled={working} onPointerDown={e=>drag.start(e,move,true)} onKeyDown={e=>{
   if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const current=modelRef.current,section=current?.sections.find(s=>s.id===move.sectionId);if(!current||!section)return;
   const list=move.kind==='category'?groupBudgetRows(section.rows).map(g=>g.id):groupBudgetRows(section.rows).find(g=>g.id===move.groupId)?.rows.map(row=>row.id)||[];
   const index=list.indexOf(move.rowId),to=index+(e.key==='ArrowUp'?-1:1);if(index>=0&&list[to])changed(moveBudgetRow(current,move,{...move,rowId:list[to],placement:e.key==='ArrowUp'?'before':'after'}));
  }}><GripVertical size={15}/></button>;
 }
 function rowFields(section:BudgetModel['sections'][number],row:BudgetLine,flat:boolean,groupId?:string){
  const current=model;if(!current)return null;const index=section.rows.findIndex(r=>r.id===row.id);
  return <div className={flat?"budget-columns budget-line budget-flat-line":"budget-columns budget-line budget-thread-line"} key={row.id} {...dragAttributes({kind:flat?'category':'item',sectionId:section.id,rowId:row.id,groupId})}>
      {flat&&<div className="budget-line-name"><span className="budget-mobile-label">Category</span><div className="budget-name-controls">{dragGrip({kind:'category',sectionId:section.id,rowId:row.id},'category '+(row.name||'new category')+' in '+section.name)}<input aria-label={`${section.name} item ${index+1} name`} maxLength={200} value={row.name} placeholder="Category name" onChange={e=>updateRow(section.id,row.id,{name:e.target.value})}/></div></div>}
      <div className="budget-line-details"><span className="budget-mobile-label">details</span><div className="budget-name-controls">{!flat&&dragGrip({kind:'item',sectionId:section.id,rowId:row.id,groupId},'item '+(row.details||row.name||'unnamed')+' in '+section.name)}<input aria-label={`${section.name} item ${index+1} details`} maxLength={300} value={row.details} placeholder="details" onChange={e=>updateRow(section.id,row.id,{details:e.target.value})}/></div></div>
      <div className="budget-line-rate"><span className="budget-mobile-label">Rate</span><div className="budget-rate-controls"><label><span aria-hidden="true">$</span><input aria-label={`${section.name} item ${index+1} rate`} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown')e.preventDefault()}} type="number" inputMode="decimal" min={0} max={1e9} step="any" placeholder="0.00" value={row.rate??''} onChange={e=>updateRow(section.id,row.id,{rate:numberValue(e.target.value,1e9)})}/></label><select aria-label={`${section.name} item ${index+1} rate unit`} value={row.unit} onChange={e=>updateRow(section.id,row.id,{unit:e.target.value as BudgetLine['unit']})}>{units.filter(([unit])=>unit!=='tuning'||isPianoTuning(row.name)).map(([unit,label])=><option key={unit} value={unit}>{label}</option>)}</select></div></div>
      <label className="budget-line-quantity"><span className="budget-mobile-label">Quantity</span><input aria-label={`${section.name} item ${index+1} quantity`} type="number" inputMode="decimal" min={0} max={1e6} step="any" placeholder="0" value={row.quantity??''} onChange={e=>updateRow(section.id,row.id,{quantity:numberValue(e.target.value,1e6)})}/></label>
      <output className="budget-line-total" aria-label={`${row.name||'Expense'} total`}><span className="budget-mobile-label">Total</span>{money.format(lineTotal(row))}</output>
      <div className="budget-row-actions"><button className="budget-remove" aria-label={`Remove ${row.name||'item '+(index+1)}`} title="Remove row" onClick={()=>remove({...current,sections:current.sections.map(s=>s.id===section.id?{...s,rows:s.rows.filter(r=>r.id!==row.id)}:s)})}><X size={16}/></button>{flat&&categoryOptions(section.id,{id:row.id,name:row.name,dropdown:false})}</div>
     </div>;
 }
 function remove(next:BudgetModel){changed(next)}
 const heading=budgetHeading(project,budgetInfo),linked=(budgetInfo?.linkedProjects?.length||0)>1;
 return <dialog ref={dialog} className="budget-dialog" aria-labelledby="budget-title" onCancel={e=>{e.preventDefault();void close()}} onClick={e=>{if(e.target===dialog.current)void close()}}><div className="budget-frame" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();if(!working&&record.current&&e.dataTransfer.files[0])void replace(e.dataTransfer.files[0])}}>
  <div className="budget-toolbar"><div><div className="budget-eyebrow">PROJECT BUDGET</div><h2 id="budget-title">{heading.client} <span>- {heading.name}</span></h2>{linked&&<span className="budget-linked-label"><Link2 size={12}/> Linked</span>}<small role="status">{status}</small></div><div className="budget-actions"><button className="secondary" aria-label="Link Projects" aria-expanded={sharingOpen} aria-controls="budget-sharing-panel" disabled={!model||working} onClick={()=>setSharingOpen(!sharingOpen)}><Link2 size={16}/><span>Link Projects</span></button>{budgetInfo?.budgetKey?.startsWith('shared:')&&<button className="secondary" aria-label="Unlink budget" title="Restore this project's separate budget" disabled={!model||working} onClick={async()=>{if(await changeSharing('unlink'))setSharingOpen(false)}}><Unlink size={16}/><span>Unlink</span></button>}<input ref={input} type="file" accept=".xlsx" hidden onChange={e=>{if(e.target.files?.[0])void replace(e.target.files[0])}}/><button className="secondary" aria-label="Import .xlsx" disabled={!model||working} onClick={()=>input.current?.click()}><Upload size={16}/><span>Import .xlsx</span></button><button className="secondary" aria-label="Download .xlsx" disabled={!model||working} onClick={()=>void download()}><Download size={16}/><span>Download .xlsx</span></button><button className="budget-close" aria-label="Close budget" disabled={working} onClick={()=>void close()}><X size={22}/></button></div></div>
  {error&&<div className="budget-error" role="alert">{error}<button onClick={()=>void(model?flush():load())}><RotateCcw size={14}/> Retry</button>{model&&<button onClick={()=>{if(confirm('Discard unsaved budget changes and reload the saved budget?'))void load()}}>Reload saved budget</button>}</div>}
  <div className="budget-scroll">{!model?<div className="budget-placeholder">{status}</div>:<>
   {budgetInfo&&<BudgetSharing budget={budgetInfo} busy={working} open={sharingOpen} onClose={()=>setSharingOpen(false)} onChange={changeSharing}/>}
   <div className="budget-body-title">{canUndo&&<button className="budget-text-button" disabled={working} title="Undo (Command+Z)" onClick={undoBudget}><RotateCcw size={14}/> Undo</button>}<div className="budget-summary"><label className="budget-estimate"><span>ESTIMATE</span><div><span aria-hidden="true">$</span><input aria-label="Project estimate" type="number" inputMode="decimal" min={0} max={1e12} step="any" placeholder="0.00" disabled={working} value={model.estimate??''} onChange={e=>changed({...model,estimate:numberValue(e.target.value,1e12)},'estimate')}/></div></label><span className="budget-total-caption">PROJECT TOTAL <strong>{money.format(budgetTotal(model))}</strong></span><span className={'budget-total-caption budget-remaining'+((budgetRemaining(model)??0)<0?' is-over-budget':'')}><span>{(budgetRemaining(model)??0)<0?'OVER BUDGET':'REMAINING'}</span><output aria-label="Remaining project budget">{budgetRemaining(model)===null?'—':money.format(Math.abs(budgetRemaining(model)!))}</output></span></div></div>
   <fieldset className="budget-fields" disabled={working}><div className="budget-layout"><div className="budget-expenses">
    {model.sections.map(section=><div className="budget-section" key={section.id}>
     <div className="budget-columns budget-section-heading"><label className="budget-section-name"><span className="sr-only">Section name</span><input aria-label={`Section name: ${section.name}`} maxLength={200} value={section.name} placeholder="Section name" onChange={e=>changed({...model,sections:model.sections.map(s=>s.id===section.id?{...s,name:e.target.value}:s)},'section:'+section.id+':name')}/></label><span>Rate</span><span>Quantity</span><span>Total</span><button className="budget-remove" aria-label={`Remove section ${section.name}`} title="Remove section" disabled={model.sections.length===1} onClick={()=>remove({...model,sections:model.sections.filter(s=>s.id!==section.id)})}><Trash2 size={15}/></button></div>
     {groupBudgetRows(section.rows).map(category=>{
      if(!category.dropdown)return rowFields(section,category.rows[0],true);
      const key=section.id+'-'+category.id,open=!collapsed[key],contentId='budget-category-'+key.replace(/[^a-zA-Z0-9_-]/g,'_');
      return <div className="budget-category" key={category.id} {...dragAttributes({kind:'category',sectionId:section.id,rowId:category.id})}><div className="budget-category-heading">{dragGrip({kind:'category',sectionId:section.id,rowId:category.id},'category '+(category.name||'new category')+' in '+section.name)}<button type="button" className={'budget-category-toggle'+(open?' is-open':'')} aria-label={(open?'Collapse ':'Expand ')+(category.name||'category')} aria-expanded={open} aria-controls={contentId} onClick={()=>setCollapsed({...collapsed,[key]:open})}><ChevronRight size={17}/></button><input aria-label={section.name+' category '+(category.name||'New category')} maxLength={200} placeholder="Category name" value={category.name} onChange={e=>renameCategory(section.id,category.id,e.target.value)}/><output aria-label={(category.name||'Category')+' category total'}>{money.format(sectionTotal(category.rows))}</output><span className="budget-category-count">{category.rows.length} {category.rows.length===1?'item':'items'}</span>{categoryOptions(section.id,category)}</div><div id={contentId} hidden={!open}>
      {category.rows.map(row=>rowFields(section,row,false,category.id))}
      <button type="button" className="budget-text-button budget-add-item" disabled={section.rows.length>=500} onClick={()=>addCategoryItem(section.id,category.id)}><Plus size={14}/> Add item</button>
      </div></div>;
     })}
     <div className="budget-section-footer"><button className="budget-text-button" disabled={section.rows.length>=500} onClick={()=>changed({...model,sections:model.sections.map(s=>s.id===section.id?{...s,rows:[...s.rows,newBudgetLine()]}:s)})}><Plus size={15}/> Add category</button><div><span>Sub Total</span><output aria-label={`${section.name} subtotal`}>{money.format(sectionTotal(section.rows))}</output></div></div>
    </div>)}
    <button className="budget-text-button budget-add-section" disabled={model.sections.length>=50} onClick={()=>changed({...model,sections:[...model.sections,{id:crypto.randomUUID(),name:'Other expenses',rows:[newBudgetLine()]}]})}><Plus size={16}/> Add section</button>
    <div className="budget-grand-total"><span>Total</span><output aria-label="Project budget total">{money.format(budgetTotal(model))}</output></div>
   </div><div className="budget-dates"><div className="budget-dates-heading"><h4>Dates</h4><span>Hours</span></div>{model.sessions.map((session,index)=><div className="budget-session" key={session.id}><input aria-label={`Session ${index+1} date`} placeholder="Date / session" maxLength={200} value={session.date} onChange={e=>changed({...model,sessions:model.sessions.map(s=>s.id===session.id?{...s,date:e.target.value}:s)},'session:'+session.id+':date')}/><input aria-label={`Session ${index+1} hours`} type="number" inputMode="decimal" min={0} max={1e6} step="any" value={session.hours??''} placeholder="0" onChange={e=>changed({...model,sessions:model.sessions.map(s=>s.id===session.id?{...s,hours:numberValue(e.target.value,1e6)}:s)},'session:'+session.id+':hours')}/><button className="budget-remove" aria-label={`Remove session ${index+1}`} onClick={()=>remove({...model,sessions:model.sessions.filter(s=>s.id!==session.id)})}><X size={14}/></button></div>)}<button className="budget-text-button" disabled={model.sessions.length>=500} onClick={()=>changed({...model,sessions:[...model.sessions,{id:crypto.randomUUID(),date:'',hours:null}]})}><Plus size={15}/> Add session</button><div className="budget-hours-total"><span>Total hours</span><strong>{model.sessions.reduce((sum,s)=>sum+(s.hours??0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</strong></div></div></div>
    <label className="budget-notes">Budget notes<textarea maxLength={10000} rows={3} value={model.notes} placeholder="Budget details, estimates, or additional expenses…" onChange={e=>changed({...model,notes:e.target.value},'notes')}/></label>
   </fieldset>
  </>}</div>
 </div></dialog>;
}

