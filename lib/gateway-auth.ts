export const GATEWAY_AUDIENCE='zang-studio-projects';
export type GatewayClaims={aud:string;exp:number;iat:number;owner:string;action:'list'|'save'|'delete'|'import';project?:unknown;revision?:number;id?:string};
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function decode(value:string){const str=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(str,c=>c.charCodeAt(0));}
export async function signGatewayRequest(privateJwk:JsonWebKey,input:Omit<GatewayClaims,'aud'|'exp'|'iat'>){
  const now=Math.floor(Date.now()/1000);
  const claims:GatewayClaims={...input,aud:GATEWAY_AUDIENCE,iat:now,exp:now+60};
  const encoder=new TextEncoder();
  const unsigned=encode(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+encode(encoder.encode(JSON.stringify(claims)));
  const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(unsigned));
  return unsigned+'.'+encode(new Uint8Array(signature));
}
export async function verifyGatewayRequest(publicJwk:JsonWebKey,token:string):Promise<GatewayClaims>{
  const parts=token.split('.');if(parts.length!==3||token.length>500000)throw new Error('Invalid token');
  const decoder=new TextDecoder();const header=JSON.parse(decoder.decode(decode(parts[0])));
  if(header.alg!=='RS256')throw new Error('Invalid algorithm');
  const key=await crypto.subtle.importKey('jwk',publicJwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error('Invalid signature');
  const claims=JSON.parse(decoder.decode(decode(parts[1]))) as GatewayClaims;const now=Math.floor(Date.now()/1000);
  if(claims.aud!==GATEWAY_AUDIENCE||!Number.isInteger(claims.exp)||!Number.isInteger(claims.iat)||claims.exp<=now||claims.iat>now+10||claims.exp-claims.iat>60||!claims.owner||typeof claims.owner!=='string'||claims.owner.length>200||!['list','save','delete','import'].includes(claims.action))throw new Error('Invalid claims');
  return claims;
}
