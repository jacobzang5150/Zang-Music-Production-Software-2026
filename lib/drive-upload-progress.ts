/** Byte-weighted progress for the entire batch; zero-byte files still count. */
export function uploadBatchPercent(sizes:number[],completed:number,currentPercent=0):number{
 if(!sizes.length)return 0;
 const weights=sizes.map(size=>Math.max(1,Number.isFinite(size)?size:0));
 const done=Math.min(weights.length,Math.max(0,Math.floor(completed)));
 if(done===weights.length)return 100;
 const sent=weights.slice(0,done).reduce((sum,size)=>sum+size,0)+weights[done]*Math.min(100,Math.max(0,currentPercent))/100;
 return Math.min(99,Math.round(sent/weights.reduce((sum,size)=>sum+size,0)*100));
}
