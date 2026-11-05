import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {BudgetSchema,createBudget} from '../lib/budget.ts';
import {readBudgetModel,writeBudgetModel,BudgetModelSchema,lineTotal,sectionTotal,budgetTotal} from '../lib/budget-model.ts';
import {exportBudgetExcel,importBudgetExcel} from '../lib/budget-excel.ts';
const project={id:'project',client:'Artist',name:'Record'};
test('existing budget converts preset rates, units, quantities and custom musician rows without changing its source',()=>{
 const budget=createBudget(project),data=budget.sheets[0].data as any[][];
 data.splice(8,0,[null,null,{v:'Guest Musician'},null,{v:'$75/track'},{v:1}]);
 data[3][5]={v:2};const original=structuredClone(budget);
 const model=readBudgetModel(budget);assert.equal(model.sections.length,3);
 const recording=model.sections[0];assert.equal(recording.rows.length,6);assert.equal(recording.rows[0].rate,80);assert.equal(recording.rows[0].unit,'hour');assert.equal(recording.rows[3].unit,'tuning');
 const added=recording.rows[5];assert.equal(added.name,'Studio Musicians');assert.equal(added.details,'Guest Musician');assert.equal(added.rate,75);assert.equal(added.quantity,1);assert.equal(added.unit,'song');assert.equal(sectionTotal(recording.rows),235);
 const saved=writeBudgetModel(budget,model);assert.deepEqual(readBudgetModel(BudgetSchema.parse(saved)),model);assert.deepEqual(budget,original);assert.deepEqual(saved.sheets[0].data,original.sheets[0].data);
});
test('totals use numeric rate times quantity, section sums, currency rounding and all sections',()=>{
 const model=readBudgetModel(createBudget(project));model.sections[0].rows[0].quantity=2.5;model.sections[1].rows[1].quantity=3;model.sections[2].rows[3].quantity=2;
 assert.equal(budgetTotal(model),700);assert.equal(lineTotal({...model.sections[0].rows[0],rate:.1,quantity:.2}),.02);assert.equal(lineTotal({...model.sections[0].rows[0],quantity:null}),0);
 model.sections[0].rows[0].unit='tuning';assert.equal(BudgetModelSchema.safeParse(model).success,false);
});
test('Excel export and import preserve editable numeric fields, all units and cached formulas',async()=>{
 const model=readBudgetModel(createBudget(project));model.sections[0].rows[0].quantity=3;model.sections[0].rows[1].unit='day';model.sections[0].rows[1].rate=200;model.sections[0].rows[1].quantity=2;model.sections[0].rows[2].unit='session';model.sections[0].rows[3].unit='day';model.notes='Review estimates';model.sessions=[{id:'s',date:'2026-11-05',hours:3}];
 const blob=await exportBudgetExcel(model,project),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());const sheet=workbook.worksheets[0];assert.equal(sheet.getCell('E4').value,80);assert.deepEqual(sheet.getCell('G4').value,{formula:'E4*F4',result:240});assert.equal(sheet.getCell('F6').value,null);
 const restored=await importBudgetExcel(new File([blob],'Budget.xlsx'));assert.equal(budgetTotal(restored),budgetTotal(model));assert.equal(restored.sections[0].rows[1].unit,'day');assert.equal(restored.sections[0].rows[2].unit,'session');assert.equal(restored.sections[0].rows[3].unit,'day');assert.equal(restored.sections[1].rows[1].unit,'song');assert.equal(restored.sessions[0].hours,3);assert.equal(restored.notes,'Review estimates');
});
