'use client';
import {useRef} from 'react';
import {Bell,ArrowUpRight} from 'lucide-react';
import {paymentStatus,type Project} from '@/lib/projects';
export default function PaymentBell({projects,today,onOpen}:{projects:Project[];today:Date;onOpen:(id:string)=>void}){
 const details=useRef<HTMLDetailsElement>(null);
 const overdue=projects.filter(p=>paymentStatus(p,today).state==='overdue').sort((a,b)=>a.deliveredAt!.localeCompare(b.deliveredAt!));
 return <details className="notification-menu" ref={details} onKeyDown={e=>{if(e.key==='Escape'&&details.current)details.current.open=false}}><summary aria-label={`Payment notifications: ${overdue.length} overdue`}><Bell size={20}/>{overdue.length>0&&<span className="bell-count">{overdue.length}</span>}</summary><div className="notification-panel"><h3>Payment notifications</h3>{overdue.length===0?<p>No overdue payments.</p>:overdue.map(p=><button key={p.id} onClick={()=>{if(details.current)details.current.open=false;onOpen(p.id)}}><span><strong>{p.client}</strong><small>{p.name}</small><em>Unpaid · delivered {new Date(p.deliveredAt!).toLocaleDateString()}</em></span><ArrowUpRight size={17}/></button>)}<p className="notification-note">Unpaid projects appear here 30 days after delivery. Checking Payment received clears the alert.</p></div></details>;
}
