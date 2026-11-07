import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFDict,PDFName,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {createBudget} from '../lib/budget.ts';
import {createInvoice,type SavedInvoice} from '../lib/invoice.ts';
import {newProject} from '../lib/projects.ts';
import {invoiceFilename,invoiceHtml} from '../lib/invoice-print.ts';
import {generateInvoicePdf} from '../lib/invoice-pdf.ts';
import {rebaseInvoiceEdits} from '../lib/invoice-autosave.ts';
const project={...newProject(),client:'Taylor Example',name:'Record',deliveredAt:'2026-10-30T18:00:00.000Z'};
const invoice=createInvoice(project,{...createBudget(project),revision:1},new Date('2026-10-30T18:00:00Z'));
test('PDF filenames follow the client surname and Chicago invoice date',()=>{
 assert.equal(invoiceFilename(invoice),'Zang Example Invoice 10-30-2026.pdf');
 assert.equal(invoiceFilename({...invoice,billTo:'Taylor Example Jr.'}),'Zang Example Invoice 10-30-2026.pdf');
 assert.equal(invoiceFilename({...invoice,issuedAt:'2026-11-01T02:00:00Z'}),'Zang Example Invoice 10-31-2026.pdf');
 assert(!invoiceFilename({...invoice,billTo:'../Example?*'}).includes('/'));
});
test('edits made during autosave preserve choices on the confirmed revision',()=>{
 const base={...invoice,revision:1},row=base.lines[0];
 const current:SavedInvoice={...base,billTo:'New Recipient',amountReceived:200,lines:base.lines.map(line=>({...line,included:false}))};
 const saved:SavedInvoice={...base,revision:2,budgetRevision:4,lines:[{...row,amount:300,rate:100,quantity:3},...base.lines.slice(1)]};
 const next=rebaseInvoiceEdits(current,saved);assert.equal(next.revision,2);assert.equal(next.billTo,'New Recipient');assert.equal(next.amountReceived,200);assert.equal(next.lines[0].amount,300);assert.equal(next.lines[0].included,false);
});
test('PDF export creates actual Letter pages and handles longer invoices',async()=>{
 const item={...invoice.lines[0],amount:80,rate:80,quantity:1,included:true};
 const small=await PDFDocument.load(await generateInvoicePdf({...invoice,lines:[item]}));assert.equal(small.getPageCount(),1);assert.deepEqual(small.getPage(0).getSize(),{width:612,height:792});
 const long=await PDFDocument.load(await generateInvoicePdf({...invoice,lines:Array.from({length:45},(_,index)=>({...item,id:String(index),name:'Production work '+index}))}));assert(long.getPageCount()>1);
 const html=invoiceHtml({...invoice,notes:'Old hidden notes'});assert(!html.includes('Old hidden notes'));assert(html.includes('Terms and Conditions'));assert(html.includes('Venmo: @ZangJacob'));assert(html.indexOf('Project: ')<html.indexOf('Invoice No: '));assert(html.indexOf('<th>Unit Price</th>')<html.indexOf('<th>Quantity</th>'));assert(!html.includes('Qty or hr'));
});

test('supplied invoice fonts embed with a valid OpenType CFF descriptor',async()=>{
 const fonts={body:new Uint8Array(await readFile('public/invoice-fonts/arian-lt-demi.ttf')),heading:new Uint8Array(await readFile('public/invoice-fonts/copperplate-pdf.otf'))};
 const pdf=await PDFDocument.load(await generateInvoicePdf({...invoice,billTo:'René Example',number:'1234'},false,undefined,fonts));
 let copperplate=false,arian=false;
 for(const [,object] of pdf.context.enumerateIndirectObjects()){
  if(!(object instanceof PDFDict))continue;
  const name=String(object.get(PDFName.of('FontName'))||'');
  if(name.includes('Copperplate')){
   const stream=pdf.context.lookup(object.get(PDFName.of('FontFile3')));
   assert(stream instanceof PDFRawStream);assert.equal(String(stream.dict.get(PDFName.of('Subtype'))),'/OpenType');
   assert.equal(Buffer.from(decodePDFRawStream(stream).decode().slice(0,4)).toString(),'OTTO');copperplate=true;
  }
  if(name.includes('ArianLT-Demi')){assert(object.has(PDFName.of('FontFile2')));arian=true;}
 }
 assert(copperplate&&arian);
});
