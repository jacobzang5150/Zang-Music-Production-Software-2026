import type {BudgetModel} from './budget-model.ts';
export type BudgetHistory={past:BudgetModel[];future:BudgetModel[];editKey:string|null;at:number};
const LIMIT=50;
export function emptyBudgetHistory():BudgetHistory{return {past:[],future:[],editKey:null,at:0}}
export function recordBudgetChange(history:BudgetHistory,current:BudgetModel,next:BudgetModel,editKey:string|null=null,at=Date.now()):BudgetHistory{
 if(current===next||JSON.stringify(current)===JSON.stringify(next))return history;
 const coalesce=editKey!==null&&history.editKey===editKey&&at-history.at<800&&history.future.length===0;
 return {past:coalesce?history.past:[...history.past,structuredClone(current)].slice(-LIMIT),future:[],editKey,at};
}
export function undoBudgetChange(history:BudgetHistory,current:BudgetModel){
 if(!history.past.length)return {history,model:current};
 return {history:{past:history.past.slice(0,-1),future:[structuredClone(current),...history.future].slice(0,LIMIT),editKey:null,at:0},model:history.past[history.past.length-1]};
}
export function redoBudgetChange(history:BudgetHistory,current:BudgetModel){
 if(!history.future.length)return {history,model:current};
 return {history:{past:[...history.past,structuredClone(current)].slice(-LIMIT),future:history.future.slice(1),editKey:null,at:0},model:history.future[0]};
}
