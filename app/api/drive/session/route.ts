import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {callStudioDatabase} from '@/lib/supabase';
import {openDriveToken,sealDriveToken,validDriveMutation} from '@/lib/drive-token-vault';
const ORIGIN='https://studio-project-tracker.jacobzang5150.chatgpt.site';
const SCOPE='https://www.googleapis.com/auth/drive';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Pragma':'no-cache','Vary':'Cookie'}});
const configured=()=>!!env.GOOGLE_DRIVE_CLIENT_ID&&!!env.GOOGLE_DRIVE_CLIENT_SECRET&&!!env.GOOGLE_DRIVE_TOKEN_KEY;
type Connection={id:'connection';sealed:string;revision:number};
async function connection(owner:string){const r=await callStudioDatabase({owner,resource:'driveAuth',action:'list'});if(!r.ok)throw new Error('Storage unavailable');return (await r.json() as Connection[])[0]}
async function exchange(parameters:Record<string,string>){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...parameters,client_id:env.GOOGLE_DRIVE_CLIENT_ID!,client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET!}),signal:AbortSignal.timeout(20000)});
 const data=await r.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;error?:string};return {ok:r.ok,data};
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to Session first.'},401);
 if(!configured())return reply({connected:false});
 try{
  const record=await connection(user.userId);if(!record)return reply({connected:false});
  const refresh=await openDriveToken(env.GOOGLE_DRIVE_TOKEN_KEY!,user.userId,record.sealed);
  const {ok,data}=await exchange({grant_type:'refresh_token',refresh_token:refresh});
  if(!ok){if(data.error==='invalid_grant')return reply({connected:false,reconnect:true});return reply({error:'Google Drive could not reconnect. Please retry.'},503)}
  if(!data.access_token)return reply({error:'Google Drive returned an incomplete connection.'},502);
  return reply({connected:true,accessToken:data.access_token,expiresIn:data.expires_in||3600});
 }catch{return reply({error:'Could not restore the Drive connection. Please retry.'},503)}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to Session first.'},401);
 if(!validDriveMutation(req,ORIGIN))return reply({error:'Invalid connection request.'},403);
 if(!configured())return reply({error:'Remembered Drive connections need the Google OAuth client secret.'},503);
 try{
  const body=await req.json() as {code?:string};if(typeof body.code!=='string'||!body.code||body.code.length>4096)return reply({error:'Invalid authorization code.'},400);
  const previous=await connection(user.userId);
  const {ok,data}=await exchange({grant_type:'authorization_code',code:body.code,redirect_uri:ORIGIN});
  if(!ok||!data.access_token)return reply({error:'Google authorization failed. Please connect again.'},400);
  if(!data.scope?.split(' ').includes(SCOPE))return reply({error:'Allow Drive access to connect your project folders.'},400);
  // Never reuse a previous account's refresh token if Google omitted a new one.
  if(!data.refresh_token)return reply({error:'Google did not grant a remembered connection. Remove Session from your Google account’s third-party connections, then connect again.'},400);
  const sealed=await sealDriveToken(env.GOOGLE_DRIVE_TOKEN_KEY!,user.userId,data.refresh_token);
  const saved=await callStudioDatabase({owner:user.userId,resource:'driveAuth',action:'save',project:{id:'connection',sealed},revision:previous?.revision||0});
  if(!saved.ok)return reply({error:'Could not remember this connection. Please try again.'},saved.status);
  return reply({connected:true,accessToken:data.access_token,expiresIn:data.expires_in||3600});
 }catch{return reply({error:'Could not complete Google authorization. Please try again.'},503)}
}
export async function DELETE(req:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Sign in to Session first.'},401);
 if(!validDriveMutation(req,ORIGIN))return reply({error:'Invalid disconnect request.'},403);
 try{const r=await callStudioDatabase({owner:user.userId,resource:'driveAuth',action:'delete'});return r.ok?reply({ok:true}):reply({error:'Could not forget the connection. Please retry.'},503)}catch{return reply({error:'Could not forget the connection. Please retry.'},503)}
}
