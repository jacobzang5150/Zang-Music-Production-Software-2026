import {z} from 'zod';

// Workbook JSON stays separate from project revisions and Drive metadata.
export const BudgetSchema=z.object({id:z.string().min(1).max(80),sheets:z.array(z.object({name:z.string().min(1).max(100),id:z.string().optional()}).passthrough()).min(1).max(20),templateTitle:z.boolean().default(false)}).refine(p=>JSON.stringify(p).length<=2_000_000,'This workbook is too large. Use a workbook under 2 MB of cell data.');
export type Budget=z.infer<typeof BudgetSchema>;

export function createBudget(project:{id:string;client:string;name:string}):Budget{
 const data:Record<string,unknown>[][]=Array.from({length:40},()=>Array.from({length:13},()=>({v:'',bg:'#19171b',fc:'#eee5ed',ff:'DM Sans',fs:11,vt:0,tb:1})));
 const put=(r:number,c:number,v:string|number,style:Record<string,unknown>={})=>{data[r-1][c-1]={...data[r-1][c-1],v,m:typeof v==='number'?v.toFixed(2):v,...style}};
 put(1,1,`${project.client} - ${project.name}`,{fs:18,bl:1,ff:'Space Grotesk'});
 put(1,8,'Budget Breakdown',{fs:16,bl:1,ff:'Space Grotesk',fc:'#f38fa9'});
 const groups:[number,string,number,number][]=[[3,'Recording / Production',4,8],[11,'Overdubs',12,18],[22,'Post-Production',23,26]];
 const merge:Record<string,unknown>={};
 function merged(r:number,c:number,rs:number,cs:number){merge[`${r-1}_${c-1}`]={r:r-1,c:c-1,rs,cs};for(let y=r-1;y<r-1+rs;y++)for(let x=c-1;x<c-1+cs;x++)data[y][x].mc=y===r-1&&x===c-1?{r:r-1,c:c-1,rs,cs}:{r:r-1,c:c-1};}
 merged(1,1,1,7);merged(1,8,1,6);
 const money={m:'$0.00',ct:{fa:'$#,##0.00',t:'n'},ht:2};
 for(const [row,title,start,end] of groups){
  for(let c=1;c<=7;c++)put(row,c,'',{bg:'#48202d',bl:1,fc:'#ffd0dc'});
  put(row,1,title);merged(row,1,1,4);put(row,5,'Rate');put(row,6,'Quantity');put(row,7,'Total');
  for(let r=start;r<=end;r++){
   merged(r,1,1,2);merged(r,3,1,2);
   put(r,5,'',{...money,m:'',fc:'#ff9db6',bg:'#241b22'});put(r,6,'',{ct:{fa:'0.00',t:'n'},bg:'#241b22',fc:'#ff9db6'});
   put(r,7,0,{...money,f:`=E${r}*F${r}`});
  }
  const sub=end+1;put(sub,1,'Sub Total',{bl:1});merged(sub,1,1,4);put(sub,7,0,{...money,f:`=SUM(G${start}:G${end})`,bl:1,bg:'#30212b'});
 }
 const rows:[number,string,string,number|null,string][]=[
  [4,'Producer/Engineer','Jacob Zang',80,'hr'],[5,'Recording Studio Rental','',null,''],[6,'Equipment Rental','',0,''],[7,'Piano Tuning','',200,'tuning'],[8,'Studio Musicians','',null,''],
  [12,'Producer/Engineer','Jacob Zang',80,'hr'],[13,'Home Overdubs','Electric Guitar',100,'song'],[14,'','Acoustic Guitar',50,'song'],[15,'','Keys',75,'song'],[16,'','Bass',50,'song'],[17,'','Percussion',25,''],[18,'Studio Musicians','',null,''],
  [23,'Editing','',80,'hr'],[24,'Melodyne','',80,'hr'],[25,'Mixing','',80,'hr'],[26,'Mastering','',100,'song']
 ];
 for(const [r,label,person,rate,unit] of rows){put(r,1,label);put(r,3,person);if(rate!==null)put(r,5,rate,{m:`$${rate.toFixed(2)}${unit?'/'+unit:''}`,ct:{fa:unit?`$0.00"/${unit}"`:'$#,##0.00',t:'n'}});}
 put(3,8,'Dates:',{bl:1,fc:'#f38fa9'});merged(3,8,1,4);put(3,12,'Hours',{bl:1,fc:'#f38fa9'});merged(3,12,1,2);
 for(let r=4;r<=29;r++){merged(r,8,1,4);merged(r,12,1,2);put(r,8,'',{bg:'#211a20'});put(r,12,'',{bg:'#211a20',ct:{fa:'0.00',t:'n'}});}
 put(29,1,'Total',{bl:1,fs:14});merged(29,1,1,4);put(29,7,0,{...money,f:'=SUM(G9,G19,G27)',bl:1,fs:14,bg:'#842c43'});
 const calcChain=data.flatMap((row,r)=>row.flatMap((cell,c)=>cell.f?[{r,c,id:'budget'}]:[]));
 return {id:project.id,templateTitle:true,sheets:[{id:'budget',name:'Budget',status:1,order:0,row:40,column:13,data,calcChain,config:{merge,columnlen:{0:110,1:105,2:100,3:80,4:125,5:105,6:130,7:60,8:55,9:40,10:40,11:50,12:45},rowlen:{0:48,2:36,10:36,21:36,28:38}},defaultRowHeight:30,showGridLines:0}]};
}

