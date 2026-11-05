import {getChatGPTUser} from '../../chatgpt-auth';
import {callStudioDatabase} from '@/lib/supabase';
import {BudgetSchema,createBudget} from '@/lib/budget';
import {z} from 'zod';
import {BudgetLinkSchema} from '@/lib/budget-sharing';
const response=(r:Response)=>new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to open the budget.'},{status:401});
 const id=new URL(req.url).searchParams.get('id');if(!id||id.length>80)return Response.json({error:'Invalid project.'},{status:400});
 try{
  const projects=await callStudioDatabase({owner:user.userId,action:'list'});if(!projects.ok)return response(projects);
  const project=(await projects.json() as {id:string;client:string;name:string}[]).find(p=>p.id===id);if(!project)return Response.json({error:'Project not found.'},{status:404});
  const listed=await callStudioDatabase({owner:user.userId,resource:'budgets',action:'list',id});if(!listed.ok)return response(listed);
  const rows=await listed.json() as unknown[];if(rows.length)return Response.json(rows[0],{headers:{'Cache-Control':'no-store'}});
  const saved=await callStudioDatabase({owner:user.userId,resource:'budgets',action:'save',project:createBudget(project),revision:0});
  if(saved.status!==409)return response(saved);
  const latest=await callStudioDatabase({owner:user.userId,resource:'budgets',action:'list',id});if(!latest.ok)return response(latest);return Response.json((await latest.json() as unknown[])[0],{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Could not load the budget. Try again.'},{status:503})}
}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save the budget.'},{status:401});
 try{
  const text=await req.text();if(text.length>2_010_000)return Response.json({error:'Workbook is too large.'},{status:413});
  const raw=JSON.parse(text),parsed=BudgetSchema.safeParse(raw),revision=z.number().int().positive().safeParse(raw.revision);
  if(!parsed.success||!revision.success)return Response.json({error:!parsed.success?parsed.error.issues[0].message:'Invalid revision.'},{status:400});
  return response(await callStudioDatabase({owner:user.userId,resource:'budgets',action:'save',project:parsed.data,revision:revision.data,budgetKey:typeof raw.budgetKey==='string'?raw.budgetKey:undefined}));
 }catch{return Response.json({error:'Could not save the budget. Your changes are still open.'},{status:503})}
}

export async function PATCH(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to link budgets.'},{status:401});
 try{
  const parsed=BudgetLinkSchema.safeParse(await req.json());if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
  return response(await callStudioDatabase({owner:user.userId,resource:'budgets',action:'import',project:parsed.data}));
 }catch{return Response.json({error:'Could not change budget links. Try again.'},{status:503})}
}
