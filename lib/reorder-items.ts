/** Reorder by stable identity without modifying any item's data. */
export function moveOrderedItem<T extends {id:string}>(items:T[],id:string,targetId:string):T[]{
 const from=items.findIndex(item=>item.id===id),to=items.findIndex(item=>item.id===targetId);
 if(from<0||to<0||from===to)return items;
 const result=[...items], [item]=result.splice(from,1);result.splice(to,0,item);return result;
}
