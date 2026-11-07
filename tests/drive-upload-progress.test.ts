import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadBatchPercent} from '../lib/drive-upload-progress.ts';
test('batch progress includes completed bytes and the current file without resetting',()=>{
 assert.equal(uploadBatchPercent([100,300],0,50),13);
 assert.equal(uploadBatchPercent([100,300],1,0),25);
 assert.equal(uploadBatchPercent([100,300],1,50),63);
 assert.equal(uploadBatchPercent([100,300],1,100),99);
 assert.equal(uploadBatchPercent([100,300],2),100);
});
test('empty files count and a batch is complete only after every file finishes',()=>{
 assert.equal(uploadBatchPercent([],0),0);
 assert.equal(uploadBatchPercent([0,0],1),50);
 assert.equal(uploadBatchPercent([0,0],2),100);
 assert.equal(uploadBatchPercent([1e9,1],1),99);
 assert.equal(uploadBatchPercent([100],0,-50),0);
 assert.equal(uploadBatchPercent([100],0,200),99);
});
