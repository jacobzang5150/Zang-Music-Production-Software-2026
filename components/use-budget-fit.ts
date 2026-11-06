'use client';
import {useLayoutEffect,type RefObject} from 'react';

// Fit the desktop-width sheet inside the phone. Native page pinch zoom remains free.
export function useBudgetFit(dialog:RefObject<HTMLDialogElement|null>,ready:boolean){
 useLayoutEffect(()=>{
  const element=dialog.current,sheet=element?.querySelector<HTMLElement>('.budget-sheet'),scroller=element?.querySelector<HTMLElement>('.budget-scroll');
  if(!ready||!element||!sheet||!scroller)return;
  const mobile=window.matchMedia('(max-width:800px), (max-width:1100px) and (pointer:coarse) and (hover:none)');
  const fit=()=>{
   if(!mobile.matches){element.style.removeProperty('--budget-sheet-zoom');return}
   // A pinch changes the visual viewport, not the sheet's base fit. Never reset it.
   if(window.visualViewport&&Math.abs(window.visualViewport.scale-1)>.1)return;
   const style=getComputedStyle(scroller),available=scroller.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
   const width=Math.max(1140,sheet.scrollWidth,sheet.offsetWidth);
   if(available<=0)return;
   const zoom=String(Math.max(.01,Math.floor(Math.min(1,(available-1)/width)*10000)/10000));
   if(element.style.getPropertyValue('--budget-sheet-zoom')!==zoom)element.style.setProperty('--budget-sheet-zoom',zoom);
  };
  fit();const observer=new ResizeObserver(fit);observer.observe(scroller);observer.observe(sheet);
  mobile.addEventListener('change',fit);window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
  return()=>{observer.disconnect();mobile.removeEventListener('change',fit);window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit);element.style.removeProperty('--budget-sheet-zoom')};
 },[dialog,ready]);
}
