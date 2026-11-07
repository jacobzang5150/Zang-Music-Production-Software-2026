import {callStudioDatabase} from './supabase';
import {createInvoice,type SavedInvoice} from './invoice';
import type {Project} from './projects';
import type {SavedBudget} from './budget-sharing';
async function checked<T>(response:Response):Promise<T>{const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error||'Could not load invoice data.');return data}
export async function invoiceContext(owner:string,id:string){
 const projects=await checked<(Project&{revision:number})[]>(await callStudioDatabase({owner,action:'list'}));
 const project=projects.find(p=>p.id===id);if(!project)throw new Error('Project not found.');
 const [budget]=await checked<SavedBudget[]>(await callStudioDatabase({owner,resource:'budgets',action:'list',id}));
 if(!budget)throw new Error('Budget not found.');
 return {project,projects,budget};
}
export async function findInvoice(owner:string,key:string){
 return (await checked<SavedInvoice[]>(await callStudioDatabase({owner,resource:'invoices',action:'list',id:key})))[0]||null;
}
export async function ensureInvoice(owner:string,id:string){
 const context=await invoiceContext(owner,id),key=context.budget.budgetKey||'project:'+id;
 let invoice=await findInvoice(owner,key);
 if(!invoice){
  if(!context.project.deliveredAt)throw new Error('Mark this project delivered to generate its invoice.');
  const draft=createInvoice(context.project,context.budget);
  const saved=await callStudioDatabase({owner,resource:'invoices',action:'save',project:draft,revision:0});
  if(saved.status===409){await saved.body?.cancel();invoice=await findInvoice(owner,key);if(!invoice)throw new Error('Invoice changed. Please retry.');}
  else invoice=await checked<SavedInvoice>(saved);
 }
 const members=new Set(invoice.projects.map(p=>p.id)),current=context.projects.filter(p=>members.has(p.id));
 return {...context,invoice,paid:current.length===members.size&&current.every(p=>!!p.paymentReceivedAt),sourceChanged:invoice.budgetRevision!==context.budget.revision||JSON.stringify(invoice.projects)!==JSON.stringify(context.budget.linkedProjects?.length?context.budget.linkedProjects:[{id:context.project.id,client:context.project.client,name:context.project.name}]),shared:invoice.projects.length>1};
}
