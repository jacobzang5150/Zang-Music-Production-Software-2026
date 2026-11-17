import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetRemainingHours,type BudgetModel} from '../lib/budget-model.ts';
const model:BudgetModel={version:1,estimate:1000,sections:[{id:'s',name:'Production',rows:[{id:'r',name:'Tracking',details:'',rate:80,quantity:7.5,unit:'hour'}]}],sessions:[],notes:''};
test('hours remaining converts unspent estimate at $80/hour and reflects budget edits',()=>{
 assert.equal(budgetRemainingHours(model),5);
 assert.equal(budgetRemainingHours({...model,estimate:640}),.5);
 assert.equal(budgetRemainingHours({...model,estimate:600}),0);
 assert.equal(budgetRemainingHours({...model,estimate:520}),-1);
 assert.equal(budgetRemainingHours({...model,estimate:null}),null);
 assert.equal(budgetRemainingHours({...model,sections:[{...model.sections[0],rows:[]}]}),12.5);
});
