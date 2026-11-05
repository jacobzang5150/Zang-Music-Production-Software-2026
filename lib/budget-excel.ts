import ExcelJS from 'exceljs';
import {BudgetModelSchema,readBudgetModel,lineTotal,sectionTotal,budgetTotal,type BudgetModel} from './budget-model.ts';
import type {Budget} from './budget.ts';

const unitSuffix={song:'song',hour:'hr',day:'day',session:'session',tuning:'tuning'};
export async function exportBudgetExcel(model:BudgetModel,project:{client:string;name:string}):Promise<Blob>{
 const workbook=new ExcelJS.Workbook();workbook.creator='Session';workbook.calcProperties.fullCalcOnLoad=true;
 const sheet=workbook.addWorksheet('Budget',{views:[{showGridLines:false}]});
 sheet.columns=[{width:20},{width:12},{width:22},{width:10},{width:25},{width:14},{width:18},{width:13},{width:5},{width:5},{width:5},{width:10},{width:5}];
 function cell(r:number,c:number,value:ExcelJS.CellValue){const dest=sheet.getCell(r,c);dest.value=value;dest.font={name:'DM Sans',size:11,color:{argb:'FFEEE5ED'}};dest.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF19171B'}};dest.alignment={vertical:'middle',wrapText:true};return dest}
 function band(r:number,color:string){for(let c=1;c<=7;c++)cell(r,c,'').fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};sheet.getRow(r).height=28}
 sheet.mergeCells('A1:G1');cell(1,1,`${project.client} - ${project.name}`).font={name:'Space Grotesk',size:18,bold:true,color:{argb:'FFEEE5ED'}};
 sheet.mergeCells('H1:M1');cell(1,8,'Budget Breakdown').font={name:'Space Grotesk',size:16,bold:true,color:{argb:'FFF38FA9'}};sheet.getRow(1).height=36;
 let row=3;const subtotalCells:string[]=[];
 model.sections.forEach(section=>{
  band(row,'FF48202D');sheet.mergeCells(row,1,row,4);cell(row,1,section.name);for(const [c,label]of [[5,'Rate'],[6,'Quantity'],[7,'Total']] as const)cell(row,c,label);
  for(let c=1;c<=7;c++){sheet.getCell(row,c).font={name:'DM Sans',size:11,bold:true,color:{argb:'FFFFD0DC'}};sheet.getCell(row,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF48202D'}}}
  row++;const start=row;
  section.rows.forEach(line=>{
   for(let c=1;c<=7;c++)cell(row,c,null);sheet.getRow(row).height=25;
   sheet.mergeCells(row,1,row,2);sheet.mergeCells(row,3,row,4);cell(row,1,line.name);cell(row,3,line.details);
   const rate=cell(row,5,line.rate);rate.numFmt=`$#,##0.00"/${unitSuffix[line.unit]}"`;const quantity=cell(row,6,line.quantity);quantity.numFmt='0.##';
   for(const c of [5,6]){sheet.getCell(row,c).font={name:'DM Sans',size:11,color:{argb:'FFFF9DB6'}};sheet.getCell(row,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF241B22'}}}
   const total=cell(row,7,{formula:`E${row}*F${row}`,result:lineTotal(line)});total.numFmt='$#,##0.00';row++;
  });
  band(row,'FF30212B');sheet.mergeCells(row,1,row,4);cell(row,1,'Sub Total');const total=cell(row,7,{formula:section.rows.length?`SUM(G${start}:G${row-1})`:'0',result:sectionTotal(section.rows)});total.numFmt='$#,##0.00';total.font={...total.font,bold:true};for(const c of [1,7])sheet.getCell(row,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF30212B'}};subtotalCells.push(`G${row}`);row+=2;
 });
 band(row,'FF842C43');sheet.mergeCells(row,1,row,4);cell(row,1,'Total');cell(row,7,{formula:`SUM(${subtotalCells.join(',')})`,result:budgetTotal(model)}).numFmt='$#,##0.00';
 for(const c of [1,7]){sheet.getCell(row,c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF842C43'}};sheet.getCell(row,c).font={name:'Space Grotesk',size:14,bold:true,color:{argb:'FFFFFFFF'}}}
 if(model.notes){row+=2;sheet.mergeCells(row,1,row,7);cell(row,1,'Notes');row++;sheet.mergeCells(row,1,row+2,7);cell(row,1,model.notes);sheet.getRow(row).height=55}
 sheet.mergeCells('H3:K3');cell(3,8,'Dates:');sheet.mergeCells('L3:M3');cell(3,12,'Hours');
 model.sessions.forEach((session,i)=>{const r=i+4;sheet.mergeCells(r,8,r,11);sheet.mergeCells(r,12,r,13);cell(r,8,session.date);cell(r,12,session.hours).numFmt='0.##'});
 return new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export async function importBudgetExcel(file:File):Promise<BudgetModel>{
 if(!/\.xlsx$/i.test(file.name)||file.size>10*1024*1024)throw new Error('Choose an .xlsx budget smaller than 10 MB.');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
 const sheets=workbook.worksheets.filter(sheet=>sheet.state==='visible').map(sheet=>{
  if(sheet.actualRowCount>10000||sheet.actualColumnCount>200)throw new Error('Use up to 10,000 rows and 200 columns per budget.');
  const celldata:{r:number;c:number;v:Record<string,unknown>}[]=[];
  sheet.eachRow((row,r)=>row.eachCell((cell,c)=>{
   if(cell.isMerged&&cell.master.address!==cell.address)return;
   const v=cell.value;if(v===null)return;
   if(r>10000||c>200)throw new Error('Use up to 10,000 rows and 200 columns per budget.');
   let value:unknown=v;
   if(v instanceof Date)value=v.toISOString().slice(0,10);
   else if(typeof v==='object'){if('formula'in v||'sharedFormula'in v)value=cell.result??null;else if('richText'in v)value=v.richText.map(p=>p.text).join('');else if('text'in v)value=v.text;else value=cell.text;}
   celldata.push({r:r-1,c:c-1,v:{v:value,m:cell.text,ct:{fa:cell.numFmt||'General'}}});
  }));return {name:sheet.name,celldata};
 });
 if(!sheets.length||sheets.length>20)throw new Error('Choose a budget with 1–20 visible worksheets.');
 return BudgetModelSchema.parse(readBudgetModel({id:'import',templateTitle:false,sheets} as Budget));
}
