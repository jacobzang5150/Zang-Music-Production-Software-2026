import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoicePrintRows} from '../lib/invoice-print.ts';
import type {Invoice} from '../lib/invoice.ts';
const line=(name:string,quantity:number,rate=80,section='Post-Production',included=true,unit='hour')=>({id:name,section,name,details:'',quantity,rate,unit,amount:quantity*rate,included,kind:'fee' as const});
const invoice=(lines:Invoice['lines'])=>({lines} as Invoice);
test('post production shares one box and sums only selected costs and hours',()=>{
 const lines=[line('Producer',4,80,'Recording / Production'),line('Editing',2),line('Melodyne',1),line('Mixing',3),line('Mastering',1),line('Excluded',10,80,'Post-Production',false)];
 const before=structuredClone(lines),rows=invoicePrintRows(invoice(lines));
 assert.equal(rows.length,2);assert.equal(rows[1].section,'Post production');assert.deepEqual(rows[1].descriptions,['Editing','Melodyne','Mixing','Mastering']);assert.equal(rows[1].quantityLabel,'7 hrs');assert.equal(rows[1].rateLabel,'$80/hr');assert.equal(rows[1].amount,560);assert.deepEqual(lines,before);
});
test('different rates preserve the exact total without inventing a rate',()=>{
 const [row]=invoicePrintRows(invoice([line('Editing',.1,75),line('Mixing',.2,100,'Post production')]));
 assert.equal(row.quantityLabel,'0.3 hrs');assert.equal(row.rateLabel,'Various rates');assert.equal(row.amount,27.5);
});
test('non-hour quantities stay distinct from hours',()=>{
 const [row]=invoicePrintRows(invoice([line('Editing',2),line('Mastering',3,50,'Post-Production',true,'song')]));
 assert.equal(row.quantityLabel,'2 hrs, 3 song');assert.equal(row.amount,310);
});
