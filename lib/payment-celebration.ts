// A temporary, non-interactive overlay; no project data or payment state lives here.
export async function playPaymentBurst(checkbox:HTMLElement):Promise<boolean>{
 if(!checkbox.isConnected)return false;
 const rect=checkbox.getBoundingClientRect();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const burst=document.createElement('div');
 burst.className='payment-burst';
 burst.setAttribute('aria-hidden','true');
 burst.style.left=(rect.left+rect.width/2)+'px';
 burst.style.top=(rect.top+rect.height/2)+'px';
 const animations:Animation[]=[];
 try{
  document.body.appendChild(burst);
  const count=reduced?1:24;
  for(let i=0;i<count;i++){
   const dollar=document.createElement('span');
   dollar.textContent='$';dollar.className='payment-dollar';
   dollar.style.color=['#ef4b5c','#ff97ae','#e23845','#f8d2e7'][i%4];
   const angle=(i/count)*Math.PI*2;
   const distance=140+(i%4)*36;
   const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance;
   burst.appendChild(dollar);
   animations.push(dollar.animate(reduced?[
    {opacity:0,transform:'translate(-50%, -135%)'},
    {opacity:1,transform:'translate(-50%, -135%)',offset:.25},
    {opacity:0,transform:'translate(-50%, -135%)'}
   ]:[
    {opacity:0,transform:'translate(-50%, -50%) scale(.35)'},
    {opacity:1,offset:.18,transform:'translate(calc(-50% + '+x*.25+'px), calc(-50% + '+y*.25+'px)) scale(1)'},
    {opacity:1,offset:.7,transform:'translate(calc(-50% + '+x*.78+'px), calc(-50% + '+y*.78+'px)) scale(1.15)'},
    {opacity:0,transform:'translate(calc(-50% + '+x+'px), calc(-50% + '+y+'px)) scale(.7) rotate('+((i%2?1:-1)*20)+'deg)'}
   ],{duration:reduced?300:2400,delay:reduced?0:(i%4)*100,easing:'ease-out',fill:'both'}));
  }
  await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
 }catch{
  // A missing animation API must never undo a successful payment save.
 }finally{
  animations.forEach(a=>a.cancel());burst.remove();
 }
 return checkbox.isConnected;
}
