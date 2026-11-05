'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import {Sheet as SheetIcon} from 'lucide-react';
const BudgetWindow=dynamic(()=>import('./budget-window'),{ssr:false,loading:()=> <div className="budget-opening" role="status">Opening budget…</div>});
export default function ProjectBudget({project}:{project:{id:string;client:string;name:string}}){
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[over,setOver]=useState(false);
 return <><button type="button" className={'budget-button'+(over?' drag-over':'')} title="Open budget or drop an .xlsx file to replace it" aria-label="Open project budget" onClick={()=>{setFile(null);setOpen(true)}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const dropped=e.dataTransfer.files[0];if(dropped){setFile(dropped);setOpen(true)}}}><SheetIcon size={21}/></button>{open&&<BudgetWindow project={project} importFile={file} onClose={()=>{setOpen(false);setFile(null)}}/>}</>;
}
