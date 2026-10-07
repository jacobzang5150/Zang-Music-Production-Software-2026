import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProjectSchema,songProgress,progress,rankProjects,score,daysLeft,type Project} from '../lib/projects.ts';
const p:Project={id:'p',name:'Record',client:'Artist',type:'EP',deadline:'2026-10-10',priority:3,stages:[{id:'a',name:'Tracking',weight:70},{id:'b',name:'Mix',weight:30}],songs:[{id:'s',name:'First',completed:['a']},{id:'t',name:'Second',completed:[]}]};
const now=new Date(2026,9,7,12);
test('weighted completion and album average',()=>{assert.equal(songProgress(p,p.songs[0]),70);assert.equal(progress(p),35);assert.equal(progress({...p,songs:p.songs.map(s=>({...s,completed:['a','b']}))}),100)});
test('validates weights, type constraints, dates, priority and unknown stage IDs',()=>{assert(ProjectSchema.safeParse(p).success);for(const q of [{...p,stages:[{id:'a',name:'A',weight:50}]},{...p,type:'Single'},{...p,deadline:'2026-02-30'},{...p,deadline:'2026-99-99'},{...p,priority:6},{...p,songs:[{...p.songs[0],completed:['missing']}]}])assert(!ProjectSchema.safeParse(q).success)});
test('deadline uses calendar days and ranking excludes delivered work',()=>{assert.equal(daysLeft(p,now),3);assert.equal(score(p,now),3*1.3/4);const done={...p,id:'done',deliveredAt:'2026-10-07T00:00:00.000Z',songs:p.songs.map(s=>({...s,completed:['a','b']}))};assert.deepEqual(rankProjects([done,p],now).map(p=>p.id),['p'])});
test('overdue first, then priority / remaining work / deadline',()=>{const late={...p,id:'late',deadline:'2026-10-06',priority:1};const high={...p,id:'high',priority:5};const due={...p,id:'due',deadline:'2026-10-07'};assert.deepEqual(rankProjects([p,high,due,late],now).map(p=>p.id),['late','due','high','p']);assert.equal(rankProjects([{...p,id:'low',priority:1},high],now)[0].id,'high')});

test('stage changes preserve earlier weights and total exactly 100',async()=>{
  const {adjustStageWeight,removeStage}=await import('../lib/projects.ts');
  const stages=[15,35,15,25,10].map((weight,i)=>({id:String(i),name:String(i),weight}));
  assert.deepEqual(adjustStageWeight(stages,1,45).map(s=>s.weight),[15,45,5,25,10]);
  assert.deepEqual(adjustStageWeight(stages,1,25).map(s=>s.weight),[15,25,25,25,10]);
  assert.deepEqual(adjustStageWeight(stages,1,100).map(s=>s.weight),[15,85,0,0,0]);
  assert.deepEqual(adjustStageWeight(stages,4,5),stages);
  for(let i=0;i<4;i++)for(let value=-10;value<=110;value+=5){const result=adjustStageWeight(stages,i,value);assert.equal(result.reduce((n,s)=>n+s.weight,0),100);assert.deepEqual(result.slice(0,i),stages.slice(0,i));assert(result.every(s=>s.weight>=0&&s.weight%5===0));}
  for(let i=0;i<5;i++)assert.equal(removeStage(stages,i).reduce((n,s)=>n+s.weight,0),100);
});

test('overdubs require guitar type and one song while production projects stay compatible',async()=>{
 const {newOverdub}=await import('../lib/projects.ts');
 const overdub={...newOverdub(),client:'Client',name:'Song',deadline:'2026-11-01'};overdub.songs[0].name='Song';overdub.stages=overdub.stages.map((s,i)=>({...s,name:'Stage '+(i+1)}));
 for(const guitarType of ['Acoustic','Electric','Both'])assert(ProjectSchema.safeParse({...overdub,guitarType}).success);
 for(const bad of [{...overdub,guitarType:undefined},{...overdub,guitarType:'Bass'},{...overdub,songs:[...overdub.songs,{id:'other',name:'Other',completed:[]}]}])assert(!ProjectSchema.safeParse(bad).success);
 assert(ProjectSchema.safeParse(p).success);
 assert.equal(progress(overdub),0);
 const firstDone={...overdub,songs:[{...overdub.songs[0],completed:[overdub.stages[0].id]}]};
 assert.equal(progress(firstDone),70);assert(rankProjects([firstDone],now).length===1);
});
test('graph includes zero, complete and partial work across release types and overdubs',async()=>{
 const {projectBars,newOverdub}=await import('../lib/projects.ts');
 const od={...newOverdub(),name:'Overdub',client:'Client'};
 const single={...p,id:'single',name:'Single',type:'Single' as const,songs:[{...p.songs[0],completed:['a','b']}]};
 const lp={...p,id:'lp',name:'LP',type:'LP' as const};
 const bars=projectBars([p,od,single,lp]);
 assert.equal(bars.length,4);assert.equal(bars.find(x=>x.id===od.id)?.value,0);assert.equal(bars.find(x=>x.id==='single')?.value,100);assert.equal(bars.find(x=>x.id===p.id)?.value,35);assert.equal(bars.find(x=>x.id==='lp')?.value,35);
});


