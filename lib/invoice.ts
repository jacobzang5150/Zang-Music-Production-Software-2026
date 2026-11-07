import {z} from 'zod';
import {readBudgetModel,lineTotal,type BudgetModel} from './budget-model.ts';
import type {SavedBudget} from './budget-sharing.ts';
import type {Project} from './projects.ts';
const money=z.number().finite().min(0).max(1e12);
export const InvoiceSchema=z.object({
 id:z.string().min(1).max(200),number:z.string().min(1).max(80),payee:z.literal('Jacob Zang'),
 billTo:z.string().trim().min(1).max(1000),projectTitle:z.string().max(3000),
 projects:z.array(z.object({id:z.string().max(80),client:z.string().max(120),name:z.string().max(160)})).min(1).max(1000),
 issuedAt:z.string().datetime(),dueAt:z.string().datetime(),budgetRevision:z.number().int().positive(),
 amountReceived:money,notes:z.string().max(5000),
 lines:z.array(z.object({id:z.string().max(300),section:z.string().max(200),name:z.string().max(200),details:z.string().max(300),rate:money,quantity:z.number().finite().min(0).max(1e6),unit:z.string().max(20),amount:money,included:z.boolean(),kind:z.enum(['fee','expense'])})).max(25000)
}).refine(value=>JSON.stringify(value).length<=1_500_000,'Invoice is too large.');
export type Invoice=z.infer<typeof InvoiceSchema>;
export type SavedInvoice=Invoice&{revision:number};
export type InvoiceResponse={invoice:SavedInvoice;paid:boolean;sourceChanged:boolean;shared:boolean};
/** Outside costs override section defaults, including musician children in Overdubs. */
export function invoiceLines(model:BudgetModel):Invoice['lines']{
 return model.sections.flatMap(section=>section.rows.map(row=>{
  const parent=section.rows.find(item=>item.id===row.parentId);
  const category=[parent?.name,row.name].filter(Boolean).join(' ');
  const outside=/\b(rent(?:al)?s?|musicians?|equipment|piano|tuning|travel|lodging|meals?|tax|expenses?)\b/i.test(category)||/recording\s+studio/i.test(category);
  const fee=!outside&&(/produc(?:er|tion)|engineer|overdub|editing|melodyne|mixing|mastering|post[\s-]*production/i.test(category)||/overdub|post[\s-]*production/i.test(section.name));
  return {id:section.id+':'+row.id,section:section.name,name:row.name||parent?.name||'Expense',details:row.details,rate:row.rate??0,quantity:row.quantity??0,unit:row.unit,amount:lineTotal(row),included:fee,kind:fee?'fee' as const:'expense' as const};
 }));
}
export function invoiceTotals(invoice:Invoice,paid=false){
 const sum=(kind:'fee'|'expense')=>invoice.lines.filter(line=>line.included&&line.kind===kind).reduce((value,line)=>value+Math.round(line.amount*100),0)/100;
 const fees=sum('fee'),expenses=sum('expense'),total=Math.round((fees+expenses)*100)/100;
 const received=paid?total:invoice.amountReceived;
 return {fees,expenses,total,received,balance:Math.max(0,Math.round((total-received)*100)/100)};
}
// 0000 marks an unsaved draft. Supabase reserves the actual four-digit number.
export function createInvoice(project:Project,budget:SavedBudget,now=new Date(),previous?:Invoice):Invoice{
 const projects=budget.linkedProjects?.length?budget.linkedProjects:[{id:project.id,client:project.client,name:project.name}];
 const lines=invoiceLines(readBudgetModel(budget)).map(line=>{const old=previous?.lines.find(item=>item.id===line.id);return old?{...line,included:old.included}:line});
 const issuedAt=previous?.issuedAt||now.toISOString();
 return InvoiceSchema.parse({id:budget.budgetKey||'project:'+project.id,number:previous?.number||'0000',payee:'Jacob Zang',billTo:previous?.billTo||[...new Set(projects.map(p=>p.client))].join(' / '),projectTitle:projects.map(p=>p.name).join(', '),projects,issuedAt,dueAt:previous?.dueAt||new Date(Date.parse(project.deliveredAt||issuedAt)+30*86400000).toISOString(),budgetRevision:budget.revision,amountReceived:previous?.amountReceived||0,notes:previous?.notes||'',lines});
}
