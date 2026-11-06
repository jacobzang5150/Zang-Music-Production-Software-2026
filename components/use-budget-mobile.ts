'use client';
import {useEffect,type RefObject} from 'react';

// VisualViewport accounts for the iOS keyboard; desktop styles never consume these values.
export function useBudgetMobile(dialog:RefObject<HTMLDialogElement|null>){
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  const mobile=window.matchMedia('(max-width:800px), (max-width:1100px) and (pointer:coarse) and (hover:none)'),viewport=window.visualViewport;
  let baseline=window.innerHeight,frame=0;
  const clear=()=>{element.style.removeProperty('--budget-mobile-height');element.style.removeProperty('--budget-mobile-top');element.classList.remove('budget-mobile-keyboard')};
  const update=()=>{
   cancelAnimationFrame(frame);
   if(!mobile.matches){clear();return}
   if(viewport&&Math.abs(viewport.scale-1)>.1)return;
   const height=viewport?.height??window.innerHeight;
   const editing=element.contains(document.activeElement)&&document.activeElement?.matches('input:not([type=file]),textarea');
   if(!editing&&!element.classList.contains('budget-mobile-keyboard'))baseline=Math.max(height,window.innerHeight);
   const keyboard=!!editing&&baseline-height>120;
   element.style.setProperty('--budget-mobile-height',height+'px');
   element.style.setProperty('--budget-mobile-top',(viewport?.offsetTop??0)+'px');
   element.classList.toggle('budget-mobile-keyboard',keyboard);
   if(keyboard){frame=requestAnimationFrame(()=>{const focused=document.activeElement;if(focused instanceof HTMLElement&&element.contains(focused))focused.scrollIntoView({block:'nearest'})})}
  };
  const rotate=()=>{baseline=window.innerHeight;update()};
  update();mobile.addEventListener('change',update);window.addEventListener('resize',update);window.addEventListener('orientationchange',rotate);viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);element.addEventListener('focusin',update);element.addEventListener('focusout',update);
  return()=>{cancelAnimationFrame(frame);clear();mobile.removeEventListener('change',update);window.removeEventListener('resize',update);window.removeEventListener('orientationchange',rotate);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);element.removeEventListener('focusin',update);element.removeEventListener('focusout',update)};
 },[dialog]);
}
