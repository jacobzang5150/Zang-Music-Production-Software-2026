import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DriveApi,DriveError,parseDriveLink,DRIVE_FOLDER,isAudio,isText,readableSize} from '../lib/drive-files.ts';
test('recognizes Drive links while rejecting lookalikes and executable protocols',()=>{
 assert.deepEqual(parseDriveLink('https://drive.google.com/drive/u/0/folders/abc_123?resourcekey=secret'),{id:'abc_123',resourceKey:'secret'});
 assert.deepEqual(parseDriveLink('https://docs.google.com/document/d/doc-id/edit'),{id:'doc-id',resourceKey:undefined});
 assert.equal(parseDriveLink('https://drive.google.com.evil.test/drive/folders/abc'),null);
 assert.equal(parseDriveLink('javascript:alert(1)'),null);
 assert.equal(parseDriveLink('https://example.com/drive/folders/abc'),null);
});
test('audio and plain-text detection does not treat Google documents as raw files',()=>{
 assert(isAudio({id:'a',name:'Mix.WAV',mimeType:'application/octet-stream'}));
 assert(isText({id:'a',name:'Lyrics.txt',mimeType:'text/plain'}));
 assert(!isText({id:'a',name:'Lyrics.txt',mimeType:'application/vnd.google-apps.document'}));
 assert.equal(readableSize('1048576'),'1.0 MB');
});
test('folder requests are scoped, include shared drives and pagination, and attach auth only to Google',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));assert.equal(url.origin,'https://www.googleapis.com');assert.equal(url.searchParams.get('q'),"'parent' in parents and trashed = false");assert.equal(url.searchParams.get('pageToken'),'next');assert.equal(url.searchParams.get('supportsAllDrives'),'true');assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer test');
   return Response.json({files:[{id:'a',name:'Track',mimeType:'audio/wav',resourceKey:'rk'}],nextPageToken:'more'});
  };
  const api=new DriveApi('test');const result=await api.list('parent','next');assert.equal(result.nextPageToken,'more');assert.equal(api.keys.get('a'),'rk');
 }finally{globalThis.fetch=original}
});
test('expired authorization surfaces a reconnect error and does not retry writes',async()=>{
 const original=globalThis.fetch;let count=0;
 try{globalThis.fetch=async()=>{count++;return Response.json({error:{}},{status:401})};await assert.rejects(new DriveApi('expired').rename('file','New name'),e=>e instanceof DriveError&&e.status===401);assert.equal(count,1)}finally{globalThis.fetch=original}
});
test('uploads resume the same session after interrupted chunks without creating duplicate files',async()=>{
 const original=globalThis.fetch;const requests:{method?:string;url:string;range:string|null}[]=[];let interrupted=false;let uploaded=0;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=String(input),range=new Headers(init?.headers).get('Content-Range');requests.push({url,method:init?.method,range});
   if(init?.method==='POST')return new Response(null,{headers:{Location:'https://www.googleapis.com/upload/session'}});
   if(!interrupted){interrupted=true;uploaded=8*1024*1024;throw new TypeError('Connection lost after chunk accepted')}
   if(range?.startsWith('bytes */'))return new Response(null,{status:308,headers:{Range:'bytes=0-'+(uploaded-1)}});
   assert.equal(range,`bytes ${uploaded}-${9*1024*1024-1}/${9*1024*1024}`);
   return Response.json({id:'new',name:'Mix.wav',mimeType:'audio/wav'});
  };
  const result=await new DriveApi('test').upload(new File([new Uint8Array(9*1024*1024)],'Mix.wav',{type:'audio/wav'}),'folder',()=>{},new AbortController().signal);
  assert.equal(result.id,'new');assert.equal(requests.filter(r=>r.method==='POST').length,1);assert.equal(requests.length,4);
 }finally{globalThis.fetch=original}
});
test('untrusted upload destinations are rejected before file data is sent',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return new Response(null,{headers:{Location:'https://evil.test/upload'}})};await assert.rejects(new DriveApi('test').upload(new File(['x'],'x.txt'),'folder',()=>{},new AbortController().signal),/valid upload destination/);assert.equal(calls,1)}finally{globalThis.fetch=original}
});
test('download restrictions are honored without issuing a media request',async()=>{
 await assert.rejects(new DriveApi('test').content({id:'x',name:'Mix',mimeType:'audio/wav',capabilities:{canDownload:false}}),/disabled/);
});
