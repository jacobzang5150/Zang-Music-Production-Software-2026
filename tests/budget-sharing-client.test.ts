import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeBudgetLink} from '../lib/budget-sharing-client.ts';
import type {SavedBudget,BudgetProject} from '../lib/budget-sharing.ts';
const project=(id:string):BudgetProject=>({id,client:'Artist',name:id.toUpperCase()});
const budget=(id:string,key='project:'+id,members:string[]=[]):SavedBudget=>({id,sheets:[{name:'Budget',marker:'existing expenses'}],templateTitle:false,revision:7,budgetKey:key,linkedProjects:members.map(project)});
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('adding third and fourth projects preserves every existing link and shared budget contents',async()=>{
 let current=budget('a','shared:ab',['a','b']);const members=['a','b'],requests:any[]=[];
 const request:typeof fetch=async(input,init)=>{
  if(!init?.method)return reply(budget(String(input).split('=')[1]));
  const payload=JSON.parse(String(init.body));requests.push(payload);
  assert.equal(payload.targetId,'a');assert.equal(payload.budgetKey,'project:'+payload.id);assert.equal(payload.revision,7);
  members.push(payload.id);return reply({...current,id:payload.id,linkedProjects:members.map(project)});
 };
 current=await changeBudgetLink(current,'link','c',request);
 assert.equal(current.id,'a');assert.equal(current.budgetKey,'shared:ab');assert.deepEqual(current.linkedProjects?.map(p=>p.id),['a','b','c']);
 current=await changeBudgetLink(current,'link','d',request);
 assert.equal(current.id,'a');assert.equal(current.budgetKey,'shared:ab');assert.deepEqual(current.linkedProjects?.map(p=>p.id),['a','b','c','d']);
 assert.equal(current.sheets[0].marker,'existing expenses');assert.deepEqual(requests.map(p=>p.id),['c','d']);
});
test('initial linking still chooses the selected project budget directly',async()=>{
 let calls=0;const request:typeof fetch=async(_input,init)=>{calls++;const p=JSON.parse(String(init?.body));assert.equal(p.id,'a');assert.equal(p.targetId,'b');return reply(budget('a','shared:ab',['a','b']))};
 const linked=await changeBudgetLink(budget('a'),'link','b',request);assert.equal(calls,1);assert.equal(linked.id,'a');assert.equal(linked.linkedProjects?.length,2);
});
test('unlink operates only on the open project even in a larger group',async()=>{
 const request:typeof fetch=async(_input,init)=>{const p=JSON.parse(String(init?.body));assert.equal(p.action,'unlink');assert.equal(p.id,'a');assert.equal(p.budgetKey,'shared:ab');return reply(budget('a'))};
 const restored=await changeBudgetLink(budget('a','shared:ab',['a','b','c','d']),'unlink',undefined,request);assert.equal(restored.budgetKey,'project:a');
});
test('failed target reads do not change existing shared membership',async()=>{
 const current=budget('a','shared:ab',['a','b']);let calls=0;
 const request:typeof fetch=async()=>{calls++;return reply({error:'Project not found'},404)};
 await assert.rejects(changeBudgetLink(current,'link','c',request),/Project not found/);assert.equal(calls,1);assert.equal(current.linkedProjects?.length,2);
});
test('concurrent changes are reported and duplicate links never send a mutation',async()=>{
 const current=budget('a','shared:ab',['a','b']);let calls=0;
 const request:typeof fetch=async(_input,init)=>{calls++;return init?.method?reply({error:'Budget changed'},409):reply(budget('c'))};
 await assert.rejects(changeBudgetLink(current,'link','c',request),/Budget changed/);assert.equal(calls,2);
 await assert.rejects(changeBudgetLink(current,'link','b',request),/already linked/);assert.equal(calls,2);assert.equal(current.id,'a');assert.equal(current.linkedProjects?.length,2);
});
