import {getChatGPTUser} from '../../chatgpt-auth';
import {ensureInvoice} from '@/lib/invoice-store';
import {InvoiceSchema,createInvoice} from '@/lib/invoice';
import {callStudioDatabase} from '@/lib/supabase';
const headers={'Cache-Control':'no-store'};
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to open invoices.'},{status:401});
 try{
  const raw=await req.json() as {id?:unknown;action?:unknown;revision?:unknown};if(typeof raw.id!=='string'||!raw.id||raw.id.length>80)return Response.json({error:'Invalid project.'},{status:400});
  let result=await ensureInvoice(user.userId,raw.id);
  // Keep amounts in sync without requiring a manual refresh. CAS never overwrites
  // another tab's invoice edits; retry against the latest confirmed record.
  for(let attempt=0;result.sourceChanged&&attempt<3;attempt++){
   const updated=createInvoice(result.project,result.budget,new Date(),result.invoice,result.projects);
   const saved=await callStudioDatabase({owner:user.userId,resource:'invoices',action:'save',project:updated,revision:result.invoice.revision});
   if(saved.status===409){await saved.body?.cancel();result=await ensureInvoice(user.userId,raw.id);continue}
   if(!saved.ok)return new Response(saved.body,{status:saved.status,headers});
   result={...result,invoice:await saved.json() as typeof result.invoice,sourceChanged:false,shared:updated.projects.length>1};
  }
  if(result.sourceChanged)return Response.json({error:'Invoice is being updated in another tab. Please retry.'},{status:409,headers});
  const members=new Set(result.invoice.projects.map(p=>p.id)),current=result.projects.filter(p=>members.has(p.id));
  return Response.json({invoice:result.invoice,paid:current.length===members.size&&current.every(p=>!!p.paymentReceivedAt),sourceChanged:false,shared:result.shared},{headers});
 }catch(e){return Response.json({error:(e as Error).message||'Could not generate invoice. Try again.'},{status:503,headers})}
}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save invoices.'},{status:401});
 try{
  const text=await req.text();if(text.length>1_510_000)return Response.json({error:'Invoice is too large.'},{status:413});
  const raw=JSON.parse(text);if(typeof raw.projectId!=='string'||raw.projectId.length>80||!Number.isInteger(raw.revision)||raw.revision<1)return Response.json({error:'Invalid invoice.'},{status:400});
  const context=await ensureInvoice(user.userId,raw.projectId),parsed=InvoiceSchema.safeParse(raw);
  if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
  const current=context.invoice;
  if(parsed.data.id!==current.id||raw.revision!==current.revision)return Response.json({error:'Invoice changed in another tab. Close and reopen it before editing.'},{status:409});
  // Only selections, recipient, received funds and notes are editable here.
  // Amounts and project identity always come from the saved budget snapshot.
  const choices=new Map(parsed.data.lines.map(line=>[line.id,line.included]));
  const snapshot=createInvoice(context.project,context.budget,new Date(),current,context.projects);
  const invoice={...snapshot,billTo:parsed.data.billTo,amountReceived:parsed.data.amountReceived,notes:parsed.data.notes,lines:snapshot.lines.map(line=>({...line,included:choices.get(line.id)??line.included}))};
  const saved=await callStudioDatabase({owner:user.userId,resource:'invoices',action:'save',project:invoice,revision:current.revision});
  return new Response(saved.body,{status:saved.status,headers:{...headers,'Content-Type':'application/json'}});
 }catch(e){return Response.json({error:(e as Error).message||'Could not save invoice.'},{status:503,headers})}
}
