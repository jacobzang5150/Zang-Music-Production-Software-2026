import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedSongs} from '../lib/song-order.ts';
import type {Project} from '../lib/projects.ts';
const project={id:'p',client:'Artist',name:'EP',type:'EP',deadline:'',priority:3,stages:[{id:'tracking',name:'Tracking',weight:70},{id:'mix',name:'Mix',weight:20},{id:'master',name:'Master',weight:10}],songs:[{id:'z',name:'Zulu',completed:['tracking']},{id:'a',name:'Alpha',completed:['mix','master']},{id:'b',name:'beta',completed:['tracking']},{id:'c',name:'Clear',completed:[]}]} satisfies Project;
test('song ordering uses weighted progress, keeps ties stable and preserves track numbers',()=>{
 assert.deepEqual(orderedSongs(project,'most-finished').map(x=>[x.song.id,x.number]),[['z',1],['b',3],['a',2],['c',4]]);
 assert.deepEqual(orderedSongs(project,'least-finished').map(x=>x.song.id),['c','a','z','b']);
 assert.deepEqual(orderedSongs(project,'alphabetical').map(x=>x.song.id),['a','b','c','z']);
 assert.deepEqual(orderedSongs(project,'track').map(x=>x.song.id),['z','a','b','c']);
 assert.deepEqual(project.songs.map(x=>x.id),['z','a','b','c']);
});
