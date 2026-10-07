import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ClientSchema} from '@/lib/clients';
import {callStudioDatabase} from '@/lib/supabase';
async function respond(input:Parameters<typeof callStudioDatabase>[0]){
  try{const response=await callStudioDatabase(input);return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return Response.json({error:'Could not connect to client storage. Please try again.'},{status:503})}
}
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to view clients.'},{status:401});return respond({resource:'clients',owner:user.userId,action:'list'});}
export async function PUT(req:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save clients.'},{status:401});
  try{const raw=await req.json();const revisionCheck=z.object({revision:z.number().int().min(0)}).safeParse(raw);const parsed=ClientSchema.safeParse(raw);
    if(!revisionCheck.success||!parsed.success)return Response.json({error:!parsed.success?parsed.error.issues[0].message:'Invalid revision'},{status:400});
    return respond({resource:'clients',owner:user.userId,action:'save',project:parsed.data,revision:revisionCheck.data.revision});
  }catch{return Response.json({error:'Invalid client data'},{status:400})}
}
