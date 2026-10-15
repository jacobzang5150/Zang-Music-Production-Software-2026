'use client';
import {ChevronDown,ChevronUp} from 'lucide-react';

export default function StageWeight({name,value,max,remainder,disabled,onChange}:{name:string;value:number;max:number;remainder:boolean;disabled:boolean;onChange:(value:number)=>void}){
 const title=remainder?'Automatically uses the remaining percentage':'Adjusts only stages below this one';
 return <div className="stage-weight">
  <input className="desktop-weight" required aria-label={name+' percentage'} type="number" min={0} max={max} step={5} value={value} readOnly={remainder} disabled={disabled} title={title} onChange={e=>onChange(Number(e.target.value))}/>
  <span className="desktop-weight">%</span>
  <div className="mobile-weight" role="group" aria-label={name+' percentage'} title={title}>
   <button type="button" aria-label={'Decrease '+name+' by 5 percent'} disabled={disabled||remainder||value<=0} onClick={()=>onChange(value-5)}><ChevronDown size={20}/></button>
   <output aria-live="polite" aria-label={name+' percentage'+(remainder?', automatic remainder':'')}>{value}%</output>
   <button type="button" aria-label={'Increase '+name+' by 5 percent'} disabled={disabled||remainder||value>=max} onClick={()=>onChange(value+5)}><ChevronUp size={20}/></button>
  </div>
 </div>;
}
