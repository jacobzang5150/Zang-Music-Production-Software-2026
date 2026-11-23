import {getChatGPTUser} from '../../chatgpt-auth';
import {callStudioDatabase} from '@/lib/supabase';
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to view history.'},{status:401});
 const params=new URL(req.url).searchParams,project=params.get('project')||undefined,before=params.get('before')||undefined;
 if(project&&project.length>80||before&&!/^[1-9][0-9]{0,17}$/.test(before))return Response.json({error:'Invalid history filter.'},{status:400});
 try{const r=await callStudioDatabase({owner:user.userId,resource:'history',action:'list',id:project,historyCursor:before});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch{return Response.json({error:'Could not load history. Please retry.'},{status:503})}
}
