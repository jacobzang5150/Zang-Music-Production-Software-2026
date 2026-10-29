import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sealDriveToken,openDriveToken,validDriveMutation} from '../lib/drive-token-vault.ts';
test('stored Google refresh tokens are encrypted, randomized and bound to their Session owner',async()=>{
 const secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 const one=await sealDriveToken(secret,'owner-a','refresh-private'),two=await sealDriveToken(secret,'owner-a','refresh-private');
 assert.notEqual(one,two);assert(!one.includes('refresh-private'));assert.equal(await openDriveToken(secret,'owner-a',one),'refresh-private');
 await assert.rejects(openDriveToken(secret,'owner-b',one));
 const parts=one.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await assert.rejects(openDriveToken(secret,'owner-a',parts.join('.')));
});
test('connection writes require the exact origin and a non-simple CSRF header',()=>{
 const origin='https://session.example';
 const request=(headers:Record<string,string>)=>new Request(origin+'/api/drive/session',{method:'POST',headers});
 const headers={'Origin':origin,'X-Requested-With':'XmlHttpRequest','Content-Type':'application/json'};
 assert(validDriveMutation(request(headers),origin));assert(!validDriveMutation(request({...headers,Origin:'https://other.example'}),origin));assert(!validDriveMutation(request({...headers,'X-Requested-With':''}),origin));assert(!validDriveMutation(request({...headers,'Content-Type':'text/plain'}),origin));
});
