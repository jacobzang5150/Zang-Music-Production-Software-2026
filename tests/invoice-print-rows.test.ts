import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoicePrintRows} from '../lib/invoice-print.ts';
import type {Invoice} from '../lib/invoice.ts';
const line=(name:string,quantity:number,rate=80,section='Post-Production',included=true,unit='hour')=>({id:name,section,name,details:'',quantity,rate,unit,amount:quantity*rate,included,kind:'fee' as const});
const invoice=(lines:Invoice['lines'])=>({lines} as Invoice);
test('post production uses one visual box while preserving each item',()=>{
 const lines=[line('Producer',4,80,'Recording / Production'),line('Editing',2),line('Melodyne',1),line('Mixing',3),line('Mastering',1),line('Excluded',10,80,'Post-Production',false)];
 const before=structuredClone(lines),rows=invoicePrintRows(invoice(lines)),post=rows.slice(1);
 assert.equal(rows.length,5);assert.deepEqual(post.map(row=>row.section),['Post production','','','']);assert.deepEqual(post.map(row=>row.descriptions[0]),['Editing','Melodyne','Mixing','Mastering']);assert.deepEqual(post.map(row=>row.quantityLabel),['2','1','3','1']);assert.deepEqual(post.map(row=>row.amount),[160,80,240,80]);assert(post.every(row=>row.shaded===post[0].shaded));assert.deepEqual(lines,before);
});
test('different rates and units remain on their individual lines',()=>{
 const rows=invoicePrintRows(invoice([line('Editing',2,75),line('Mastering',3,100,'Post production',true,'song')]));
 assert.deepEqual(rows.map(row=>row.rateLabel),['$75/hr','$100/song']);assert.deepEqual(rows.map(row=>row.quantityLabel),['2','3']);assert.deepEqual(rows.map(row=>row.amount),[150,300]);
});
