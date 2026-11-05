import {z} from 'zod';
import type {Budget} from './budget.ts';

export const rateUnits=['song','hour','day','session','tuning'] as const;
export type RateUnit=typeof rateUnits[number];
export const isPianoTuning=(name:string)=>/piano.*tun|tun.*piano/i.test(name);
const LineSchema=z.object({id:z.string().min(1).max(100),name:z.string().max(200),details:z.string().max(300),categoryId:z.string().min(1).max(100).optional(),rate:z.number().finite().min(0).max(1e9).nullable(),quantity:z.number().finite().min(0).max(1e6).nullable(),unit:z.enum(rateUnits)}).refine(row=>row.unit!=='tuning'||isPianoTuning(row.name),'Per tuning is only available for piano tuning.');
export const BudgetModelSchema=z.object({version:z.literal(1),estimate:z.number().finite().min(0).max(1e12).nullable().default(null),sections:z.array(z.object({id:z.string().min(1).max(100),name:z.string().max(200),rows:z.array(LineSchema).max(500)})).min(1).max(50),sessions:z.array(z.object({id:z.string().min(1).max(100),date:z.string().max(200),hours:z.number().finite().min(0).max(1e6).nullable()})).max(500),notes:z.string().max(10000)});
export type BudgetModel=z.infer<typeof BudgetModelSchema>;
export type BudgetLine=BudgetModel['sections'][number]['rows'][number];
export const newBudgetLine=():BudgetLine=>({id:crypto.randomUUID(),name:'',details:'',rate:null,quantity:null,unit:'hour'});
export function lineTotal(row:BudgetLine){return Math.round((row.rate??0)*(row.quantity??0)*100)/100}
export function sectionTotal(rows:BudgetLine[]){return rows.reduce((c,row)=>c+Math.round(lineTotal(row)*100),0)/100}
export function budgetTotal(model:BudgetModel){return model.sections.reduce((c,s)=>c+Math.round(sectionTotal(s.rows)*100),0)/100}

export function budgetRemaining(model:BudgetModel){return model.estimate===null?null:Math.round((model.estimate-budgetTotal(model))*100)/100}
export function groupBudgetRows(rows:BudgetLine[]){
 const groups:{id:string;name:string;rows:BudgetLine[]}[]=[],byKey=new Map<string,{id:string;name:string;rows:BudgetLine[]}>();
 for(const row of rows){const normalized=row.name.trim().toLocaleLowerCase('en-US'),key=row.categoryId?'id:'+row.categoryId:normalized?'name:'+normalized:'row:'+row.id;
  let group=byKey.get(key);if(!group){group={id:row.categoryId||row.id,name:row.name,rows:[]};byKey.set(key,group);groups.push(group)}group.rows.push(row);
 }
 return groups;
}

type Cell={v?:unknown;m?:string;f?:string;ct?:{fa?:string};[key:string]:unknown};
type Sheet={name?:string;data?:(Cell|null)[][];celldata?:{r:number;c:number;v:Cell}[];sessionBudget?:unknown};
export function sheetCells(sheet:Sheet):(Cell|null)[][]{
 if(sheet.data)return sheet.data;
 const matrix:(Cell|null)[][]=[];for(const {r,c,v}of sheet.celldata||[]){if(r>10000||c>200)continue;(matrix[r]??=[])[c]=v}return matrix;
}
const text=(cell?:Cell|null)=>String(cell?.v??cell?.m??'').trim();
function numeric(cell?:Cell|null):number|null{
 const v=cell?.v;if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:null;
 const match=String(v).replace(/,/g,'').match(/^\s*\$?\s*(\d+(?:\.\d+)?)/);return match?Number(match[1]):null;
}
export function inferUnit(cell:Cell|null|undefined,name:string,details:string):RateUnit{
 const value=[cell?.v,cell?.m,cell?.ct?.fa].join(' ');
 if(/\/(?:song|track)\b|per\s+(?:song|track)/i.test(value))return 'song';
 if(/\/(?:day)\b|per\s+day/i.test(value))return 'day';
 if(/\/(?:session)\b|per\s+session/i.test(value))return 'session';
 if(/\/(?:hr|hour)\b|per\s+hour/i.test(value))return 'hour';
 if(isPianoTuning(name))return 'tuning';
 return /guitar|keys|bass|percussion|mastering/i.test(name+' '+details)?'song':/equipment/i.test(name)?'session':'hour';
}
// Preserve the original workbook alongside the structured budget, including custom inserted rows.
export function readBudgetModel(budget:Budget):BudgetModel{
 const saved=(budget.sheets[0] as Sheet)?.sessionBudget;
 if(saved!==undefined)return BudgetModelSchema.parse(saved);
 const sections:BudgetModel['sections']=[],sessions:BudgetModel['sessions']=[],extra:string[]=[];let estimate:number|null=null;
 budget.sheets.forEach((raw,sheetIndex)=>{
  const sheet=raw as Sheet,cells=sheetCells(sheet);let section:BudgetModel['sections'][number]|null=null,previous='';
  cells.forEach((row,r)=>{
   if(!row)return;
   const label=[text(row[0]),text(row[1])].filter(Boolean).join(' '),details=[text(row[2]),text(row[3])].filter(Boolean).join(' '),rate=numeric(row[4]),quantity=numeric(row[5]);
   const date=text(row[7]),hours=numeric(row[11]);
   if(/^agreed estimate$/i.test(date)){estimate=hours;return}
   if(/^(remaining budget|over budget)$/i.test(date))return;
   if(r>=3&&((date&&!/^(dates?:|budget breakdown)$/i.test(date))||hours!==null))sessions.push({id:`sheet-${sheetIndex}-session-${r}`,date,hours});
   if(/^rate$/i.test(text(row[4]))&&/^total$/i.test(text(row[6]))){section={id:`sheet-${sheetIndex}-section-${r}`,name:(budget.sheets.length>1?`${sheet.name||'Budget'} · `:'')+(label||'Expenses'),rows:[]};sections.push(section);previous='';return;}
   if(/^sub\s*total$|^total$|^grand total$/i.test(label)){section=null;previous='';return;}
   const hasExpense=rate!==null||quantity!==null;
   if((section&&(label||details||hasExpense))||(!section&&hasExpense&&r>1)){
    if(!section){section={id:`sheet-${sheetIndex}-other-${r}`,name:'Other expenses',rows:[]};sections.push(section)}
    if(label)previous=label;
    const name=label||previous||'Expense';section.rows.push({id:`sheet-${sheetIndex}-row-${r}`,name,details,rate,quantity,unit:inferUnit(row[4],name,details)});
   }
   if(!section&&r>1&&label&&!hasExpense&&!details&&!/^notes:?$/i.test(label))extra.push(label);
  });
 });
 if(!sections.length)throw new Error('No budget sections found. Import a Session budget with Rate, Quantity and Total columns. Your original workbook is unchanged.');
 return BudgetModelSchema.parse({version:1,estimate,sections,sessions,notes:extra.join('\n').slice(0,10000)});
}
export function writeBudgetModel(budget:Budget,model:BudgetModel):Budget{
 return {...budget,sheets:budget.sheets.map((sheet,i)=>i===0?{...sheet,sessionBudget:BudgetModelSchema.parse(model)}:sheet)};
}
