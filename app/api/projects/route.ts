import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ProjectSchema} from '@/lib/projects';
import {callStudioDatabase} from '@/lib/supabase';
async function respond(input:Parameters<typeof callStudioDatabase>[0]){
  try{const response=await callStudioDatabase(input);return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return Response.json({error:'Could not connect to project storage. Please try again.'},{status:503})}
}
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to view projects.'},{status:401});return respond({owner:user.userId,action:'list'});}
export async function PUT(req:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save projects.'},{status:401});
  try{const raw=await req.json();const revisionCheck=z.object({revision:z.number().int().min(0)}).safeParse(raw);const parsed=ProjectSchema.safeParse(raw);
    if(!revisionCheck.success||!parsed.success)return Response.json({error:!parsed.success?parsed.error.issues[0].message:'Invalid revision'},{status:400});
    return respond({owner:user.userId,action:'save',project:parsed.data,revision:revisionCheck.data.revision});
  }catch{return Response.json({error:'Invalid project data'},{status:400})}
}
export async function DELETE(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required'},{status:401});try{const parsed=z.object({id:z.string().min(1).max(80),revision:z.number().int().positive()}).safeParse(await req.json());if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});return respond({owner:user.userId,action:'delete',...parsed.data});}catch{return Response.json({error:'Invalid request'},{status:400})}}
