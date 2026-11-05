'use client';
import {useCallback,useEffect,useRef,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import type {BudgetMove,BudgetDrop} from '@/lib/budget-order';
type Active={source:HTMLElement;capture:HTMLElement;pointerId:number;move:BudgetMove;preview:HTMLElement;x:number;y:number;offsetX:number;offsetY:number;originX:number;originY:number;moved:boolean;target:HTMLElement|null;drop:BudgetDrop|null;cursor:string;select:string};
export function useBudgetDrag(dialog:RefObject<HTMLDialogElement|null>,disabled:boolean,onDrop:(source:BudgetMove,target:BudgetDrop)=>void){
 const active=useRef<Active|null>(null),begin=useRef<()=>void>(()=>{}),callback=useRef(onDrop),blocked=useRef(disabled);callback.current=onDrop;blocked.current=disabled;
 const cancel=useCallback(()=>{const drag=active.current;if(!drag)return;active.current=null;drag.preview.remove();drag.source.classList.remove('budget-drag-source');drag.target?.classList.remove('budget-drop-before','budget-drop-after');document.body.style.cursor=drag.cursor;document.body.style.userSelect=drag.select;try{if(drag.capture.hasPointerCapture(drag.pointerId))drag.capture.releasePointerCapture(drag.pointerId)}catch{}},[]);
 useEffect(()=>{
  function locate(drag:Active){
   const selector=drag.move.kind==='category'?'[data-budget-drag-kind="category"]':'[data-budget-drag-kind="item"]';
   const element=document.elementFromPoint(drag.x,drag.y)?.closest<HTMLElement>(selector);
   drag.target?.classList.remove('budget-drop-before','budget-drop-after');drag.target=null;drag.drop=null;
   if(!element||!dialog.current?.contains(element))return;
   const rowId=element.dataset.budgetRow!,sectionId=element.dataset.budgetSection!,groupId=element.dataset.budgetGroup;
   if(rowId===drag.move.rowId&&sectionId===drag.move.sectionId||drag.move.kind==='item'&&(sectionId!==drag.move.sectionId||groupId!==drag.move.groupId))return;
   const rect=element.getBoundingClientRect(),placement=drag.y<rect.top+rect.height/2?'before':'after';
   drag.target=element;drag.drop={kind:drag.move.kind,rowId,sectionId,groupId,placement};element.classList.add('budget-drop-'+placement);
  }
  function move(e:PointerEvent){const drag=active.current;if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();drag.x=e.clientX;drag.y=e.clientY;drag.moved ||= Math.hypot(drag.x-drag.originX,drag.y-drag.originY)>4;drag.preview.style.left=(drag.x-drag.offsetX)+'px';drag.preview.style.top=(drag.y-drag.offsetY)+'px';locate(drag)}
  function finish(e:PointerEvent){const drag=active.current;if(!drag||e.pointerId!==drag.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;locate(drag);const drop=drag.drop;cancel();if(drag.moved&&drop&&!blocked.current)callback.current(drag.move,drop)}
  function key(e:KeyboardEvent){if(active.current&&(e.key==='Escape'||(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();cancel()}}
  let frame=0,last=0;
  function tick(time:number){if(!active.current){frame=0;return}const drag=active.current,scroller=dialog.current?.querySelector<HTMLElement>('.budget-scroll');if(drag&&scroller){const rect=scroller.getBoundingClientRect(),edge=55;const velocity=drag.y<rect.top+edge?-Math.min(1,(rect.top+edge-drag.y)/edge):drag.y>rect.bottom-edge?Math.min(1,(drag.y-rect.bottom+edge)/edge):0;if(velocity){scroller.scrollTop+=velocity*Math.min(time-last||16,32)*.6;locate(drag)}}last=time;frame=requestAnimationFrame(tick)}
  begin.current=()=>{if(!frame)frame=requestAnimationFrame(tick)};window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);cancel()};
 },[dialog,cancel]);
 const start=useCallback((e:ReactPointerEvent<HTMLElement>,move:BudgetMove,handle=false)=>{
  if(blocked.current||e.button!==0||!handle&&(e.pointerType==='touch'||(e.target as Element).closest('input,textarea,select,button,a,summary,details')))return;
  const source=e.currentTarget.closest<HTMLElement>('[data-budget-drag-kind]');if(!source||!dialog.current)return;
  e.preventDefault();e.stopPropagation();cancel();if(handle)e.currentTarget.focus({preventScroll:true});
  const rect=source.getBoundingClientRect(),preview=source.cloneNode(true) as HTMLElement;
  preview.classList.add('budget-drag-preview');preview.setAttribute('aria-hidden','true');preview.inert=true;
  const originals=Array.from(source.querySelectorAll('input,textarea,select'),node=>(node as unknown as {value:string}).value);preview.querySelectorAll('input,textarea,select').forEach((node,i)=>{const field=node as unknown as {value:string;tabIndex:number};field.value=originals[i];field.tabIndex=-1});
  preview.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));preview.removeAttribute('id');preview.querySelectorAll('details[open]').forEach(menu=>menu.removeAttribute('open'));
  Object.assign(preview.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',opacity:'0.5',pointerEvents:'none',zIndex:'1000'});
  dialog.current.appendChild(preview);active.current={source,capture:e.currentTarget,pointerId:e.pointerId,move,preview,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,originX:e.clientX,originY:e.clientY,moved:false,target:null,drop:null,cursor:document.body.style.cursor,select:document.body.style.userSelect};
  source.classList.add('budget-drag-source');begin.current();document.body.style.cursor='grabbing';document.body.style.userSelect='none';try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
 },[dialog,cancel]);
 return {start,cancel};
}
