export type NotePart={text:string;href?:string};
/** Linkify web addresses without interpreting notes as HTML. */
export function noteLinks(text:string):NotePart[]{
 const parts:NotePart[]=[];
 const pattern=/(?<![\w@/])(?:https?:\/\/[^\s<>"']+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d+)?(?:[/?#][^\s<>"']*)?)/gi;
 let end=0;
 for(const match of text.matchAll(pattern)){
  const start=match.index!;
  let label=match[0].replace(/[.,!?;:]+$/,'');
  for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
   while(label.endsWith(close)&&label.split(close).length>label.split(open).length)label=label.slice(0,-1);
  }
  try{
   const url=new URL(/^https?:\/\//i.test(label)?label:'https://'+label);
   if(!['http:','https:'].includes(url.protocol)||!url.hostname)continue;
   if(start>end)parts.push({text:text.slice(end,start)});
   parts.push({text:label,href:url.href});end=start+label.length;
  }catch{/* Leave invalid addresses as plain text. */}
 }
 if(end<text.length)parts.push({text:text.slice(end)});
 return parts;
}
