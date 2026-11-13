'use client';
import {useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {localSessionDate,parseSessionDate,sessionCalendarDays,sessionDateValue,shiftSessionMonth} from '@/lib/session-dates';
const months=Array.from({length:12},(_,index)=>new Intl.DateTimeFormat('en-US',{month:'long'}).format(localSessionDate(2026,index,1)));
const dayLabel=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'});
export default function SessionDatePicker({value,onSelect,onClose}:{value:string;onSelect:(value:string)=>void;onClose:()=>void}){
 const selected=parseSessionDate(value),today=new Date(),initial=selected||localSessionDate(today.getFullYear(),today.getMonth(),today.getDate());
 const [cursor,setCursor]=useState(initial),[month,setMonth]=useState(()=>localSessionDate(initial.getFullYear(),initial.getMonth(),1));
 const dialog=useRef<HTMLDialogElement>(null),key=sessionDateValue(cursor),days=sessionCalendarDays(month);
 const minYear=Math.min(1900,month.getFullYear()),maxYear=Math.max(2100,month.getFullYear());
 useLayoutEffect(()=>{const element=dialog.current;if(!element)return;element.showModal();return()=>{if(element.open)element.close()}},[]);
 useEffect(()=>{dialog.current?.querySelector<HTMLButtonElement>(`button[data-calendar-day="${key}"]`)?.focus()},[key,month]);
 function move(date:Date){if(date.getFullYear()<1||date.getFullYear()>9999)return;setCursor(date);setMonth(localSessionDate(date.getFullYear(),date.getMonth(),1))}
 function keyboard(e:KeyboardEvent){
  let next:Date|null=null;
  if(e.key==='ArrowLeft')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()-1);
  if(e.key==='ArrowRight')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+1);
  if(e.key==='ArrowUp')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()-7);
  if(e.key==='ArrowDown')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+7);
  if(e.key==='Home')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()-cursor.getDay());
  if(e.key==='End')next=localSessionDate(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+6-cursor.getDay());
  if(e.key==='PageUp')next=shiftSessionMonth(cursor,e.shiftKey?-12:-1);
  if(e.key==='PageDown')next=shiftSessionMonth(cursor,e.shiftKey?12:1);
  if(next){e.preventDefault();e.stopPropagation();move(next)}
 }
 return <dialog ref={dialog} className="budget-session-calendar" aria-labelledby="session-calendar-title" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose()}} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.metaKey||e.ctrlKey)e.stopPropagation()}}>
  <div className="session-calendar-heading"><h3 id="session-calendar-title">Select session date</h3><button type="button" aria-label="Close calendar" onClick={onClose}><X size={18}/></button></div>
  <div className="session-calendar-nav"><button type="button" aria-label="Previous month" onClick={()=>move(shiftSessionMonth(cursor,-1))}><ChevronLeft size={18}/></button><div className="session-calendar-months"><select aria-label="Calendar month" value={month.getMonth()} onChange={e=>{const start=localSessionDate(month.getFullYear(),Number(e.target.value),1);move(localSessionDate(start.getFullYear(),start.getMonth(),Math.min(cursor.getDate(),localSessionDate(start.getFullYear(),start.getMonth()+1,0).getDate())))}}>{months.map((name,index)=><option key={name} value={index}>{name}</option>)}</select><select aria-label="Calendar year" value={month.getFullYear()} onChange={e=>{const year=Number(e.target.value);move(localSessionDate(year,month.getMonth(),Math.min(cursor.getDate(),localSessionDate(year,month.getMonth()+1,0).getDate())))}}>{Array.from({length:maxYear-minYear+1},(_,index)=>minYear+index).map(year=><option key={year} value={year}>{year}</option>)}</select></div><button type="button" aria-label="Next month" onClick={()=>move(shiftSessionMonth(cursor,1))}><ChevronRight size={18}/></button></div>
  <div className="session-calendar-grid" role="grid" aria-label={`${months[month.getMonth()]} ${month.getFullYear()}`} onKeyDown={keyboard}>
   <div role="row">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span role="columnheader" key={day}>{day}</span>)}</div>
   {Array.from({length:6},(_,week)=><div role="row" key={week}>{days.slice(week*7,week*7+7).map(date=>{const dateKey=sessionDateValue(date),chosen=!!selected&&dateKey===sessionDateValue(selected),isToday=dateKey===sessionDateValue(today);return <span role="gridcell" aria-selected={chosen} key={dateKey}><button type="button" data-calendar-day={dateKey} disabled={date.getFullYear()<1||date.getFullYear()>9999} tabIndex={dateKey===key?0:-1} className={(date.getMonth()!==month.getMonth()?' is-outside':'')+(chosen?' is-selected':'')+(isToday?' is-today':'')} aria-label={dayLabel.format(date)} aria-current={isToday?'date':undefined} onFocus={()=>setCursor(date)} onClick={()=>onSelect(dateKey)}>{date.getDate()}</button></span>})}</div>)}
  </div>
  <div className="session-calendar-footer"><button type="button" onClick={()=>onSelect(sessionDateValue(today))}>Today</button><button type="button" disabled={!value} onClick={()=>onSelect('')}>Clear date</button></div>
 </dialog>;
}
