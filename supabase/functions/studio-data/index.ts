import {operate} from '../../../lib/studio-database.ts';
import {verifyGatewayRequest} from '../../../lib/gateway-auth.ts';
import publicKey from './public-key.json' with {type:'json'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  let claims;
  try{const {token}=await req.json();if(typeof token!=='string')throw new Error('Missing token');claims=await verifyGatewayRequest(publicKey,token)}catch{return reply({error:'Unauthorized'},401)}
  try{
    const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
    const secret=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret)throw new Error('Missing database secret');
    return await operate(claims,secret,Deno.env.get('SUPABASE_URL')!);
  }catch{return reply({error:'Database unavailable.'},502)}
});
