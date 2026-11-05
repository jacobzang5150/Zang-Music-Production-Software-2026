import ExcelJS from 'exceljs';
import {update,type Sheet} from '@fortune-sheet/core';

// Restore number formats and blank values independently of the layout converter.
export async function restoreExcelFormats(file:File,sheets:Sheet[]){
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
 sheets.forEach((sheet,index)=>{
  const source=workbook.worksheets[index];if(!source)return;
  sheet.showGridLines=source.views[0]?.showGridLines===false?0:1;
  for(const entry of sheet.celldata||[]){
   const cell=source.getCell(entry.r+1,entry.c+1),value=entry.v;
   if(!value)continue;
   if(cell.value===null){value.v='';value.m='';continue;}
   if(cell.numFmt){value.ct={...value.ct,fa:cell.numFmt,t:typeof value.v==='number'?'n':value.ct?.t||'n'};value.m=String(update(cell.numFmt,value.v)??value.v??'');}
  }
 });
}
export async function preserveExcelBlanks(blob:Blob,sheets:Sheet[]):Promise<Blob>{
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
 sheets.forEach((sheet,index)=>{
  const target=workbook.worksheets[index];if(!target)return;
  target.views=[{state:'normal',showGridLines:sheet.showGridLines!==0}];
  sheet.data?.forEach((row,r)=>row.forEach((cell,c)=>{
   if(cell&&!cell.f&&(cell.v===''||cell.v==null)){const dest=target.getCell(r+1,c+1);if(!dest.isMerged||dest.master.address===dest.address){dest.value=null;if(cell.ct?.fa)dest.numFmt=cell.ct.fa;}}
  }));
 });
 return new Blob([await workbook.xlsx.writeBuffer() as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
