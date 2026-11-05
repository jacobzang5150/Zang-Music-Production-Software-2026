import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBudget} from '../lib/budget.ts';
import {readBudgetModel,groupBudgetRows,setBudgetDropdown,budgetTotal,newBudgetLine} from '../lib/budget-model.ts';
import {moveBudgetRow} from '../lib/budget-order.ts';
import {emptyBudgetHistory,recordBudgetChange,undoBudgetChange,redoBudgetChange} from '../lib/budget-history.ts';
const fresh=()=>readBudgetModel(createBudget({id:'p',client:'Artist',name:'Record'}));
test('reordering category rows is immutable and preserves costs',()=>{
 const model=fresh(),before=structuredClone(model),section=model.sections[0];section.rows[0].quantity=2;before.sections[0].rows[0].quantity=2;
 const result=moveBudgetRow(model,{kind:'category',sectionId:section.id,rowId:section.rows[0].id},{kind:'category',sectionId:section.id,rowId:section.rows[2].id,placement:'after'});
 assert.deepEqual(result.sections[0].rows.slice(0,3).map(row=>row.id),[section.rows[1].id,section.rows[2].id,section.rows[0].id]);assert.equal(budgetTotal(result),160);assert.deepEqual(model,before);
 assert.equal(moveBudgetRow(model,{kind:'category',sectionId:section.id,rowId:section.rows[0].id},{kind:'category',sectionId:section.id,rowId:section.rows[0].id,placement:'after'}),model);
});
test('moving a dropdown across sections carries its children and their amounts',()=>{
 const model=fresh(),from=model.sections[0],to=model.sections[1],root={...from.rows[0],dropdown:true,quantity:2},child={...newBudgetLine(),name:root.name,parentId:root.id,rate:40,quantity:2};from.rows=[root,child,...from.rows.slice(1)];
 const moved=moveBudgetRow(model,{kind:'category',sectionId:from.id,rowId:root.id},{kind:'category',sectionId:to.id,rowId:to.rows[0].id,placement:'before'});
 assert.ok(!moved.sections[0].rows.some(row=>row.id===root.id||row.id===child.id));const group=groupBudgetRows(moved.sections[1].rows)[0];assert.equal(group.id,root.id);assert.deepEqual(group.rows.map(row=>row.id),[root.id,child.id]);assert.equal(budgetTotal(moved),240);assert.equal(budgetTotal(model),240);
});
test('items reorder within a dropdown, including its original expense, and stay in their category',()=>{
 const model=fresh(),section=model.sections[0],root={...section.rows[0],dropdown:true},child={...newBudgetLine(),name:root.name,parentId:root.id};section.rows=[root,child,...section.rows.slice(1)];
 const move={kind:'item' as const,sectionId:section.id,rowId:root.id,groupId:root.id};
 const moved=moveBudgetRow(model,move,{...move,rowId:child.id,placement:'after'});assert.deepEqual(groupBudgetRows(moved.sections[0].rows)[0].rows.map(row=>row.id),[child.id,root.id]);
 assert.equal(moveBudgetRow(model,move,{...move,sectionId:model.sections[1].id,rowId:model.sections[1].rows[0].id,placement:'after'}),model);
});
test('undo and redo restore row creation, moves, deletion and dropdown choices',()=>{
 let model=fresh(),history=emptyBudgetHistory();const original=structuredClone(model),section=model.sections[0];
 const added={...model,sections:model.sections.map((s,i)=>i===0?{...s,rows:[...s.rows,newBudgetLine()]}:s)};history=recordBudgetChange(history,model,added);model=added;
 const moved=moveBudgetRow(model,{kind:'category',sectionId:section.id,rowId:model.sections[0].rows.at(-1)!.id},{kind:'category',sectionId:section.id,rowId:section.rows[0].id,placement:'before'});history=recordBudgetChange(history,model,moved);model=moved;
 let undo=undoBudgetChange(history,model);assert.deepEqual(undo.model,added);undo=undoBudgetChange(undo.history,undo.model);assert.deepEqual(undo.model,original);
 const redo=redoBudgetChange(undo.history,undo.model);assert.deepEqual(redo.model,added);
 const enabled={...added,sections:added.sections.map((s,i)=>i===0?{...s,rows:setBudgetDropdown(s.rows,s.rows[0].id,true)}:s)};const flagHistory=recordBudgetChange(redo.history,redo.model,enabled);assert.deepEqual(undoBudgetChange(flagHistory,enabled).model,added);
 const deleted={...added,sections:added.sections.map((s,i)=>i===0?{...s,rows:s.rows.slice(1)}:s)};assert.deepEqual(undoBudgetChange(recordBudgetChange(emptyBudgetHistory(),added,deleted),deleted).model,added);
});
test('typing coalesces by field, snapshots stay independent, and new changes clear redo',()=>{
 const initial=fresh(),first={...initial,notes:'a'},second={...initial,notes:'ab'};
 let history=recordBudgetChange(emptyBudgetHistory(),initial,first,'notes',1000);history=recordBudgetChange(history,first,second,'notes',1100);assert.equal(history.past.length,1);assert.deepEqual(undoBudgetChange(history,second).model,initial);
 const undo=undoBudgetChange(history,second);const next={...initial,estimate:1000};history=recordBudgetChange(undo.history,undo.model,next,'estimate',1200);assert.equal(history.future.length,0);
 initial.sections[0].rows[0].rate=999;assert.equal(history.past[0].sections[0].rows[0].rate,80);
});
