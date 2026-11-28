import test from 'node:test';
import assert from 'node:assert/strict';
import {createBudget} from '../lib/budget.ts';
import {readBudgetModel} from '../lib/budget-model.ts';
import {preset} from '../lib/rr-preset.ts';
test('new studios get the original sections without personal rates; saving a preset keeps rates but resets project activity',()=>{const m=readBudgetModel(createBudget({id:'p',name:'Record',client:'Artist'}));assert.equal(m.sections.length,3);assert(m.sections.flatMap(s=>s.rows).every(r=>r.rate===null&&r.quantity===null&&!r.details.includes('Jacob')));const row=m.sections[0].rows[0];row.rate=113;row.quantity=4;m.estimate=900;m.sessions.push({id:'1',date:'2026-01-02',hours:4});const t=preset(m);assert.equal(t.sections[0].rows[0].rate,113);assert.equal(t.sections[0].rows[0].quantity,null);assert.equal(t.estimate,null);assert.equal(t.sessions.length,0);assert.equal(row.quantity,4)})
