import {verifyGatewayRequest} from '../../../lib/gateway-auth.ts';
import {LeadSchema} from '../../../lib/leads.ts';
import {ProjectSchema} from '../../../lib/projects.ts';
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
    const headers:Record<string,string>={apikey:secret,'Content-Type':'application/json',Prefer:'return=representation'};
    if(!secret.startsWith('sb_secret_'))headers.Authorization='Bearer '+secret;
    const query=new URLSearchParams({owner:'eq.'+claims.owner});
    const isLead=claims.resource==='leads';
    const endpoint=Deno.env.get('SUPABASE_URL')+'/rest/v1/'+(isLead?'studio_leads':'studio_projects');
    const action=claims.action;
    if(action==='list'){
      // Paginate to avoid silently losing records beyond the Data API's row limit.
      const records=[];
      for(let offset=0;;offset+=500){query.set('order','id.asc');query.set('limit','500');query.set('offset',String(offset));const r=await fetch(endpoint+'?'+query,{headers});if(!r.ok)throw new Error('Database read failed');const rows=await r.json();records.push(...rows.map((r:{data:unknown;revision:number})=>({...r.data as object,revision:r.revision})));if(rows.length<500)break;}
      return reply(records);
    }
    if(action==='save'||action==='import'){
      const parsed=(isLead?LeadSchema:ProjectSchema).safeParse(claims.project);
      if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
      const p=parsed.data;const revision=claims.revision;
      if(!Number.isInteger(revision)||revision!<0)return reply({error:'Invalid revision'},400);
      if(revision===0||action==='import'){
        if(action==='import'){if(revision!<1)return reply({error:'Invalid revision'},400);query.set('on_conflict','owner,id');headers.Prefer='resolution=ignore-duplicates,return=representation';}
        const r=await fetch(endpoint+'?'+query,{method:'POST',headers,body:JSON.stringify({owner:claims.owner,id:p.id,data:p,revision:action==='import'?revision:1})});
        if(!r.ok)return reply({error:r.status===409?'Record already exists. Reload before editing.':'Unable to save record'},r.status===409?409:502);
        return reply({...p,revision:action==='import'?revision:1});
      }
      query.set('id','eq.'+p.id);query.set('revision','eq.'+revision);
      const r=await fetch(endpoint+'?'+query,{method:'PATCH',headers,body:JSON.stringify({data:p,revision:revision!+1})});if(!r.ok)throw new Error('Database update failed');const rows=await r.json();
      if(!rows.length)return reply({error:'This record changed in another tab. Reload before editing.'},409);
      return reply({...p,revision:revision!+1});
    }
    if(action==='delete'){
      if(typeof claims.id!=='string'||!Number.isInteger(claims.revision)||claims.revision!<1)return reply({error:'Invalid request'},400);
      query.set('id','eq.'+claims.id);query.set('revision','eq.'+claims.revision);
      const r=await fetch(endpoint+'?'+query,{method:'DELETE',headers});if(!r.ok)throw new Error('Database delete failed');const rows=await r.json();return rows.length?reply({ok:true}):reply({error:'Record changed. Reload before deleting.'},409);
    }
    return reply({error:'Invalid action'},400);
  }catch{return reply({error:'Database unavailable. Please try again.'},502)}
});
