import {verifyGatewayRequest} from '../../../lib/gateway-auth.ts';
import {LeadSchema} from '../../../lib/leads.ts';
import {ClientSchema} from '../../../lib/clients.ts';
import {ProjectSchema,applyDeliveryTransition,type Project} from '../../../lib/projects.ts';
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
    const root=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
    const resource=claims.resource||'projects';
    const table=resource==='clients'?'studio_clients':resource==='leads'?'studio_leads':'studio_projects';
    const base=()=>new URLSearchParams({owner:'eq.'+claims.owner});
    async function getRows(tableName:string,query:URLSearchParams){const r=await fetch(root+tableName+'?'+query,{headers});if(!r.ok)throw new Error('Database read failed');return await r.json();}
    async function ensureClient(name:string,clientId?:string){
      if(clientId){const q=base();q.set('id','eq.'+clientId);const rows=await getRows('studio_clients',q);if(!rows.length)return null;return {...rows[0].data,revision:rows[0].revision};}
      const id=crypto.randomUUID(),q=base();q.set('on_conflict','owner,name_key');
      const r=await fetch(root+'studio_clients?'+q,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({owner:claims.owner,id,data:{id,name:name.trim()},revision:1})});
      if(!r.ok)throw new Error('Client save failed');const inserted=await r.json();if(inserted.length)return {...inserted[0].data,revision:inserted[0].revision};
      const find=base();find.set('name_key','eq.'+name.trim().toLowerCase());const rows=await getRows('studio_clients',find);if(!rows.length)throw new Error('Client lookup failed');return {...rows[0].data,revision:rows[0].revision};
    }
    if(claims.action==='list'){
      const records=[];
      for(let offset=0;;offset+=500){const q=base();q.set('order','id.asc');q.set('limit','500');q.set('offset',String(offset));const rows=await getRows(table,q);records.push(...rows.map((r:{data:object;revision:number})=>({...r.data,revision:r.revision})));if(rows.length<500)break;}
      return reply(records);
    }
    if(resource==='clients'){
      if(claims.action!=='save'||claims.revision!==0)return reply({error:'Only new-client creation is supported'},400);
      const parsed=ClientSchema.safeParse(claims.project);if(!parsed.success)return reply({error:'Enter a valid client name'},400);
      return reply(await ensureClient(parsed.data.name));
    }
    if(claims.action==='save'||claims.action==='import'){
      const parsed=(resource==='leads'?LeadSchema:ProjectSchema).safeParse(claims.project);if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
      let p=parsed.data;const revision=claims.revision;if(!Number.isInteger(revision)||revision!<0)return reply({error:'Invalid revision'},400);
      const q=base();let previous:Project|undefined;
      if(revision!>0&&claims.action!=='import'){q.set('id','eq.'+p.id);q.set('revision','eq.'+revision);const existing=await getRows(table,q);if(!existing.length)return reply({error:'This record changed in another tab. Reload before editing.'},409);previous=existing[0].data;}
      if(resource==='projects'){
        const project=p as Project;const client=await ensureClient(project.client,project.clientId);if(!client)return reply({error:'Client not found. Select a saved client or create a new one.'},400);
        p=applyDeliveryTransition(previous,{...project,clientId:client.id,client:client.name});
      }else await ensureClient(p.name);
      if(revision===0||claims.action==='import'){
        if(claims.action==='import'){if(revision!<1)return reply({error:'Invalid revision'},400);q.set('on_conflict','owner,id');}
        const r=await fetch(root+table+'?'+q,{method:'POST',headers:claims.action==='import'?{...headers,Prefer:'resolution=ignore-duplicates,return=representation'}:headers,body:JSON.stringify({owner:claims.owner,id:p.id,data:p,revision:claims.action==='import'?revision:1})});
        if(!r.ok)return reply({error:r.status===409?'Record already exists. Reload before editing.':'Unable to save record'},r.status===409?409:502);
        return reply({...p,revision:claims.action==='import'?revision:1});
      }
      const r=await fetch(root+table+'?'+q,{method:'PATCH',headers,body:JSON.stringify({data:p,revision:revision!+1})});if(!r.ok)throw new Error('Database update failed');const rows=await r.json();
      return rows.length?reply({...p,revision:revision!+1}):reply({error:'This record changed in another tab. Reload before editing.'},409);
    }
    if(claims.action==='delete'){
      if(typeof claims.id!=='string'||!Number.isInteger(claims.revision)||claims.revision!<1)return reply({error:'Invalid request'},400);
      const q=base();q.set('id','eq.'+claims.id);q.set('revision','eq.'+claims.revision);
      const r=await fetch(root+table+'?'+q,{method:'DELETE',headers});if(!r.ok)throw new Error('Database delete failed');const rows=await r.json();return rows.length?reply({ok:true}):reply({error:'Record changed. Reload before deleting.'},409);
    }
    return reply({error:'Invalid action'},400);
  }catch{return reply({error:'Database unavailable. Please try again.'},502)}
});
