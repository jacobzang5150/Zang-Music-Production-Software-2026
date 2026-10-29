import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DriveApi,DRIVE_FOLDER,type DriveFile} from '../lib/drive-files.ts';
import {DriveFolderSetup,needsDriveFolderSetup} from '../lib/drive-folders.ts';
import type {FolderReservation} from '../lib/drive-folders-schema.ts';
function fixture(initial:DriveFile[]=[]){
 const files=new Map(initial.map(f=>[f.id,f]));const reservations=new Map<string,FolderReservation>();let serial=0,creates=0;let failName='';
 const fetchMock:typeof fetch=async(input,init)=>{
  const raw=String(input),body=init?.body?JSON.parse(String(init.body)):null,method=init?.method||'GET';
  if(raw==='/api/drive/folders'){
   assert.equal(new Headers(init?.headers).get('Authorization'),null);
   if(method==='GET')return Response.json([...reservations.values()]);
   if(!reservations.has(body.id))reservations.set(body.id,body);return Response.json(reservations.get(body.id));
  }
  const u=new URL(raw);assert.equal(u.origin,'https://www.googleapis.com');
  assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer fake');
  const path=u.pathname.replace('/drive/v3/','');
  if(path==='about')return Response.json({user:{permissionId:'account'}});
  if(path==='files/root')return Response.json({id:'root-id',name:'My Drive',mimeType:DRIVE_FOLDER});
  if(path==='files/generateIds')return Response.json({ids:['generated-'+(++serial)]});
  if(path==='files'&&method==='GET'){
   const parent=u.searchParams.get('q')?.match(/'([^']+)' in parents/)?.[1];
   return Response.json({files:[...files.values()].filter(f=>!f.trashed&&(!parent||f.parents?.includes(parent)))});
  }
  if(path==='files'&&method==='POST'){
   if(body.name===failName){failName='';return Response.json({error:{message:'Temporary failure'}},{status:503})}
   if(files.has(body.id))return Response.json({error:{message:'Already created'}},{status:409});
   const file={...body,capabilities:{canAddChildren:true}};files.set(body.id,file);creates++;return Response.json(file);
  }
  if(path.startsWith('files/')){const file=files.get(path.slice(6));return file?Response.json(file):Response.json({error:{message:'Missing'}},{status:404})}
  throw new Error('Unexpected request '+raw);
 };
 return {files,reservations,fetchMock,get creates(){return creates},failOnce(name:string){failName=name}};
}
async function manager(){const m=new DriveFolderSetup(new DriveApi('fake'));await m.initialize();return m}
test('concurrent sessions reserve the same IDs and create only one client/project tree',async()=>{
 const real=globalThis.fetch,f=fixture();globalThis.fetch=f.fetchMock;
 try{const [a,b]=await Promise.all([manager(),manager()]);const p={id:'project',client:'Artist',name:'Album'};const [x,y]=await Promise.all([a.project(p),b.project(p)]);assert.equal(x.file.id,y.file.id);assert.equal(f.creates,5);assert.equal(f.reservations.size,5)}finally{globalThis.fetch=real}
});
test('existing client folders are reused case-insensitively; projects stay separated under that client',async()=>{
 const real=globalThis.fetch,f=fixture([{id:'client',name:'ARTIST',mimeType:DRIVE_FOLDER,parents:['existing-studio']}]);globalThis.fetch=f.fetchMock;
 try{const m=await manager();const a=await m.project({id:'a',client:' Artist ',name:'First'});const b=await m.project({id:'b',client:'artist',name:'Second'});assert.deepEqual(a.file.parents,['client']);assert.deepEqual(b.file.parents,['client']);assert.notEqual(a.file.id,b.file.id);assert.equal(f.creates,8);assert.equal(f.files.get('client')?.name,'ARTIST');for(const parent of [a.file.id,b.file.id])assert.deepEqual([...f.files.values()].filter(f=>f.parents?.includes(parent)).map(f=>f.name).sort(),['EDITS','MASTERS','MIXES'])}finally{globalThis.fetch=real}
});
test('partial setup resumes with the reserved IDs, without duplicate folders or touching existing files',async()=>{
 const real=globalThis.fetch,f=fixture([{id:'client',name:'Artist',mimeType:DRIVE_FOLDER,parents:['root-id']},{id:'album',name:'Album',mimeType:DRIVE_FOLDER,parents:['client']},{id:'mix',name:'Original.wav',mimeType:'audio/wav',parents:['album']}]);globalThis.fetch=f.fetchMock;
 try{const p={id:'a',client:'Artist',name:'Album'};f.failOnce('MIXES');await assert.rejects((await manager()).project(p),/Temporary/);const mixReservation=[...f.reservations.values()].find(r=>r.name==='MIXES')!;await (await manager()).project(p);assert(f.files.has(mixReservation.folderId));assert.equal(f.creates,3);assert(f.files.has('mix'));assert.equal(f.files.size,6)}finally{globalThis.fetch=real}
});
test('a trashed folder is reported instead of making a replacement duplicate',async()=>{
 const real=globalThis.fetch,f=fixture();globalThis.fetch=f.fetchMock;
 try{const p={id:'a',client:'Artist',name:'Album'};const result=await (await manager()).project(p);f.files.get(result.file.id)!.trashed=true;await assert.rejects((await manager()).project(p),/Drive Trash/);assert.equal(f.creates,5)}finally{globalThis.fetch=real}
});

test('saved links skip setup after reconnect even when folders have been deleted or projects renamed',async()=>{
 const real=globalThis.fetch,f=fixture();globalThis.fetch=f.fetchMock;
 try{
  const p={id:'a',client:'Artist',name:'Album'};const result=await (await manager()).project(p);
  const saved={...p,deliverablesUrl:'https://drive.google.com/drive/folders/'+result.file.id};
  const edits=[...f.files.values()].find(file=>file.name==='EDITS')!;f.files.delete(edits.id);
  let requests=0;globalThis.fetch=async()=>{requests++;throw new Error('Completed projects must not query Drive during reconnect')};
  const restored=JSON.parse(JSON.stringify(saved));
  assert.deepEqual([restored,{...restored,name:'Renamed album'}].filter(needsDriveFolderSetup),[]);
  f.files.delete(result.file.id);assert.equal(needsDriveFolderSetup(restored),false);
  assert.equal(needsDriveFolderSetup({...p,deliverablesUrl:''}),true);
  assert.equal(requests,0);assert.equal(f.creates,5);assert(!f.files.has(edits.id));
 }finally{globalThis.fetch=real}
});
test('sharing is a one-time migration per saved link, independent from folder creation',async()=>{
 const {needsDriveLinkSharing}=await import('../lib/drive-folders.ts');
 const url='https://drive.google.com/drive/folders/folder';
 assert(needsDriveLinkSharing({deliverablesUrl:url}));
 assert(!needsDriveFolderSetup({deliverablesUrl:url}));
 const saved=JSON.parse(JSON.stringify({deliverablesUrl:url,driveSharingProcessedUrl:url}));
 assert(!needsDriveLinkSharing(saved));assert(!needsDriveFolderSetup(saved));
 assert(needsDriveLinkSharing({...saved,deliverablesUrl:url+'-changed'}));
 assert(!needsDriveLinkSharing({deliverablesUrl:'https://example.com/folder'}));
});
