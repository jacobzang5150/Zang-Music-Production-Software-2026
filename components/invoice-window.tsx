'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {X,Printer,RefreshCw,ReceiptText} from 'lucide-react';
import {invoiceTotals,type Invoice,type InvoiceResponse,type SavedInvoice} from '@/lib/invoice';
import {printInvoice} from '@/lib/invoice-print';
import type {Project} from '@/lib/projects';
import './invoice.css';
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export default function InvoiceWindow({project,onClose}:{project:Project;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true),baseline=useRef('');
 const [data,setData]=useState<InvoiceResponse|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[status,setStatus]=useState('Generating invoice…');
 const invoice=data?.invoice,dirty=!!invoice&&JSON.stringify(invoice)!==baseline.current;
 useLayoutEffect(()=>{const node=dialog.current;node?.showModal();return()=>{if(node?.open)node.close()}},[]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false}},[]);
 function accept(result:InvoiceResponse){baseline.current=JSON.stringify(result.invoice);setData(result);setStatus('Saved')}
 async function load(){setWorking(true);setError('');try{const response=await fetch('/api/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:project.id})});const result=await response.json() as InvoiceResponse&{error?:string};if(!response.ok)throw new Error(result.error);if(alive.current)accept(result)}catch(e){if(alive.current){setError((e as Error).message);setStatus('Could not open invoice')}}finally{if(alive.current)setWorking(false)}}
 function update(change:Partial<Invoice>){if(!data)return;setData({...data,invoice:{...data.invoice,...change}});setStatus('Unsaved changes')}
 function close(){if(working)return;if(dirty&&!confirm('Discard unsaved invoice changes?'))return;onClose()}
 async function persist():Promise<SavedInvoice|null>{
  if(!invoice)return null;
  const response=await fetch('/api/invoice',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...invoice,projectId:project.id})});const result=await response.json() as SavedInvoice&{error?:string};if(!response.ok)throw new Error(result.error);if(alive.current)accept({...data!,invoice:result});return result;
 }
 async function save(print=false){setWorking(true);setError('');try{const saved=await persist();if(saved&&print&&alive.current)printInvoice(saved,data?.paid)}catch(e){if(alive.current){setError((e as Error).message);setStatus('Not saved')}}finally{if(alive.current)setWorking(false)}}
 async function refresh(){if(!data)return;setWorking(true);setError('');try{
  const saved=dirty?await persist():data.invoice;if(!saved)return;
  const response=await fetch('/api/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:project.id,action:'refresh',revision:saved.revision})});const result=await response.json() as InvoiceResponse&{error?:string};if(!response.ok)throw new Error(result.error);if(alive.current)accept(result);
 }catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setWorking(false)}}
 const totals=invoice?invoiceTotals(invoice,data?.paid):null;
 return <dialog ref={dialog} className="invoice-dialog" aria-labelledby="invoice-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}}><header className="invoice-head"><div><div className="eyebrow">PAYABLE TO JACOB ZANG</div><h2 id="invoice-title"><ReceiptText size={22}/> Invoice</h2><small>{invoice?.number}</small></div><button type="button" className="invoice-close" disabled={working} aria-label="Close invoice" onClick={close}><X size={22}/></button></header><div className="invoice-body">
 {error&&<p role="alert" className="drive-error">{error}</p>}{!data?<><p role="status">{status}</p>{!working&&<button className="secondary" onClick={load}>Retry invoice</button>}</>:<>
 <div className="invoice-toolbar"><span role="status">{working?'Saving…':status}</span><button className="secondary" disabled={working} onClick={refresh}><RefreshCw size={15}/> Refresh from budget</button><button className="secondary" disabled={working} onClick={()=>save()}>Save invoice</button><button className="primary" disabled={working||!totals?.total} onClick={()=>save(true)}><Printer size={15}/> Print / Save PDF</button></div>
 {data.sourceChanged&&<p className="invoice-info">The budget changed after this invoice was generated. Refresh from budget to update its amounts.</p>}
 {data.shared&&<p className="invoice-info">One invoice covers this linked budget: {invoice!.projects.map(p=>p.client+' — '+p.name).join('; ')}. Review the recipient and costs before printing.</p>}
 <div className="invoice-summary"><label>Bill to<input aria-label="Invoice recipient" maxLength={1000} disabled={working} value={invoice!.billTo} onChange={e=>update({billTo:e.target.value})}/></label><div><small>Project</small><strong>{invoice!.projectTitle}</strong></div><div><small>Payment due</small><strong>{new Date(invoice!.dueAt).toLocaleDateString()}</strong></div><div className="invoice-amount"><small>{data.paid?'Paid':'Amount due to Jacob Zang'}</small><strong>{money(totals!.balance)}</strong></div></div>
 <p className="invoice-info">Your fees are selected below. Select outside expenses only when you covered them and the client owes you reimbursement. The full budget stays unchanged.</p>
 <fieldset disabled={working} className="invoice-lines"><legend>Review invoice items</legend>{invoice!.lines.filter(line=>line.amount>0).length===0&&<p>Add rates and quantities in the budget, then refresh this invoice.</p>}{(['fee','expense'] as const).map(kind=><section key={kind}><h3>{kind==='fee'?'Production fees':'Expenses you covered'}</h3>{invoice!.lines.filter(line=>line.kind===kind&&line.amount>0).map(line=><label className={'invoice-line'+(!line.included?' is-excluded':'')} key={line.id}><input type="checkbox" aria-label={(kind==='expense'?'I covered ':'Include ')+line.name+(line.details?' — '+line.details:'')} checked={line.included} onChange={e=>update({lines:invoice!.lines.map(item=>item.id===line.id?{...item,included:e.target.checked}:item)})}/><span><strong>{line.name}</strong><small>{line.section}{line.details?' · '+line.details:''}</small><small>{money(line.rate)} / {line.unit} × {line.quantity}</small></span><strong>{money(line.amount)}</strong></label>)}</section>)}</fieldset>
 <div className="invoice-bottom"><label>Payments already received<input type="number" inputMode="decimal" min={0} step="0.01" max={1e12} aria-label="Invoice payments received" disabled={working||data.paid} value={invoice!.amountReceived||''} placeholder="0.00" onChange={e=>update({amountReceived:Math.max(0,Number(e.target.value)||0)})}/></label><dl><div><dt>Your fees</dt><dd>{money(totals!.fees)}</dd></div><div><dt>Reimbursements</dt><dd>{money(totals!.expenses)}</dd></div><div><dt>Total</dt><dd>{money(totals!.total)}</dd></div><div><dt>Received</dt><dd>{money(totals!.received)}</dd></div><div className="invoice-balance"><dt>Amount due</dt><dd>{money(totals!.balance)}</dd></div></dl></div>
 <label className="invoice-note">Payment instructions or notes<textarea aria-label="Invoice notes" maxLength={5000} disabled={working} value={invoice!.notes} placeholder="Add payment instructions or a note for your client" onChange={e=>update({notes:e.target.value})}/></label>
 </> }</div></dialog>;
}
