import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProjectSchema,moveStage,adjustStageWeight,newOverdub,type Project} from '../lib/projects.ts';
import {nextStageDeadline,stageCountdown,localStageDeadline} from '../lib/stage-deadlines.ts';
function project(id='p'):Project{return {...newOverdub(),id,client:'Sample Artist',name:'Record',stages:[{id:'tracking',name:'Tracking',weight:70,deadline:'2026-11-14T15:00:00.000Z'},{id:'mix',name:'Mix',weight:30,deadline:'2026-11-15T15:00:00.000Z'}],songs:[{id:'one',name:'Song',completed:[]}]};}
test('stage deadlines are optional, validate, and survive parsing, reordering and weight edits',()=>{
 const p=project(),parsed=ProjectSchema.parse(p);assert.equal(parsed.stages[0].deadline,p.stages[0].deadline);assert(ProjectSchema.safeParse({...p,stages:p.stages.map(({deadline,...stage})=>stage)}).success);
 assert(!ProjectSchema.safeParse({...p,stages:[{...p.stages[0],deadline:'2026-02-30T12:00:00Z'},p.stages[1]]}).success);
 assert.equal(moveStage(parsed.stages,'tracking','mix')[1].deadline,p.stages[0].deadline);assert.equal(adjustStageWeight(parsed.stages,0,65)[0].deadline,p.stages[0].deadline);
});
test('nearest unfinished stage includes overdue dates and requires completion on every song',()=>{
 const p=project();p.songs.push({id:'two',name:'Second',completed:['tracking']});p.songs[0].completed=['mix'];
 const next=nextStageDeadline([p]);assert.equal(next?.stage.id,'tracking');assert.equal(next?.remaining,1);
 p.songs[0].completed.push('tracking');assert.equal(nextStageDeadline([p])?.stage.id,'mix');p.songs[1].completed.push('mix');assert.equal(nextStageDeadline([p]),null);
});
test('delivered and held projects do not replace the active stage countdown',()=>{
 const p=project();assert.equal(nextStageDeadline([{...p,onHold:true},{...p,deliveredAt:'2026-11-13T00:00:00Z'}]),null);
 const earlier=project('earlier');earlier.stages[0].deadline='2026-11-13T15:00:00Z';assert.equal(nextStageDeadline([p,earlier])?.project.id,'earlier');
});
test('countdown uses elapsed time including hours and minutes, and local input round-trips',()=>{
 assert.equal(stageCountdown('2026-11-14T15:00:00Z',new Date('2026-11-13T12:30:00Z')),'1d 2h 30m left');assert.equal(stageCountdown('2026-11-13T15:00:00Z',new Date('2026-11-14T15:00:00Z')),'Overdue by 1d');
 const iso='2026-11-13T15:30:00.000Z';assert.equal(new Date(localStageDeadline(iso)).toISOString(),iso);assert.equal(localStageDeadline(), '');
});
