import {z} from 'zod';
import {ensureInvoice} from '@/lib/invoice-store';
import {getChatGPTUser} from '../../chatgpt-auth';
import {ProjectSchema,mergeDriveName} from '@/lib/projects';
import {callStudioDatabase} from '@/lib/supabase';
async function respond(input:Parameters<typeof callStudioDatabase>[0]){
  try{const response=await callStudioDatabase(input);return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return Response.json({error:'Could not connect to project storage. Please try again.'},{status:503})}
}
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to view projects.'},{status:401});return respond({owner:user.userId,action:'list'});}
// Background metadata must merge against the latest record, never a stale UI snapshot.
export async function PATCH(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save projects.'},{status:401});
 const input=z.object({id:z.string().min(1).max(80),url:z.string().url(),clientSync:z.object({expectedClient:z.string(),expectedClientId:z.string().optional()}).optional(),nameSync:z.object({expectedName:z.string(),expectedPending:z.boolean(),name:z.string().trim().min(1).max(160)}).optional()}).safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({error:'Invalid sharing status.'},{status:400});
 try{
  for(let attempt=0;attempt<5;attempt++){
   const listed=await callStudioDatabase({owner:user.userId,action:'list'});if(!listed.ok)return new Response(listed.body,{status:listed.status});
   const records=await listed.json() as (z.infer<typeof ProjectSchema>&{revision:number})[];
   const latest=records.find(p=>p.id===input.data.id);if(!latest)return Response.json({error:'Project no longer exists.'},{status:404});
   if(latest.deliverablesUrl!==input.data.url)return Response.json(latest);
   const sync=input.data.nameSync,clientSync=input.data.clientSync;
   if(clientSync&&(latest.client!==clientSync.expectedClient||latest.clientId!==clientSync.expectedClientId))return Response.json(latest);
   if(!sync&&!clientSync&&latest.driveSharingProcessedUrl===input.data.url)return Response.json(latest);
   const project=sync?mergeDriveName(latest,sync):clientSync?{...latest}:{...latest,driveSharingProcessedUrl:input.data.url};
   if(!project)return Response.json(latest);
   if(clientSync)project.driveClientPending=false;
   const saved=await callStudioDatabase({owner:user.userId,action:'save',revision:latest.revision,project});
   if(saved.status===409){await saved.body?.cancel();continue;}
   return new Response(saved.body,{status:saved.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  return Response.json({error:'Project is being updated. Retry Drive setup shortly.'},{status:409});
 }catch{return Response.json({error:'Could not save the link-sharing status. Please retry.'},{status:503})}
}
export async function PUT(req:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to save projects.'},{status:401});
  try{const raw=await req.json();const revisionCheck=z.object({revision:z.number().int().min(0)}).safeParse(raw);const parsed=ProjectSchema.safeParse(raw);
    if(!revisionCheck.success||!parsed.success)return Response.json({error:!parsed.success?parsed.error.issues[0].message:'Invalid revision'},{status:400});
    const stored=await callStudioDatabase({owner:user.userId,action:'save',project:parsed.data,revision:revisionCheck.data.revision});
    if(!stored.ok)return new Response(stored.body,{status:stored.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    const saved=await stored.json() as z.infer<typeof ProjectSchema>&{revision:number;invoiceError?:string};
    if(saved.deliveredAt){try{await ensureInvoice(user.userId,saved.id)}catch{saved.invoiceError='Project saved. Invoice could not be generated yet. Open Invoice to retry.'}}
    return Response.json(saved,{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Invalid project data'},{status:400})}
}
export async function DELETE(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in required'},{status:401});try{const parsed=z.object({id:z.string().min(1).max(80),revision:z.number().int().positive()}).safeParse(await req.json());if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});return respond({owner:user.userId,action:'delete',...parsed.data});}catch{return Response.json({error:'Invalid request'},{status:400})}}
