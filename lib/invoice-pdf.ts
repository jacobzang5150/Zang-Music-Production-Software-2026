import fontkit from '@pdf-lib/fontkit';
import {PDFDocument,StandardFonts,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import {invoiceTotals,type Invoice} from './invoice.ts';
import {invoiceDate,invoiceFilename,invoiceMoney,invoiceTerms} from './invoice-print.ts';
export async function generateInvoicePdf(invoice:Invoice,paid=false,brandBytes?:Uint8Array,fonts?:{body:Uint8Array;heading:Uint8Array}):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();pdf.setTitle(invoiceFilename(invoice).slice(0,-4));pdf.setAuthor('Jacob Zang');pdf.setSubject(invoice.projectTitle);pdf.setCreator('Session');
 pdf.registerFontkit(fontkit);
 const body=await pdf.embedFont(fonts?.body||StandardFonts.Helvetica,{subset:true}),head=await pdf.embedFont(fonts?.heading||StandardFonts.TimesRomanBold,{subset:true});
 const brand=brandBytes?await pdf.embedPng(brandBytes):null;
 let page:PDFPage=pdf.addPage([612,792]),y=334;
 const fontSize={metadata:12,column:12,body:11,title:28,summary:14};
 const width=(value:string,size:number,font:PDFFont)=>font===head?[...value].reduce((sum,char)=>sum+font.widthOfTextAtSize(char.toUpperCase(),char!==char.toUpperCase()?size*.8:size)+.4,0):font.widthOfTextAtSize(value,size);
 const draw=(value:string,x:number,top:number,size=12,font:PDFFont=body)=>{
  if(font!==head){page.drawText(value,{x,y:792-top-size,font,size,color:rgb(0,0,0)});return}
  for(const char of value){const fontSize=char!==char.toUpperCase()?size*.8:size;page.drawText(char.toUpperCase(),{x,y:792-top-size,font,size:fontSize,color:rgb(0,0,0)});x+=font.widthOfTextAtSize(char.toUpperCase(),fontSize)+.4}
 };
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
 let index=0;
 for(const line of invoice.lines.filter(line=>line.included&&line.amount>0)){
  const names=wrap(line.name,197,fontSize.body),details=line.details?wrap(line.details,197,fontSize.body):[];
  const height=Math.max(36,14+(names.length+details.length)*14);
  if(y+height>675)continuation();
  if(index%2===0)page.drawRectangle({x:36,y:792-y-height,width:540,height,color:rgb(.927,.927,.927)});
  names.forEach((text,i)=>draw(text,40,y+7+i*14,fontSize.body));details.forEach((text,i)=>draw(text,40,y+7+(names.length+i)*14,fontSize.body));
  centered(invoiceMoney(line.rate)+'/'+(line.unit==='hour'?'hr':line.unit),241,130,y+8,fontSize.body);centered(String(line.quantity),371,85,y+8,fontSize.body);right(invoiceMoney(line.amount),570,y+8,fontSize.body);
  y+=height;index++;
 }
 const totals=invoiceTotals(invoice,paid),totalRows=totals.received?3:1,footerHeight=totalRows*20+100+(paid?20:0);
 if(y+footerHeight>756)continuation(false);
 y+=28;right('Total: '+invoiceMoney(totals.total),576,y,fontSize.summary,head);y+=22;
 if(totals.received){right('Payments Received: '+invoiceMoney(totals.received),576,y,fontSize.summary,head);y+=20;right('Balance Due: '+invoiceMoney(totals.balance),576,y,fontSize.summary,head);y+=22}
 if(paid){right('PAID',576,y,14,head);y+=20}
 draw('Terms and Conditions',36,y,fontSize.summary,head);y+=24;
 for(const term of invoiceTerms){draw(term,36,y,fontSize.body);y+=16}
 const pages=pdf.getPages();if(pages.length>1)pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:550,y:20,size:9,font:body}));
 return pdf.save();
}
export async function downloadInvoicePdf(invoice:Invoice,paid=false){
 const assets=await Promise.all(['/invoice-brand.png','/invoice-fonts/body.ttf','/invoice-fonts/heading.ttf'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Could not load invoice formatting. Please retry.');return new Uint8Array(await response.arrayBuffer())}));
 const bytes=await generateInvoicePdf(invoice,paid,assets[0],{body:assets[1],heading:assets[2]});
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=invoiceFilename(invoice);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
