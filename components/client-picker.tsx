'use client';
import {useEffect,useState} from 'react';
import type {Client} from '@/lib/clients';
export default function ClientPicker({client,clientId,onChange,disabled}:{client:string;clientId?:string;onChange:(name:string,id?:string)=>void;disabled:boolean}){
 const [clients,setClients]=useState<Client[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[adding,setAdding]=useState(!clientId&&!!client);
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/clients');const data=await r.json() as Client[]&{error?:string};if(!r.ok)throw new Error(data.error||'Could not load clients');setClients(data.sort((a,b)=>a.name.localeCompare(b.name)))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 return <div className="client-picker"><label>Client / artist<select autoFocus required disabled={disabled||loading} value={adding?'__new__':clientId||''} onChange={e=>{if(e.target.value==='__new__'){setAdding(true);onChange('');return}setAdding(false);const found=clients.find(c=>c.id===e.target.value);onChange(found?.name||'',found?.id)}}><option value="" disabled>{loading?'Loading clients…':'Select a client'}</option>{clientId&&!clients.some(c=>c.id===clientId)&&<option value={clientId}>{client}</option>}{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new__">+ New client</option></select></label>{adding&&<label className="new-client-label">New client name<input required disabled={disabled} maxLength={120} value={client} onChange={e=>onChange(e.target.value)} placeholder="Client or artist name"/></label>}{error&&<p className="error">{error} <button type="button" onClick={load}>Retry</button></p>}</div>;
}
