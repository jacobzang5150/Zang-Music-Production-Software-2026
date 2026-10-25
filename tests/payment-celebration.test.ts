import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playPaymentBurst} from '../lib/payment-celebration.ts';
test('payment burst waits for completion, cleans up, and handles reduced motion and unsupported animation',async()=>{
 const g=globalThis as any,oldWindow=g.window,oldDocument=g.document;
 try{
  for(const mode of ['normal','reduced','unsupported']){
   const animations:{finished:Promise<void>;cancel:()=>void}[]=[],nodes:any[]=[];
   let resolve!:()=>void,removed=false;
   const finished=new Promise<void>(r=>resolve=r);
   g.window={matchMedia:()=>({matches:mode==='reduced'})};
   g.document={body:{appendChild:()=>{}},createElement:()=>{
    const node={style:{},setAttribute:()=>{},appendChild:()=>{},remove:()=>{removed=true},animate:()=>{
     if(mode==='unsupported')throw Error('Unavailable');
     const a={finished,cancel:()=>{}};animations.push(a);return a;
    }};
    nodes.push(node);return node;
   }};
   const checkbox={isConnected:true,getBoundingClientRect:()=>({left:10,top:20,width:20,height:20})} as HTMLElement;
   let complete=false;
   const result=playPaymentBurst(checkbox).then(value=>{complete=true;return value});
   if(mode!=='unsupported'){await Promise.resolve();assert.equal(complete,false);assert.equal(animations.length,mode==='reduced'?1:24);resolve();}
   assert.equal(await result,true);assert(removed);
   assert.equal(nodes[0].style.left,'20px');assert.equal(nodes[0].style.top,'30px');
   assert.equal(await playPaymentBurst({isConnected:false} as HTMLElement),false);
  }
 }finally{g.window=oldWindow;g.document=oldDocument}
});
