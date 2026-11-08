'use client';
import dynamic from 'next/dynamic';
import './invoice.css';
import {useEffect,useState} from 'react';
import type {Project} from '@/lib/projects';
const InvoiceWindow=dynamic(()=>import('./invoice-window'),{ssr:false});
export default function ProjectInvoice({project,openRequest=0}:{project:Project;openRequest?:number}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(openRequest>0)setOpen(true)},[openRequest]);
 return open?<InvoiceWindow project={project} onClose={()=>setOpen(false)}/>:null;
}
