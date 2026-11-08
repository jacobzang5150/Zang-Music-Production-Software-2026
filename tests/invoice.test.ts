import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceLines,invoiceTotals,createInvoice} from '../lib/invoice.ts';
import {invoiceHtml} from '../lib/invoice-print.ts';
import {createBudget} from '../lib/budget.ts';
import {readBudgetModel,writeBudgetModel,type BudgetLine} from '../lib/budget-model.ts';
import {newProject,paymentStatus,applyDeliveryTransition} from '../lib/projects.ts';
const line=(id:string,name:string,rate:number,quantity=1,extra:Partial<BudgetLine>={}):BudgetLine=>({id,name,details:'',rate,quantity,unit:'hour',...extra});
function fixture(){
 const project={...newProject(),client:'Sample Artist',name:'Record',deliveredAt:'2026-11-07T18:00:00.000Z'};
 const budget=createBudget(project),model=readBudgetModel(budget);
 model.sections=[{id:'recording',name:'Recording / Production',rows:[line('producer','Producer/Engineer',80,10),line('rent','Recording Studio Rental',100,10),line('musicians','Studio Musicians',0,0,{dropdown:true}),line('gregg','Gregg',75,2,{parentId:'musicians'}),line('gear','Equipment Rental',60),line('piano','Piano Tuning',200,1,{unit:'tuning'})]},{id:'overdubs',name:'Overdubs',rows:[line('guitar','Electric Guitar',100,2),line('drummer','Studio Musicians',75)]},{id:'post',name:'Post-Production',rows:[line('mix','Mixing',80,3),line('other','Other expenses',50)]}];
 return {project,budget:{...writeBudgetModel(budget,model),revision:3,budgetKey:'project:'+project.id},model};
}
test('invoices select Jacob fees and exclude third-party costs, including nested musicians',()=>{
 const {project,budget,model}=fixture(),items=invoiceLines(model);
 assert.deepEqual(items.filter(line=>line.included).map(line=>line.name),['Producer/Engineer','Electric Guitar','Mixing']);
 const invoice=createInvoice(project,budget,new Date('2026-11-07T19:00:00Z'));
 assert.equal(invoiceTotals(invoice).total,1240);assert.equal(invoice.dueAt,'2026-12-07T18:00:00.000Z');assert.equal(invoice.payee,'Jacob Zang');
 const withCosts={...invoice,lines:invoice.lines.map(line=>['recording:gregg','recording:gear'].includes(line.id)?{...line,included:true}:line),amountReceived:200};
 assert.deepEqual(invoiceTotals(withCosts),{fees:1240,expenses:210,total:1450,received:200,balance:1250});assert.equal(invoiceTotals(withCosts,true).balance,0);
 assert.equal(invoiceTotals(invoice).expenses,0);
});
test('linked projects use one budget identity and refreshing preserves choices and invoice number',()=>{
 const {project,budget}=fixture();const shared={...budget,budgetKey:'shared:one',linkedProjects:[{id:project.id,client:project.client,name:'First'},{id:'second',client:project.client,name:'Second'}]};
 const first=createInvoice(project,shared);assert.equal(first.id,'shared:one');assert.equal(first.projects.length,2);assert.equal(first.projectTitle,'First, Second');
 first.lines.find(line=>line.id==='recording:gear')!.included=true;first.amountReceived=100;
 const next=createInvoice(project,{...shared,revision:4},new Date(),first);assert.equal(next.number,first.number);assert.equal(next.issuedAt,first.issuedAt);assert.equal(next.amountReceived,100);assert.equal(next.lines.find(line=>line.id==='recording:gear')!.included,true);
});
test('print output excludes unselected expenses and escapes client text',()=>{
 const {project,budget}=fixture(),invoice=createInvoice(project,budget);invoice.billTo='<script>alert(1)</script>';
 const html=invoiceHtml(invoice);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('Recording Studio Rental'));assert(html.includes('$1,240'));assert(html.includes('Checks made payable to Jacob Zang'));
});

test('invoicing before delivery does not start the clock; delivery updates the due date',()=>{
 const {project,budget}=fixture(),before={...project,deliveredAt:null,paymentReceivedAt:null};
 const invoice=createInvoice(before,budget,new Date('2026-11-01T12:00:00Z'));
 assert.equal(paymentStatus(before).state,'undelivered');assert.equal(before.deliveredAt,null);
 const delivered=applyDeliveryTransition(before,{...before,deliveredAt:'2026-11-08T12:00:00Z'},new Date('2026-11-08T12:00:00Z'));
 assert.equal(paymentStatus(delivered,new Date('2026-11-08T12:00:00Z')).daysRemaining,30);
 const updated=createInvoice(delivered,budget,new Date(),invoice);
 assert.equal(updated.dueAt,'2026-12-08T12:00:00.000Z');assert.equal(updated.issuedAt,invoice.issuedAt);assert.equal(updated.number,invoice.number);
});
test('linked invoice due dates are consistent whichever member is opened',()=>{
 const {project,budget}=fixture(),other={...project,id:'second',deliveredAt:'2026-11-10T12:00:00.000Z'};
 const shared={...budget,linkedProjects:[project,other].map(p=>({id:p.id,client:p.client,name:p.name}))};
 assert.equal(createInvoice(project,shared,new Date(),undefined,[project,other]).dueAt,'2026-12-10T12:00:00.000Z');
 assert.equal(createInvoice(other,shared,new Date(),undefined,[project,other]).dueAt,'2026-12-10T12:00:00.000Z');
});
