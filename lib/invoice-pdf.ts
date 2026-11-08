import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,PDFName,PDFRawStream,PDFDict,decodePDFRawStream,StandardFonts,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import {invoiceTotals,type Invoice} from './invoice.ts';
import {invoiceDate,invoiceFilename,invoiceMoney,invoiceTerms,invoicePrintRows} from './invoice-print.ts';
export async function generateInvoicePdf(invoice:Invoice,paid=false,brandBytes?:Uint8Array,fonts?:{body:Uint8Array;heading:Uint8Array}):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();pdf.setTitle(invoiceFilename(invoice).slice(0,-4));pdf.setAuthor('Jacob Zang');pdf.setSubject(invoice.projectTitle);pdf.setCreator('Session');
 pdf.registerFontkit(fontkit);
 const body=await pdf.embedFont(fonts?.body||StandardFonts.Helvetica,{subset:true}),head=await pdf.embedFont(fonts?.heading||StandardFonts.TimesRomanBold,{subset:false});
 const brand=brandBytes?await pdf.embedPng(brandBytes):null;
 let page:PDFPage=pdf.addPage([612,792]),y=334;
 const fontSize={metadata:12,column:12,body:11,title:28,summary:14};
 const width=(value:string,size:number,font:PDFFont)=>font.widthOfTextAtSize(value,size);
 const draw=(value:string,x:number,top:number,size=12,font:PDFFont=body)=>page.drawText(value,{x,y:792-top-size,font,size,color:rgb(0,0,0)});
 const right=(value:string,x:number,top:number,size=12,font:PDFFont=body)=>draw(value,x-width(value,size,font),top,size,font);
 function wrap(value:string,maxWidth:number,size=12,font=body){
  const lines:string[]=[];let current='';
  for(const word of value.replace(/[\r\n\t]+/g,' ').split(/\s+/)){
   if(current&&width(current+' '+word,size,font)>maxWidth){lines.push(current);current=''}
   for(const char of word){if(current&&width(current+char,size,font)>maxWidth){lines.push(current);current=''}current+=char}
   current+=' ';
  }
  if(current.trim())lines.push(current.trim());return lines.length?lines:[''];
 }
 const centered=(value:string,x:number,maxWidth:number,top:number,size=12,font=body)=>draw(value,x+(maxWidth-width(value,size,font))/2,top,size,font);
 function tableHeader(top:number){centered('Description',36,205,top,fontSize.column,head);centered('Unit Price',241,130,top,fontSize.column,head);centered('Quantity',371,85,top,fontSize.column,head);centered('Total',456,120,top,fontSize.column,head);return top+28}
 function continuation(table=true){page=pdf.addPage([612,792]);draw('Jacob Zang',36,32,17,head);right(invoice.number,576,35,11);y=table?tableHeader(67):67}
 if(brand)page.drawImage(brand,{x:36,y:792-128,width:540,height:76});
 else{centered('Jacob Zang',36,540,62,28,head);centered('Guitarist/Producer/Engineer',36,540,97,13)}
 const recipient=wrap('Bill To: '+invoice.billTo,290,fontSize.metadata,head);recipient.forEach((line,index)=>draw(line,36,178+index*18,fontSize.metadata,head));
 let metadataY=178;
 for(const value of ['Project: '+invoice.projectTitle,'Invoice No: '+invoice.number,'Invoice Date: '+invoiceDate(invoice.issuedAt),'Due Date: '+invoiceDate(invoice.dueAt)]){
  for(const line of wrap(value,216,fontSize.metadata,head)){draw(line,360,metadataY,fontSize.metadata,head);metadataY+=18}
 }
 const metaEnd=Math.max(178+recipient.length*18,metadataY);
 const titleTop=Math.max(250,metaEnd+16);draw('Invoice',36,titleTop,fontSize.title,head);y=tableHeader(Math.max(334,titleTop+76));
 for(const line of invoicePrintRows(invoice)){
  const sections=line.section.trim()?wrap(line.section,197,fontSize.body,head):[],names=line.descriptions.flatMap(text=>wrap(text,197,fontSize.body)),rates=wrap(line.rateLabel,122,fontSize.body),quantities=wrap(line.quantityLabel,77,fontSize.body);
  const height=Math.max(36,14+(sections.length+Math.max(names.length,rates.length,quantities.length))*14);
  if(y+height>675)continuation();
  if(line.shaded)page.drawRectangle({x:36,y:792-y-height,width:540,height,color:rgb(.927,.927,.927)});
  sections.forEach((text,i)=>draw(text,40,y+7+i*14,fontSize.body,head));names.forEach((text,i)=>draw(text,40,y+7+(sections.length+i)*14,fontSize.body));
  rates.forEach((text,i)=>centered(text,241,130,y+8+sections.length*14+i*14,fontSize.body));quantities.forEach((text,i)=>centered(text,371,85,y+8+sections.length*14+i*14,fontSize.body));right(invoiceMoney(line.amount),570,y+8+sections.length*14,fontSize.body);
  y+=height;
 }
 const totals=invoiceTotals(invoice,paid),totalRows=totals.received?3:1,footerHeight=totalRows*20+100+(paid?20:0);
 if(y+footerHeight>756)continuation(false);
 y+=28;right('Total: '+invoiceMoney(totals.total),576,y,fontSize.summary,head);y+=22;
 if(totals.received){right('Payments Received: '+invoiceMoney(totals.received),576,y,fontSize.summary,head);y+=20;right('Balance Due: '+invoiceMoney(totals.balance),576,y,fontSize.summary,head);y+=22}
 if(paid){right('PAID',576,y,14,head);y+=20}
 draw('Terms and Conditions',36,y,fontSize.summary,head);y+=24;
 for(const term of invoiceTerms){draw(term,36,y,fontSize.body);y+=16}
 const pages=pdf.getPages();if(pages.length>1)pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:550,y:20,size:9,font:body}));
 // Full OpenType/CFF fonts require FontFile3 with an OpenType subtype.
 await pdf.flush();
 const descriptors=new Set<unknown>();
 for(const [ref,object] of pdf.context.enumerateIndirectObjects()){
  if(!(object instanceof PDFDict))continue;
  const file=object.get(PDFName.of('FontFile2'))||object.get(PDFName.of('FontFile3'));
  if(!file)continue;
  const stream=pdf.context.lookup(file);
  if(!(stream instanceof PDFRawStream))continue;
  const bytes=decodePDFRawStream(stream).decode();
  if(String.fromCharCode(...bytes.slice(0,4))!=='OTTO')continue;
  object.delete(PDFName.of('FontFile2'));object.set(PDFName.of('FontFile3'),file);
  stream.dict.set(PDFName.of('Subtype'),PDFName.of('OpenType'));descriptors.add(ref);
 }
 for(const [,object] of pdf.context.enumerateIndirectObjects()){
  if(object instanceof PDFDict&&descriptors.has(object.get(PDFName.of('FontDescriptor'))))object.set(PDFName.of('Subtype'),PDFName.of('CIDFontType0'));
 }
 return pdf.save();
}
export async function downloadInvoicePdf(invoice:Invoice,paid=false){
 const assets=await Promise.all(['/invoice-brand.png','/invoice-fonts/arian-lt-demi.ttf','/invoice-fonts/copperplate-pdf.otf'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Could not load invoice formatting. Please retry.');return new Uint8Array(await response.arrayBuffer())}));
 const bytes=await generateInvoicePdf(invoice,paid,assets[0],{body:assets[1],heading:assets[2]});
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=invoiceFilename(invoice);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
