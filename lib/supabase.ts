import {env} from 'cloudflare:workers';
import {signGatewayRequest,type GatewayClaims} from './gateway-auth';
export async function callStudioDatabase(input:Omit<GatewayClaims,'aud'|'exp'|'iat'>){
  if(!env.SUPABASE_URL||!env.SUPABASE_GATEWAY_PRIVATE_JWK)throw new Error('Supabase is not configured');
  const token=await signGatewayRequest(JSON.parse(env.SUPABASE_GATEWAY_PRIVATE_JWK),input);
  return fetch(env.SUPABASE_URL+'/functions/v1/studio-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(20000)});
}