test('production forms start with five unnamed stages and overdubs use editable presets',async()=>{
 const {newProject,newOverdub}=await import('../lib/projects.ts');
 for(const factory of [newProject]){const draft=factory();assert.equal(draft.stages.length,5);assert(draft.stages.every(s=>s.name===''&&s.weight===20));assert.equal(new Set(draft.stages.map(s=>s.id)).size,5);}
 assert.deepEqual(newOverdub().stages.map(s=>[s.name,s.weight]),[['Tracking',70],['Revisions',30]]);
});
test('missing deadlines are valid without invalid date calculations',()=>{
 for(const deadline of ['',undefined]){const parsed=ProjectSchema.safeParse({...p,deadline});assert(parsed.success);if(parsed.success){assert.equal(parsed.data.deadline,'');assert.equal(daysLeft(parsed.data,now),Infinity);assert(Number.isFinite(score(parsed.data,now)));assert(score(parsed.data,now)>0);}}
 const unscheduled={...p,id:'undated',deadline:''};const overdue={...p,id:'overdue',deadline:'2026-10-06'};
 assert.equal(rankProjects([unscheduled,overdue],now)[0].id,'overdue');
 assert.equal(rankProjects([unscheduled],now)[0].id,'undated');
});
test('graph ordering uses client names before project names',async()=>{
 const {projectBars}=await import('../lib/projects.ts');
 const bars=projectBars([{...p,id:'a',client:'Zed',name:'Alpha'},{...p,id:'b',client:'Amy',name:'Zebra'}]);assert.deepEqual(bars.map(x=>x.client),['Amy','Zed']);
});


test('100% work stays active until delivered, independent of progress',()=>{
 const complete={...p,songs:p.songs.map(s=>({...s,completed:['a','b']}))};
 assert.equal(progress(complete),100);assert.equal(rankProjects([complete],now).length,1);
 assert.equal(rankProjects([{...complete,deliveredAt:'2026-10-07T00:00:00.000Z'}],now).length,0);
 assert.equal(rankProjects([{...p,deliveredAt:'2026-10-07T00:00:00.000Z'}],now).length,0);
});
test('payment clock crosses exactly 30 days and clears only when paid or delivery undone',async()=>{
 const {paymentStatus,PAYMENT_WINDOW_MS}=await import('../lib/projects.ts');
 const deliveredAt='2026-10-07T20:00:00.000Z';const delivered={...p,deliveredAt};const start=new Date(deliveredAt).getTime();
 assert.equal(paymentStatus(delivered,new Date(start)).daysRemaining,30);
 assert.equal(paymentStatus(delivered,new Date(start+PAYMENT_WINDOW_MS-1)).state,'pending');
 assert.equal(paymentStatus(delivered,new Date(start+PAYMENT_WINDOW_MS)).state,'overdue');
 assert.equal(paymentStatus(delivered,new Date(start+PAYMENT_WINDOW_MS+86400000)).state,'overdue');
 assert.equal(paymentStatus({...delivered,paymentReceivedAt:'2026-11-08T00:00:00.000Z'},new Date(start+PAYMENT_WINDOW_MS)).state,'paid');
 assert.equal(paymentStatus(p,now).state,'undelivered');assert.equal(progress(delivered),progress(p));
});
test('server delivery timestamps cannot be supplied or restarted by normal edits',async()=>{
 const {applyDeliveryTransition}=await import('../lib/projects.ts');
 const first=applyDeliveryTransition(p,{...p,deliveredAt:'2000-01-01T00:00:00.000Z'},now);
 assert.equal(first.deliveredAt,now.toISOString());
 const later=new Date(now.getTime()+86400000);const edited=applyDeliveryTransition(first,{...first,name:'Renamed'},later);
 assert.equal(edited.deliveredAt,first.deliveredAt);
 const paid=applyDeliveryTransition(first,{...first,paymentReceivedAt:'2000-01-01T00:00:00.000Z'},later);assert.equal(paid.paymentReceivedAt,later.toISOString());
 assert.equal(paid.deliveredAt,first.deliveredAt);
 const reset=applyDeliveryTransition(paid,{...paid,deliveredAt:null,paymentReceivedAt:null},later);assert.equal(reset.deliveredAt,null);assert.equal(reset.paymentReceivedAt,null);
 assert(!ProjectSchema.safeParse({...p,paymentReceivedAt:later.toISOString()}).success);
});
