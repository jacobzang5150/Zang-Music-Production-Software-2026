import {BudgetLinkSchema,type SavedBudget} from './budget-sharing.ts';

async function readResponse(response:Response):Promise<SavedBudget>{
 const data=await response.json() as SavedBudget&{error?:string};
 if(!response.ok)throw new Error(data.error||'Could not change budget links.');
 return data;
}
// Initial linking chooses the target's budget. Subsequent links add the target
// to the current group instead of moving the current project out of that group.
export async function changeBudgetLink(current:SavedBudget,action:'link'|'unlink',targetId?:string,request:typeof fetch=fetch):Promise<SavedBudget>{
 if(action==='link'&&(!targetId||targetId===current.id))throw new Error('Choose another project.');
 if(action==='link'&&current.linkedProjects?.some(project=>project.id===targetId))throw new Error('This project is already linked.');
 let id=current.id,target=targetId,revision=current.revision,budgetKey=current.budgetKey;
 if(action==='link'&&current.budgetKey?.startsWith('shared:')){
  const other=await readResponse(await request('/api/budget?id='+encodeURIComponent(targetId!)));
  if(other.id!==targetId)throw new Error('Could not open the selected project’s budget.');
  id=other.id;target=current.id;revision=other.revision;budgetKey=other.budgetKey;
 }
 const payload=BudgetLinkSchema.parse({id,action,targetId:target,revision,budgetKey});
 const linked=await readResponse(await request('/api/budget',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 return {...linked,id:current.id};
}
