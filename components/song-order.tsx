'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDownWideNarrow,Check,ChevronDown} from 'lucide-react';
import {songOrderLabels,type SongOrder} from '@/lib/song-order';
export default function SongOrderMenu({value,onChange}:{value:SongOrder;onChange:(value:SongOrder)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[open]);
 return <div className="song-order" ref={root} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
 <button type="button" className="song-order-trigger" ref={trigger} aria-label={'Order songs: '+songOrderLabels[value]} aria-expanded={open} aria-controls="song-order-options" onClick={()=>setOpen(!open)}><ArrowDownWideNarrow size={15}/>{songOrderLabels[value]}<ChevronDown size={13}/></button>
 {open&&<div className="song-order-options" id="song-order-options" role="group" aria-label="Order songs">{(Object.keys(songOrderLabels) as SongOrder[]).map(order=><button type="button" key={order} aria-pressed={order===value} onClick={()=>{onChange(order);setOpen(false);trigger.current?.focus()}}>{songOrderLabels[order]}{order===value&&<Check size={15}/>}</button>)}</div>}
 </div>;
}
