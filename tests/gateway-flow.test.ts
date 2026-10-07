import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import ts from 'typescript';
import {signGatewayRequest} from '../lib/gateway-auth.ts';
import {newOverdub,paymentStatus} from '../lib/projects.ts';
test('gateway integrates saved clients, ownership, revision checks, delivery and payment',async()=>{
 const root=new URL('../',import.meta.url),file=new URL('.sites-runtime/gateway-flow-test.mjs',root);
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
 let handler:(r:Request)=>Promise<Response>;const g=globalThis as any,oldDeno=g.Deno,oldFetch=globalThis.fetch;
 const tables:Record<string,any[]>={studio_clients:[],studio_projects:[],studio_leads:[]};
 g.__gatewayTestKey=publicKey;g.Deno={env:{get:(k:string)=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'} as Record<string,string>)[k]},serve:(h:typeof handler)=>{handler=h}};
 globalThis.fetch=async(input:any,options:any={})=>{
  const url=new URL(String(input)),table=url.pathname.split('/').at(-1)!;let rows=tables[table];assert(rows,table);
  const query=url.searchParams;const matches=(r:any)=>[...query].every(([k,v])=>!v.startsWith('eq.')||String(k==='name_key'?r.data.name.trim().toLowerCase():r[k])===v.slice(3));
  if((options.method||'GET')==='GET')return Response.json(rows.filter(matches).slice(Number(query.get('offset')||0),Number(query.get('offset')||0)+Number(query.get('limit')||1000)));
  const body=options.body?JSON.parse(options.body):null;
  if(options.method==='POST'){const conflict=rows.find(r=>r.owner===body.owner&&(r.id===body.id||(table==='studio_clients'&&r.data.name.trim().toLowerCase()===body.data.name.trim().toLowerCase())));if(conflict)return String(options.headers.Prefer).includes('ignore-duplicates')?Response.json([]):Response.json({error:'Duplicate'},{status:409});rows.push(body);return Response.json([body]);}
  const chosen=rows.filter(matches);if(options.method==='PATCH'){chosen.forEach(r=>Object.assign(r,body));return Response.json(chosen);}
  if(options.method==='DELETE'){tables[table]=rows.filter(r=>!matches(r));return Response.json(chosen);}
  throw new Error('Unexpected database method');
 };
 try{
  let source=await readFile(new URL('supabase/functions/studio-data/index.ts',root),'utf8');
  source=source.replace("import publicKey from './public-key.json' with {type:'json'};",'const publicKey=globalThis.__gatewayTestKey;').replaceAll("'../../../lib/","'../lib/");
  await mkdir(new URL('.sites-runtime/',root),{recursive:true});await writeFile(file,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);await import(file.href);
  async function call(resource:'projects'|'clients',action:'list'|'save',extra:Record<string,unknown>={},owner='owner-a'){
   const token=await signGatewayRequest(privateKey,{owner,resource,action,...extra});const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}));return {status:response.status,data:await response.json() as any};
  }
  let r=await call('clients','save',{project:{id:'ignored',name:'Artist'},revision:0});assert.equal(r.status,200);const client=r.data;
  r=await call('clients','save',{project:{id:'other',name:' artist '},revision:0});assert.equal(r.data.id,client.id);assert.equal(tables.studio_clients.length,1);
  r=await call('clients','list',{},'owner-b');assert.deepEqual(r.data,[]);
  const draft=newOverdub();draft.name='Song';draft.client=client.name;draft.clientId=client.id;draft.songs[0].name='Song';
  r=await call('projects','save',{project:draft,revision:0},'owner-b');assert.equal(r.status,400);
  r=await call('projects','save',{project:draft,revision:0});assert.equal(r.status,200);let project=r.data;
  r=await call('projects','save',{project:{...project,deliveredAt:'2000-01-01T00:00:00.000Z'},revision:project.revision});assert.equal(r.status,200);project=r.data;assert.notEqual(project.deliveredAt,'2000-01-01T00:00:00.000Z');const deliveredAt=project.deliveredAt;
  r=await call('projects','save',{project:{...project,name:'Edited'},revision:project.revision});assert.equal(r.status,200);project=r.data;assert.equal(project.deliveredAt,deliveredAt);
  r=await call('projects','save',{project,revision:1});assert.equal(r.status,409);
  r=await call('projects','save',{project:{...project,paymentReceivedAt:new Date().toISOString()},revision:project.revision});assert.equal(r.status,200);assert.equal(paymentStatus(r.data).state,'paid');assert.equal(r.data.deliveredAt,deliveredAt);
 }finally{globalThis.fetch=oldFetch;g.Deno=oldDeno;delete g.__gatewayTestKey;await unlink(file).catch(()=>{})}
});
