import {groupBudgetRows,type BudgetModel} from './budget-model.ts';
export type BudgetMove={kind:'category'|'item';sectionId:string;rowId:string;groupId?:string};
export type BudgetDrop=BudgetMove&{placement:'before'|'after'};
export function moveBudgetRow(model:BudgetModel,source:BudgetMove,target:BudgetDrop):BudgetModel{
 if(source.kind!==target.kind||source.sectionId===target.sectionId&&source.rowId===target.rowId)return model;
 const from=model.sections.find(s=>s.id===source.sectionId),to=model.sections.find(s=>s.id===target.sectionId);if(!from||!to)return model;
 if(source.kind==='item'){
  if(from!==to||source.groupId!==target.groupId)return model;
  const group=groupBudgetRows(from.rows).find(g=>g.dropdown&&g.id===source.groupId);if(!group||!group.rows.some(row=>row.id===source.rowId)||!group.rows.some(row=>row.id===target.rowId))return model;
  const row=from.rows.find(r=>r.id===source.rowId)!,rows=from.rows.filter(r=>r.id!==source.rowId),index=rows.findIndex(r=>r.id===target.rowId)+(target.placement==='after'?1:0);rows.splice(index,0,row);
  if(rows.every((row,i)=>row===from.rows[i]))return model;
  return {...model,sections:model.sections.map(s=>s===from?{...s,rows}:s)};
 }
 const group=groupBudgetRows(from.rows).find(g=>g.id===source.rowId),destination=groupBudgetRows(to.rows).find(g=>g.id===target.rowId);if(!group||!destination)return model;
 const ids=new Set(group.rows.map(row=>row.id)),destinationIds=new Set(destination.rows.map(row=>row.id));
 const remaining=from.rows.filter(row=>!ids.has(row.id)),rows=from===to?[...remaining]:[...to.rows];if(rows.length+group.rows.length>500)return model;
 const indexes=rows.flatMap((row,i)=>destinationIds.has(row.id)?[i]:[]);if(!indexes.length)return model;
 const index=target.placement==='before'?Math.min(...indexes):Math.max(...indexes)+1;rows.splice(index,0,...group.rows);
 if(from===to&&rows.every((row,i)=>row===from.rows[i]))return model;
 return {...model,sections:model.sections.map(s=>s===to?{...s,rows}:s===from?{...s,rows:remaining}:s)};
}
