'use client';
import dynamic from 'next/dynamic';
import './invoice.css';
import {useEffect,useState} from 'react';
import {ReceiptText} from 'lucide-react';
import type {Project} from '@/lib/projects';
const InvoiceWindow=dynamic(()=>import('./invoice-window'),{ssr:false});
export default function ProjectInvoice({project,openRequest=0}:{project:Project;openRequest?:number}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(openRequest>0)setOpen(true)},[openRequest]);
 return <><button type="button" className="secondary" disabled={!project.deliveredAt} onClick={()=>setOpen(true)} title={project.deliveredAt?'Review invoice':'Available after delivery'}><ReceiptText size={17}/> Invoice</button>{open&&<InvoiceWindow project={project} onClose={()=>setOpen(false)}/>}</>;
}
