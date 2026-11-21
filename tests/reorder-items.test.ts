import test from 'node:test';
import assert from 'node:assert/strict';
import {moveOrderedItem} from '../lib/reorder-items.ts';
test('reordering songs retains names, IDs and completion data when moving both directions',()=>{
 const songs=[{id:'a',name:'First',completed:['tracking']},{id:'b',name:'Second',completed:[]},{id:'c',name:'Third',completed:['mixing']}];
 const changed=moveOrderedItem(songs,'a','c');assert.deepEqual(changed.map(s=>s.id),['b','c','a']);assert.equal(changed[2],songs[0]);assert.deepEqual(changed[2].completed,['tracking']);assert.deepEqual(moveOrderedItem(changed,'a','b'),songs);assert.deepEqual(songs.map(s=>s.id),['a','b','c']);
});
test('invalid moves do nothing and stage weights and deadlines also remain intact',()=>{const items=[{id:'a',name:'Tracking',weight:70,deadline:'2026-12-01T17:00:00Z'},{id:'b',name:'Revisions',weight:30}];assert.equal(moveOrderedItem(items,'missing','b'),items);assert.equal(moveOrderedItem(items,'a','a'),items);assert.deepEqual(moveOrderedItem(items,'b','a'),[items[1],items[0]])});
