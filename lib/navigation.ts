export const workspaceViews=['Projects','Work queue','Leads','Graphs'] as const;
export type WorkspaceView=typeof workspaceViews[number];
export type WorkspaceRoute={view:WorkspaceView;selected:string|null};
const slugs:Record<WorkspaceView,string>={'Projects':'projects','Work queue':'queue','Leads':'leads','Graphs':'graphs'};
export function routeHash(route:WorkspaceRoute){
 const project=(route.view==='Projects'||route.view==='Work queue')&&route.selected;
 return '#/'+slugs[route.view]+(project?'/'+encodeURIComponent(project):'');
}
export function readRoute(hash:string):WorkspaceRoute{
 const [slug,id]=hash.replace(/^#\/?/,'').split('/');
 const view=workspaceViews.find(v=>slugs[v]===slug)||'Projects';
 let selected:string|null=null;
 if(id&&(view==='Projects'||view==='Work queue'))try{selected=decodeURIComponent(id)}catch{}
 return {view,selected};
}
type HistoryHost=Pick<Window,'location'|'history'|'addEventListener'|'removeEventListener'>;
// Keep framework-owned history state intact; only add our own index.
export function connectWorkspaceHistory(host:HistoryHost,onRoute:(route:WorkspaceRoute)=>void,beforeBackOrForward:()=>boolean=()=>true){
 const key='studioNavigationIndex';
 let route=readRoute(host.location.hash);
 let index=Number.isSafeInteger(host.history.state?.[key])?host.history.state[key]:0;
 const state=(i:number)=>({...host.history.state,[key]:i});
 host.history.replaceState(state(index),'',routeHash(route));
 onRoute(route);
 const pop=()=>{
  const next=readRoute(host.location.hash);
  const nextIndex=Number.isSafeInteger(host.history.state?.[key])?host.history.state[key]:index;
  if(routeHash(next)===routeHash(route)){index=nextIndex;return}
  if(!beforeBackOrForward()){
   if(nextIndex!==index)host.history.go(index-nextIndex);
   else host.history.replaceState(state(index),'',routeHash(route));
   return;
  }
  route=next;index=nextIndex;onRoute(route);
 };
 host.addEventListener('popstate',pop);
 return {
  navigate(next:WorkspaceRoute,replace=false){
   if(routeHash(next)===routeHash(route))return;
   if(!replace)index++;
   host.history[replace?'replaceState':'pushState'](state(index),'',routeHash(next));
   route=next;onRoute(next);
  },
  dispose(){host.removeEventListener('popstate',pop)}
 };
}
