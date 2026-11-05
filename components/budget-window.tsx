'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {Workbook,type WorkbookInstance} from '@fortune-sheet/react';
import type {Sheet,Hooks} from '@fortune-sheet/core';
import {transformExcelToFortune,transformFortuneToExcel} from '@corbe30/fortune-excel';
import {restoreExcelFormats,preserveExcelBlanks} from '@/lib/budget-excel';
import {Download,Upload,X,RotateCcw} from 'lucide-react';
import {BudgetSchema,type Budget} from '@/lib/budget';
import '@fortune-sheet/react/dist/index.css';
import './budget.css';
type SavedBudget=Budget&{revision:number};
function compact(sheets:Sheet[]):Sheet[]{return JSON.parse(JSON.stringify(sheets.map(sheet=>{const copy={...sheet};if(copy.data)delete copy.celldata;return copy})));}
function forEditor(sheets:Sheet[]):Sheet[]{return sheets.map((sheet,i)=>{const {data,...rest}=sheet,id=sheet.id||`sheet-${i}`;const celldata=data?data.flatMap((row,r)=>row.flatMap((v,c)=>v?[{r,c,v}]:[])):sheet.celldata||[];return {...rest,id,celldata,calcChain:celldata.filter(cell=>cell.v?.f).map(({r,c})=>({r,c,id}))}});}
function header(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,w:number,h:number){ctx.save();ctx.fillStyle='#211c22';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#49323e';ctx.strokeRect(x+.5,y+.5,w,h);ctx.fillStyle='#cbb7c1';ctx.font='11px "DM Sans", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+w/2,y+h/2);ctx.restore();return false;}
const budgetHooks:Hooks={beforeRenderRowHeaderCell:(text,_i,top,w,h,ctx)=>header(ctx,text,0,top,w,h),beforeRenderColumnHeaderCell:(text,_i,left,w,h,ctx)=>header(ctx,text,left,0,w,h)};
export default function BudgetWindow({project,importFile,onClose}:{project:{id:string;client:string;name:string};importFile:File|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),book=useRef<WorkbookInstance>(null),input=useRef<HTMLInputElement>(null);
 const [initial,setInitial]=useState<Sheet[]|null>(null),[key,setKey]=useState(0),[status,setStatus]=useState('Opening budget…'),[error,setError]=useState(''),[working,setWorking]=useState(false);
 const record=useRef<SavedBudget|null>(null),pending=useRef<Sheet[]|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),saving=useRef<Promise<boolean>|null>(null),last=useRef(''),imported=useRef(false),mounted=useRef(true);
 const flush=useCallback(async():Promise<boolean>=>{
  if(timer.current)clearTimeout(timer.current);
  if(saving.current){if(!await saving.current)return false;return flush();}
  if(!pending.current||!record.current)return true;
  const run=async()=>{
   while(pending.current&&record.current){
    const sheets=pending.current,snapshot={...record.current,sheets};setStatus('Saving…');setError('');
    try{
     const checked=BudgetSchema.safeParse(snapshot);if(!checked.success)throw new Error(checked.error.issues[0].message);
     const r=await fetch('/api/budget',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
     const data=await r.json() as SavedBudget&{error?:string};if(!r.ok)throw new Error(data.error||'Could not save. Retry when connected.');
     record.current={...snapshot,revision:data.revision};if(pending.current===sheets)pending.current=null;
    }catch(e){setStatus('Not saved');setError((e as Error).message);return false;}
   }
   setStatus('Saved');return true;
  };
  saving.current=run();const ok=await saving.current;saving.current=null;return ok;
 },[]);
 const changed=useCallback((sheets:Sheet[])=>{
  if(!record.current)return;
  const clean=compact(sheets),json=JSON.stringify(clean);if(json===last.current)return;
  last.current=json;pending.current=clean;setStatus('Waiting to save…');
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),850);
 },[flush]);
 const replace=useCallback(async(file:File)=>{
  if(!/\.xlsx$/i.test(file.name)){setError('Choose an .xlsx workbook.');return;}
  if(file.size>10*1024*1024){setError('Choose an .xlsx file smaller than 10 MB.');return;}
  setWorking(true);setError('');
  try{
   if(!await flush())return;
   let converted:Sheet[]|null=null;
   await transformExcelToFortune(file,(sheets:Sheet[])=>{converted=sheets},()=>{},null);
   if(!converted)throw new Error('This file contains no readable worksheets.');
   const sheets=converted as Sheet[];await restoreExcelFormats(file,sheets);
   if(sheets.some(s=>(s.row||0)>10000||(s.column||0)>200||(s.celldata||[]).some(c=>c.r>=10000||c.c>=200)))throw new Error('Use up to 10,000 rows and 200 columns per worksheet.');
   const payload={...record.current!,sheets:compact(sheets),templateTitle:false};
   const check=BudgetSchema.safeParse(payload);if(!check.success)throw new Error(check.error.issues[0].message);
   record.current=payload;pending.current=payload.sheets as Sheet[];last.current=JSON.stringify(payload.sheets);
   setInitial(forEditor(payload.sheets as Sheet[]));setKey(k=>k+1);setStatus('Saving…');await flush();
  }catch(e){setError((e as Error).message||'Could not open this workbook. The existing budget is unchanged.');}
  finally{setWorking(false);if(input.current)input.current.value='';}
 },[flush]);
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
   if(!mounted.current)return;const saved=data,sheets=compact(saved.sheets as Sheet[]);
   if(saved.templateTitle&&sheets[0]?.data?.[0]?.[0])sheets[0].data[0][0]={...sheets[0].data[0][0],v:`${project.client} - ${project.name}`,m:`${project.client} - ${project.name}`};
   record.current={...saved,sheets};last.current=JSON.stringify(sheets);pending.current=null;setInitial(forEditor(sheets));setKey(k=>k+1);setStatus('Saved');
   if(importFile&&!imported.current){imported.current=true;await replace(importFile);}
  }catch(e){setStatus('Not loaded');setError((e as Error).message);}
 },[project.id,project.client,project.name,importFile,replace]);
 useEffect(()=>{void load()},[load]);
 async function close(){if(working)return;setWorking(true);try{if(await flush()){dialog.current?.close();onClose()}}finally{if(mounted.current)setWorking(false)}}
 async function download(){setError('');try{const raw=await transformFortuneToExcel(book,undefined,false),blob=await preserveExcelBlanks(raw,book.current?.getAllSheets()||[]),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${project.client} - ${project.name} - Budget.xlsx`.replace(/[\\/:*?"<>|]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setError('Could not export this workbook. Please retry.')}}
 return <dialog ref={dialog} className="budget-dialog" aria-labelledby="budget-title" onCancel={e=>{e.preventDefault();void close()}} onClick={e=>{if(e.target===dialog.current)void close()}}><div className="budget-frame" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!working&&e.dataTransfer.files[0])void replace(e.dataTransfer.files[0])}}>
  <div className="budget-toolbar"><div><h2 id="budget-title">{project.client} <span>— {project.name}</span></h2><small role="status">Budget · {status}</small></div><div className="budget-actions"><input ref={input} type="file" accept=".xlsx" hidden onChange={e=>{if(e.target.files?.[0])void replace(e.target.files[0])}}/><button className="secondary" aria-label="Import .xlsx" disabled={!initial||working} onClick={()=>input.current?.click()}><Upload size={16}/><span>Import .xlsx</span></button><button className="secondary" aria-label="Download .xlsx" disabled={!initial||working} onClick={()=>void download()}><Download size={16}/><span>Download .xlsx</span></button><button className="budget-close" aria-label="Close budget" disabled={working} onClick={()=>void close()}><X size={22}/></button></div></div>
  {error&&<div className="budget-error" role="alert">{error}<button onClick={()=>void(initial?flush():load())}><RotateCcw size={14}/> Retry</button>{initial&&<button onClick={()=>{if(confirm('Discard unsaved spreadsheet changes and reload the saved budget?'))void load()}}>Reload saved budget</button>}</div>}
  <div className="budget-grid">{initial?<Workbook key={key} ref={book} data={initial} hooks={budgetHooks} lang="en" currency="$" onChange={changed} forceCalculation defaultFontSize={11} defaultRowHeight={30} allowEdit={!working} toolbarItems={['undo','redo','|','currency-format','number-decrease','number-increase','format','|','font-size','bold','italic','font-color','background','border','merge-cell','|','horizontal-align','text-wrap','freeze','sort','quick-formula']}/>:<div className="budget-placeholder">{status}</div>}</div>
 </div></dialog>;
}
