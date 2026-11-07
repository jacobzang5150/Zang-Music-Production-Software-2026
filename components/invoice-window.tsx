'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {X,Download,ReceiptText} from 'lucide-react';
import {invoiceTotals,type Invoice,type InvoiceResponse,type SavedInvoice} from '@/lib/invoice';
import {rebaseInvoiceEdits} from '@/lib/invoice-autosave';
import type {Project} from '@/lib/projects';
import './invoice.css';
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export default function InvoiceWindow({project,onClose}:{project:Project;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true),baseline=useRef(''),current=useRef<InvoiceResponse|null>(null),editVersion=useRef(0),savePromise=useRef<Promise<SavedInvoice|null>|null>(null),saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),loading=useRef(false),loadPromise=useRef<Promise<boolean>|null>(null),exportingRef=useRef(false),conflict=useRef(false);
 const [data,setData]=useState<InvoiceResponse|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[exporting,setExporting]=useState(false),[status,setStatus]=useState('Generating invoice…');
 const invoice=data?.invoice;
 function dirty(){return !!current.current&&JSON.stringify(current.current.invoice)!==baseline.current}
 useLayoutEffect(()=>{const node=dialog.current;node?.showModal();return()=>{if(node?.open)node.close()}},[]);
 useEffect(()=>{
  alive.current=true;void load();
  const refresh=()=>{if(!dirty()&&!savePromise.current&&!loading.current&&!exportingRef.current)void load(true)};
  const leaving=(e:BeforeUnloadEvent)=>{if(dirty()||savePromise.current){e.preventDefault();e.returnValue=''}};
  window.addEventListener('focus',refresh);window.addEventListener('beforeunload',leaving);const timer=setInterval(refresh,15000);
  return()=>{alive.current=false;if(saveTimer.current)clearTimeout(saveTimer.current);clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('beforeunload',leaving)};
 },[]);
 function accept(result:InvoiceResponse){baseline.current=JSON.stringify(result.invoice);current.current=result;conflict.current=false;setData(result);setStatus('Saved')}
 function load(quiet=false):Promise<boolean>{
  if(loadPromise.current)return loadPromise.current;loading.current=true;if(!quiet)setWorking(true);setError('');
  const version=editVersion.current;
  const task=(async()=>{
   try{const response=await fetch('/api/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:project.id})});const result=await response.json() as InvoiceResponse&{error?:string};if(!response.ok)throw new Error(result.error);if(alive.current){if(editVersion.current===version)accept(result);else{baseline.current=JSON.stringify(result.invoice);const next={...result,invoice:rebaseInvoiceEdits(current.current!.invoice,result.invoice)};current.current=next;setData(next)}}return true}
   catch(e){if(alive.current){setError((e as Error).message);setStatus('Could not sync invoice')}return false}finally{loading.current=false;if(alive.current)setWorking(false)}
  })();loadPromise.current=task;void task.finally(()=>{loadPromise.current=null});return task;
 }
 function update(change:Partial<Invoice>){
  if(!current.current)return;editVersion.current++;const next={...current.current,invoice:{...current.current.invoice,...change}};current.current=next;setData(next);setStatus('Saving…');
  if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{void flush()},500);
 }
 function flush():Promise<SavedInvoice|null>{
  if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null}
  if(savePromise.current)return savePromise.current;
  if(conflict.current)return Promise.resolve(null);
  const task=(async()=>{
   try{
    if(loadPromise.current&&!await loadPromise.current)throw new Error('Could not sync invoice. Please retry.');
    while(alive.current&&dirty()){
     const snapshot=current.current!.invoice,version=editVersion.current;
     if(!snapshot.billTo.trim())throw new Error('Enter a recipient to save this invoice.');
     setStatus('Saving…');setError('');
     const response=await fetch('/api/invoice',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,projectId:project.id})});const saved=await response.json() as SavedInvoice&{error?:string};
     if(!response.ok){conflict.current=response.status===409;throw new Error(saved.error||'Could not save invoice.')}
     if(!alive.current)return null;
     baseline.current=JSON.stringify(saved);
     const next={...current.current!,invoice:editVersion.current===version?saved:rebaseInvoiceEdits(current.current!.invoice,saved)};current.current=next;setData(next);
    }
    if(alive.current)setStatus('Saved');return current.current?.invoice||null;
   }catch(e){if(alive.current){setError((e as Error).message);setStatus('Not saved')}return null}
  })();savePromise.current=task;void task.finally(()=>{savePromise.current=null});return task;
 }
 async function close(){if(exporting)return;const saved=await flush();if(dirty()&&!saved)return;onClose()}
 async function download(){exportingRef.current=true;setExporting(true);setError('');try{
  let saved=await flush();if(!saved)return;
  // Sync the latest budget before exporting, preserving all saved selections.
  if(!await load(true))return;if(dirty())saved=await flush();else saved=current.current?.invoice||null;
  if(!saved)return;const {downloadInvoicePdf}=await import('@/lib/invoice-pdf');await downloadInvoicePdf(saved,current.current?.paid);
 }catch(e){setError((e as Error).message||'Could not download invoice.')}finally{exportingRef.current=false;if(alive.current)setExporting(false)}}
 const totals=invoice?invoiceTotals(invoice,data?.paid):null;
 return <dialog ref={dialog} className="invoice-dialog" aria-labelledby="invoice-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}}><header className="invoice-head"><div><h2 id="invoice-title"><ReceiptText size={22}/><span>Invoice{invoice?` ${invoice.number}`:''}</span></h2></div><button type="button" className="invoice-close" disabled={exporting} aria-label="Close invoice" onClick={()=>void close()}><X size={22}/></button></header><div className="invoice-body">
 {error&&<p role="alert" className="drive-error">{error}</p>}{!data?<><p role="status">{status}</p>{!working&&<button className="secondary" onClick={()=>void load()}>Retry invoice</button>}</>:<>
 <div className="invoice-toolbar"><span role="status">{exporting?'Preparing PDF…':status}</span></div>
 {error&&data&&<button className="secondary" onClick={()=>{if(conflict.current){if(confirm('Reload the invoice and discard unsaved changes?')){baseline.current=JSON.stringify(current.current?.invoice);void load()}}else void flush()}}>{conflict.current?'Reload invoice':'Retry save'}</button>}
 {data.shared&&<p className="invoice-info">One invoice covers this linked budget: {invoice!.projects.map(p=>p.client+' — '+p.name).join('; ')}. Review the recipient and costs before downloading.</p>}
 <div className="invoice-summary"><label>Bill to<input aria-label="Invoice recipient" maxLength={1000} disabled={working||exporting} value={invoice!.billTo} onChange={e=>update({billTo:e.target.value})}/></label><div><small>Project</small><strong>{invoice!.projectTitle}</strong></div><div><small>Payment due</small><strong>{new Date(invoice!.dueAt).toLocaleDateString()}</strong></div><div className="invoice-amount"><small>{data.paid?'Paid':'Amount due to Jacob Zang'}</small><strong>{money(totals!.balance)}</strong></div></div>
 <fieldset disabled={working||exporting} className="invoice-lines"><legend>Review invoice items</legend>{invoice!.lines.filter(line=>line.amount>0).length===0&&<p>Add rates and quantities in the budget. They will appear here automatically.</p>}{(['fee','expense'] as const).map(kind=><section key={kind}><h3>{kind==='fee'?'Production fees':'Expenses you covered'}</h3>{invoice!.lines.filter(line=>line.kind===kind&&line.amount>0).map(line=><label className={'invoice-line'+(!line.included?' is-excluded':'')} key={line.id}><input type="checkbox" aria-label={(kind==='expense'?'I covered ':'Include ')+line.name+(line.details?' — '+line.details:'')} checked={line.included} onChange={e=>update({lines:invoice!.lines.map(item=>item.id===line.id?{...item,included:e.target.checked}:item)})}/><span><strong>{line.name}</strong><small>{line.section}{line.details?' · '+line.details:''}</small><small>{money(line.rate)} / {line.unit} × {line.quantity}</small></span><strong>{money(line.amount)}</strong></label>)}</section>)}</fieldset>
 <div className="invoice-bottom"><label>Payments already received<input type="number" inputMode="decimal" min={0} step="0.01" max={1e12} aria-label="Invoice payments received" disabled={working||exporting||data.paid} value={invoice!.amountReceived||''} placeholder="0.00" onChange={e=>update({amountReceived:Math.max(0,Number(e.target.value)||0)})}/></label><dl><div><dt>Your fees</dt><dd>{money(totals!.fees)}</dd></div><div><dt>Reimbursements</dt><dd>{money(totals!.expenses)}</dd></div><div><dt>Total</dt><dd>{money(totals!.total)}</dd></div><div><dt>Received</dt><dd>{money(totals!.received)}</dd></div><div className="invoice-balance"><dt>Amount due</dt><dd>{money(totals!.balance)}</dd></div></dl></div>
 <footer className="invoice-download"><button className="primary" disabled={working||exporting||!totals?.total} onClick={()=>void download()}><Download size={15}/> {exporting?'Preparing PDF…':'Download PDF'}</button></footer>

 </> }</div></dialog>;
}
