import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreDriveConnection,currentDriveToken,forgetDriveToken,disconnectDrive} from '../lib/google-drive-browser.ts';
test('restores Drive silently, coalesces refreshes, and does not resurrect a disconnected session',async()=>{
 const g=globalThis as any,oldWindow=g.window,oldFetch=globalThis.fetch;g.window=new EventTarget();let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return Response.json({connected:true,accessToken:'restored',expiresIn:3600})};
  const result=await Promise.all([restoreDriveConnection(),restoreDriveConnection()]);assert.deepEqual(result,['restored','restored']);assert.equal(calls,1);assert.equal(currentDriveToken(),'restored');
  await restoreDriveConnection();assert.equal(calls,1);
  forgetDriveToken();let resolve!:(r:Response)=>void;
  globalThis.fetch=async(_input,options)=>{if(options?.method==='DELETE')return Response.json({ok:true});return new Promise<Response>(r=>resolve=r)};
  const pending=restoreDriveConnection();await disconnectDrive();resolve(Response.json({connected:true,accessToken:'old-token',expiresIn:3600}));await pending;assert.equal(currentDriveToken(),null);
  globalThis.fetch=async()=>Response.json({connected:false,reconnect:true});assert.equal(await restoreDriveConnection(),null);
  globalThis.fetch=async()=>Response.json({error:'temporary'},{status:503});await assert.rejects(disconnectDrive(),/Could not forget/);
 }finally{forgetDriveToken();globalThis.fetch=oldFetch;g.window=oldWindow}
});
