// Session dates are local calendar dates, never UTC timestamps.
export function localSessionDate(year:number,month:number,day:number):Date{
 const date=new Date(0);date.setFullYear(year,month,day);date.setHours(12,0,0,0);return date;
}
export function parseSessionDate(value:string):Date|null{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return null;
 const year=Number(match[1]),month=Number(match[2])-1,day=Number(match[3]);
 if(year<1||month<0||month>11||day<1||day>31)return null;
 const date=localSessionDate(year,month,day);
 return date.getFullYear()===year&&date.getMonth()===month&&date.getDate()===day?date:null;
}
export function sessionDateValue(date:Date):string{return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function sessionDateLabel(value:string):string{
 const date=parseSessionDate(value);return date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date):value||'Select date';
}
export function sessionCalendarDays(month:Date):Date[]{
 const first=localSessionDate(month.getFullYear(),month.getMonth(),1),start=1-first.getDay();
 return Array.from({length:42},(_,index)=>localSessionDate(month.getFullYear(),month.getMonth(),start+index));
}
export function shiftSessionMonth(date:Date,months:number):Date{
 const first=localSessionDate(date.getFullYear(),date.getMonth()+months,1),last=localSessionDate(first.getFullYear(),first.getMonth()+1,0).getDate();
 return localSessionDate(first.getFullYear(),first.getMonth(),Math.min(date.getDate(),last));
}
