import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BudgetLinkSchema,sameBudgetVersion} from '../lib/budget-sharing.ts';
import {createBudget} from '../lib/budget.ts';
test('link requests require another project and current budget identity and revision',()=>{
 const valid={id:'a',action:'link',targetId:'b',revision:1,budgetKey:'project:a'};
 assert.ok(BudgetLinkSchema.safeParse(valid).success);
 assert.equal(BudgetLinkSchema.safeParse({...valid,targetId:'a'}).success,false);
 assert.equal(BudgetLinkSchema.safeParse({...valid,targetId:undefined}).success,false);
 assert.equal(BudgetLinkSchema.safeParse({...valid,budgetKey:undefined}).success,false);
 assert.equal(BudgetLinkSchema.safeParse({...valid,revision:0}).success,false);
 assert.ok(BudgetLinkSchema.safeParse({...valid,action:'unlink',targetId:undefined}).success);
});
test('shared-budget refresh compares both membership identity and content revision',()=>{
 const a={...createBudget({id:'a',client:'Artist',name:'Record'}),revision:1,budgetKey:'project:a'};
 assert.equal(sameBudgetVersion(a,{...a}),true);
 assert.equal(sameBudgetVersion(a,{...a,budgetKey:'shared:x'}),false);
 assert.equal(sameBudgetVersion(a,{...a,revision:2}),false);
});
