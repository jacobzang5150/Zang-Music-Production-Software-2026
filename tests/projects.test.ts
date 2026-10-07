import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProjectSchema,songProgress,progress,rankProjects,score,daysLeft,type Project} from '../lib/projects.ts';
const p:Project={id:'p',name:'Record',client:'Artist',type:'EP',deadline:'2026-10-10',priority:3,stages:[{id:'a',name:'Tracking',weight:70},{id:'b',name:'Mix',weight:30}],songs:[{id:'s',name:'First',completed:['a']},{id:'t',name:'Second',completed:[]}]};
const now=new Date(2026,9,7,12);
test('weighted completion and album average',()=>{assert.equal(songProgress(p,p.songs[0]),70);assert.equal(progress(p),35);assert.equal(progress({...p,songs:p.songs.map(s=>({...s,completed:['a','b']}))}),100)});
test('validates weights, type constraints, dates, priority and unknown stage IDs',()=>{assert(ProjectSchema.safeParse(p).success);for(const q of [{...p,stages:[{id:'a',name:'A',weight:50}]},{...p,type:'Single'},{...p,deadline:'2026-02-30'},{...p,deadline:'2026-99-99'},{...p,priority:6},{...p,songs:[{...p.songs[0],completed:['missing']}]}])assert(!ProjectSchema.safeParse(q).success)});
test('deadline uses calendar days and ranking excludes completed work',()=>{assert.equal(daysLeft(p,now),3);assert.equal(score(p,now),3*1.3/4);const done={...p,id:'done',songs:p.songs.map(s=>({...s,completed:['a','b']}))};assert.deepEqual(rankProjects([done,p],now).map(p=>p.id),['p'])});
test('overdue first, then priority / remaining work / deadline',()=>{const late={...p,id:'late',deadline:'2026-10-06',priority:1};const high={...p,id:'high',priority:5};const due={...p,id:'due',deadline:'2026-10-07'};assert.deepEqual(rankProjects([p,high,due,late],now).map(p=>p.id),['late','due','high','p']);assert.equal(rankProjects([{...p,id:'low',priority:1},high],now)[0].id,'high')});
