import test from 'node:test';
import assert from 'node:assert/strict';
import {DriveUploadQueue,type UploadJob,type UploadQueueState} from '../lib/drive-upload-queue.ts';
test('new drops join an active queue and keep their own destinations and combined progress',async()=>{
 const starts:string[]=[],finished:string[]=[],states:UploadQueueState[]=[];let release!:()=>void;
 const queue=new DriveUploadQueue(s=>states.push({...s}),e=>{throw e},j=>finished.push(j.destination.id));
 const job=(name:string,destination:string,wait=false):UploadJob=>({file:new File(['x'.repeat(100)],name),destination:{id:destination,name:destination},run:async progress=>{starts.push(name+':'+destination);progress(50);if(wait)await new Promise<void>(resolve=>release=resolve);progress(100)}});
 queue.add([job('one','A',true)]);assert.equal(queue.running,true);assert.equal(states.at(-1)?.percent,50);
 queue.add([job('two','B'),job('three','A')]);assert.deepEqual(starts,['one:A']);assert.equal(states.at(-1)?.total,3);assert.equal(states.at(-1)?.percent,17);
 release();await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(starts,['one:A','two:B','three:A']);assert.deepEqual(finished,['A','B','A']);assert.equal(states.at(-1)?.percent,100);assert.equal(queue.running,false);
});
test('a failed upload does not discard later queued drops',async()=>{let failures=0,done=0;const q=new DriveUploadQueue(()=>{},()=>failures++,()=>done++);const file=new File(['a'],'a'),destination={id:'A',name:'A'};q.add([{file,destination,run:async()=>{throw Error('Upload failed')}},{file,destination,run:async()=>{}}]);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(failures,1);assert.equal(done,1);assert.equal(q.completed,2)});
