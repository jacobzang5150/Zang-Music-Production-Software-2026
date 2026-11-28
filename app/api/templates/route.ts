import {getChatGPTUser} from '../../chatgpt-auth';
import {serverAuth} from '@/lib/rr-server';
import {BudgetModelSchema} from '@/lib/budget-model';
import {preset} from '@/lib/rr-preset';
export async function GET(){const u=await getChatGPTUser();if(!u)return new Response(null,{status:401});const {data,error}=await (await serverAuth()).from('rr_templates').select('name,model').eq('owner',u.id).order('name');return Response.json(error?{error:'Could not load templates.'}:data,{status:error?503:200})}
export async function PUT(req:Request){const u=await getChatGPTUser();if(!u)return new Response(null,{status:401});const input=await req.json() as {name?:string;model?:unknown};const name=String(input.name||'').trim(),model=BudgetModelSchema.safeParse(input.model);if(!name||name.length>80||name.toLowerCase()==='template'||!model.success)return Response.json({error:'Enter a different template name.'},{status:400});const {error}=await (await serverAuth()).from('rr_templates').upsert({owner:u.id,name,model:preset(model.data)});return Response.json(error?{error:'Could not save template.'}:{ok:true},{status:error?503:200})}
