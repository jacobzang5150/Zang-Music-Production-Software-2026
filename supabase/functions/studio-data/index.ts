import {InvoiceSchema} from '../../../lib/invoice.ts';
import {verifyGatewayRequest} from '../../../lib/gateway-auth.ts';
import {DriveAuthSchema} from '../../../lib/drive-auth-schema.ts';
import {DriveFolderSchema,DriveLinkSchema} from '../../../lib/drive-folders-schema.ts';
import {LeadSchema} from '../../../lib/leads.ts';
import {BudgetSchema,createBudget} from '../../../lib/budget.ts';
import {BudgetLinkSchema} from '../../../lib/budget-sharing.ts';
import {ClientSchema} from '../../../lib/clients.ts';
import {ProjectSchema,applyDeliveryTransition,driveNamePendingAfterSave,driveClientPendingAfterSave,type Project} from '../../../lib/projects.ts';
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
    const table=resource==='invoices'?'studio_invoices':resource==='budgets'?'studio_budgets':resource==='driveAuth'?'studio_drive_auth':resource==='folders'?'studio_drive_folders':resource==='clients'?'studio_clients':resource==='leads'?'studio_leads':'studio_projects';
    const base=()=>new URLSearchParams({owner:'eq.'+claims.owner});
    async function getRows(tableName:string,query:URLSearchParams){const r=await fetch(root+tableName+'?'+query,{headers});if(!r.ok)throw new Error('Database read failed');return await r.json();}
    async function ensureClient(name:string,clientId?:string){
      if(clientId){const q=base();q.set('id','eq.'+clientId);const rows=await getRows('studio_clients',q);if(!rows.length)return null;return {...rows[0].data,revision:rows[0].revision};}
      const id=crypto.randomUUID(),q=base();q.set('on_conflict','owner,name_key');
      const r=await fetch(root+'studio_clients?'+q,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({owner:claims.owner,id,data:{id,name:name.trim()},revision:1})});
      if(!r.ok)throw new Error('Client save failed');const inserted=await r.json();if(inserted.length)return {...inserted[0].data,revision:inserted[0].revision};
      const find=base();find.set('name_key','eq.'+name.trim().toLowerCase());const rows=await getRows('studio_clients',find);if(!rows.length)throw new Error('Client lookup failed');return {...rows[0].data,revision:rows[0].revision};
    }
    if(resource==='invoices'){
      const q=base();
      if(claims.action==='list'){
        if(typeof claims.id!=='string'||!claims.id||claims.id.length>200)return reply({error:'Invalid invoice'},400);
        q.set('id','eq.'+claims.id);const rows=await getRows(table,q);return reply(rows.map((r:{data:object;revision:number})=>({...r.data,revision:r.revision})));
      }
      if(claims.action!=='save')return reply({error:'Invalid invoice operation'},400);
      const parsed=InvoiceSchema.safeParse(claims.project),revision=claims.revision;
      if(!parsed.success||!Number.isInteger(revision)||revision!<0)return reply({error:'Invalid invoice'},400);
      const data=parsed.data;
      if(revision===0){
       const r=await fetch(root+table,{method:'POST',headers,body:JSON.stringify({owner:claims.owner,id:data.id,data,revision:1})});
       if(!r.ok){const detail=await r.json().catch(()=>null);const exhausted=detail?.message==='All 9000 invoice numbers have been used. No number was reused.';return reply({error:exhausted?detail.message:r.status===409?'Invoice already exists. Reopen it.':'Could not create invoice.'},exhausted?422:r.status===409?409:502)}
       const rows=await r.json();return reply({...rows[0].data,revision:rows[0].revision});
      }
      q.set('id','eq.'+data.id);q.set('revision','eq.'+revision);
      const r=await fetch(root+table+'?'+q,{method:'PATCH',headers,body:JSON.stringify({data,revision:revision!+1})});if(!r.ok)throw new Error('Invoice save failed');
      const rows=await r.json();return rows.length?reply({...rows[0].data,revision:rows[0].revision}):reply({error:'Invoice changed in another tab. Close and reopen it before editing.'},409);
    }
    if(resource==='budgets'){
      const link=claims.action==='import'?BudgetLinkSchema.safeParse(claims.project):null;
      const parsed=claims.action==='save'?BudgetSchema.safeParse(claims.project):null;
      const id=claims.action==='list'?claims.id:link?.success?link.data.id:parsed?.success?parsed.data.id:undefined;
      if(!id||id.length>80)return reply({error:'Invalid budget request'},400);
      if(!['list','save','import'].includes(claims.action))return reply({error:'Invalid budget operation'},400);
      const q=base();q.set('id','eq.'+id);const projects=await getRows('studio_projects',q);
      if(!projects.length)return reply({error:'Project not found'},404);
      let seed=claims.action==='list'?createBudget(projects[0].data):parsed?.success?parsed.data:null;
      if(link?.success&&link.data.action==='link'){
        const target=base();target.set('id','eq.'+link.data.targetId);const rows=await getRows('studio_projects',target);
        if(!rows.length)return reply({error:'Project not found'},404);seed=createBudget(rows[0].data);
      }
      if(claims.action==='save'&&(!Number.isInteger(claims.revision)||claims.revision!<1))return reply({error:'Invalid revision'},400);
      const r=await fetch(root+'rpc/studio_budget_operation',{method:'POST',headers,body:JSON.stringify({p_owner:claims.owner,p_id:id,p_action:link?.success?link.data.action:claims.action==='list'?'read':'save',p_data:seed,p_revision:link?.success?link.data.revision:claims.revision??null,p_key:link?.success?link.data.budgetKey:claims.budgetKey??null,p_target:link?.success?link.data.targetId??null:null})});
      if(!r.ok)throw new Error('Budget operation failed');const result=await r.json();
      if(result.error)return reply({error:result.error},result.status||400);
      return reply(claims.action==='list'?[result.budget]:result.budget);
    }
    if(claims.action==='list'){
      const records=[];
      for(let offset=0;;offset+=500){const q=base();q.set('order','id.asc');q.set('limit','500');q.set('offset',String(offset));const rows=await getRows(table,q);records.push(...rows.map((r:{data:object;revision:number})=>({...r.data,revision:r.revision})));if(rows.length<500)break;}
      return reply(records);
    }
    if(resource==='driveAuth'){
      const q=base();q.set('id','eq.connection');
      if(claims.action==='delete'){
        const r=await fetch(root+table+'?'+q,{method:'DELETE',headers});if(!r.ok)throw new Error('Disconnect failed');return reply({ok:true});
      }
      if(claims.action!=='save')return reply({error:'Invalid connection operation'},400);
      const parsed=DriveAuthSchema.safeParse(claims.project),revision=claims.revision;
      if(!parsed.success||!Number.isInteger(revision)||revision!<0)return reply({error:'Invalid connection'},400);
      const data=parsed.data;
      if(revision===0){
        const r=await fetch(root+table,{method:'POST',headers,body:JSON.stringify({owner:claims.owner,id:'connection',data,revision:1})});
        return r.ok?reply({ok:true}):reply({error:'Connection changed. Please reconnect.'},r.status===409?409:502);
      }
      q.set('revision','eq.'+revision);
      const r=await fetch(root+table+'?'+q,{method:'PATCH',headers,body:JSON.stringify({data,revision:revision!+1})});if(!r.ok)throw new Error('Connection save failed');
      return (await r.json()).length?reply({ok:true}):reply({error:'Connection changed. Please reconnect.'},409);
    }
    if(resource==='folders'){
      if(claims.action==='save'){
        const parsed=DriveFolderSchema.safeParse(claims.project);if(!parsed.success)return reply({error:'Invalid folder assignment'},400);
        const p=parsed.data,q=base();q.set('on_conflict','owner,id');
        const r=await fetch(root+table+'?'+q,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({owner:claims.owner,id:p.id,data:p,revision:1})});
        if(!r.ok)throw new Error('Folder reservation failed');
        const find=base();find.set('id','eq.'+p.id);const rows=await getRows(table,find);
        return reply(rows[0].data);
      }
      if(claims.action==='import'){
        const parsed=DriveLinkSchema.safeParse(claims.project);if(!parsed.success)return reply({error:'Invalid project link'},400);
        const input=parsed.data,find=base();find.set('id','eq.'+input.reservationId);const folders=await getRows(table,find);
        if(!folders.length)return reply({error:'Folder assignment not found'},404);
        const url='https://drive.google.com/drive/folders/'+encodeURIComponent(folders[0].data.folderId);
        // A narrow compare-and-swap preserves notes, progress and edits from other tabs.
        for(let attempt=0;attempt<4;attempt++){
          const q=base();q.set('id','eq.'+input.projectId);const rows=await getRows('studio_projects',q);
          if(!rows.length)return reply({error:'Project no longer exists'},404);
          const row=rows[0];
          if(row.data.deliverablesUrl===url)return reply({...row.data,revision:row.revision});
          if((row.data.deliverablesUrl||'')!==input.expectedUrl)return reply({error:'The Drive link changed while folders were being prepared. Retry to use the latest project.'},409);
          q.set('revision','eq.'+row.revision);
          const data={...row.data,deliverablesUrl:url};
          const r=await fetch(root+'studio_projects?'+q,{method:'PATCH',headers,body:JSON.stringify({data,revision:row.revision+1})});
          if(!r.ok)throw new Error('Project link save failed');if((await r.json()).length)return reply({...data,revision:row.revision+1});
        }
        return reply({error:'Project changed. Retry folder setup.'},409);
      }
      return reply({error:'Invalid folder operation'},400);
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
        p=applyDeliveryTransition(previous,{...project,driveClientPending:driveClientPendingAfterSave(previous,{...project,clientId:client.id,client:client.name}),driveNameSynced:project.driveNameSynced??previous?.driveNameSynced,driveNamePending:driveNamePendingAfterSave(previous,project),onHold:project.onHold??previous?.onHold,notes:project.notes??previous?.notes,deliverablesUrl:project.deliverablesUrl??previous?.deliverablesUrl,driveSharingProcessedUrl:project.driveSharingProcessedUrl??previous?.driveSharingProcessedUrl,clientId:client.id,client:client.name});
      }else await ensureClient(p.name);
      if(revision===0||claims.action==='import'){
        if(claims.action==='import'){if(revision!<1)return reply({error:'Invalid revision'},400);q.set('on_conflict','owner,id');}
        const r=await fetch(root+table+'?'+q,{method:'POST',headers:claims.action==='import'?{...headers,Prefer:'resolution=ignore-duplicates,return=representation'}:headers,body:JSON.stringify({owner:claims.owner,id:p.id,data:p,revision:claims.action==='import'?revision:1})});
        if(!r.ok)return reply({error:r.status===409?'Record already exists. Reload before editing.':'Unable to save record'},r.status===409?409:502);
        if(resource==='projects'){
          // Initialization is idempotent; opening a legacy project also creates its budget.
          try{await fetch(root+'studio_budgets?on_conflict=owner,id',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({owner:claims.owner,id:p.id,data:createBudget(p as Project),revision:1})});}catch{console.warn('Budget initialization deferred until first open');}
        }
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

