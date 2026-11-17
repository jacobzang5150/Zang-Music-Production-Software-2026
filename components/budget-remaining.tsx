'use client';
import {useState} from 'react';
import {budgetRemaining,budgetRemainingHours,type BudgetModel} from '@/lib/budget-model';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const hours=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
export default function BudgetRemaining({model}:{model:BudgetModel}){
 const [showHours,setShowHours]=useState(false),remaining=budgetRemaining(model),over=remaining!==null&&remaining<0;
 return <div className={'budget-total-caption budget-remaining'+(over?' is-over-budget':'')}>
  <div className="budget-remaining-heading"><span>{over?'OVER BUDGET':'REMAINING'}</span><div className="budget-remaining-toggle" role="group" aria-label="Remaining budget display"><button type="button" aria-pressed={!showHours} onClick={()=>setShowHours(false)}>Money</button><button type="button" aria-pressed={showHours} onClick={()=>setShowHours(true)}>Hours</button></div></div>
  <output aria-live="polite" aria-label={showHours?(over?'Hours over budget at 80 dollars per hour':'Hours remaining at 80 dollars per hour'):'Remaining project budget'}>{remaining===null?'—':showHours?`${hours.format(Math.abs(budgetRemainingHours(model)!))} hrs`:money.format(Math.abs(remaining))}</output>
  {showHours&&<small className="budget-remaining-rate">at $80/hr</small>}
 </div>;
}
