import {getChatGPTUser} from '../../../chatgpt-auth';
import {DriveFolderSchema,DriveLinkSchema} from '@/lib/drive-folders-schema';
import {callStudioDatabase} from '@/lib/supabase';
async function respond(input:Parameters<typeof callStudioDatabase>[0]){
 try{const r=await callStudioDatabase(input);return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return Response.json({error:'Could not save Drive folder assignments. Please retry.'},{status:503})}
}
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to Session.'},{status:401});return respond({owner:user.userId,resource:'folders',action:'list'})}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to Session.'},{status:401});
 try{const parsed=DriveFolderSchema.safeParse(await req.json());if(!parsed.success)return Response.json({error:'Invalid folder assignment.'},{status:400});return respond({owner:user.userId,resource:'folders',action:'save',project:parsed.data})}catch{return Response.json({error:'Invalid request.'},{status:400})}
}
export async function PATCH(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to Session.'},{status:401});
 try{const parsed=DriveLinkSchema.safeParse(await req.json());if(!parsed.success)return Response.json({error:'Invalid project link.'},{status:400});return respond({owner:user.userId,resource:'folders',action:'import',project:parsed.data})}catch{return Response.json({error:'Invalid request.'},{status:400})}
}
