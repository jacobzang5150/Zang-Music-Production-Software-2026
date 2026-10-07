import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signGatewayRequest,verifyGatewayRequest} from '../lib/gateway-auth.ts';
test('gateway rejects forged or tampered requests and accepts signed ownership',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const privateKey=await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const token=await signGatewayRequest(privateKey,{owner:'owner-a',action:'list'});
 assert.equal((await verifyGatewayRequest(publicKey,token)).owner,'owner-a');
 const parts=token.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.owner='owner-b';parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
 await assert.rejects(verifyGatewayRequest(publicKey,parts.join('.')));
 await assert.rejects(verifyGatewayRequest(publicKey,'invalid'));
});
