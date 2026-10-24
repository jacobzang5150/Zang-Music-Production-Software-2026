import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectWorkspaceHistory,readRoute,routeHash,type WorkspaceRoute} from '../lib/navigation.ts';

function browser(hash='#/projects'){
 const listeners=new Set<()=>void>();
 const stack=[{hash,state:{framework:'retained'} as Record<string,unknown>}];let position=0;
 const host={
  location:{get hash(){return stack[position].hash}},
  history:{
   get state(){return stack[position].state},
   replaceState(state:Record<string,unknown>,_:string,url:string){stack[position]={state,hash:url}},
   pushState(state:Record<string,unknown>,_:string,url:string){stack.splice(position+1);stack.push({state,hash:url});position++},
   go(delta:number){const next=position+delta;if(next<0||next>=stack.length)return;position=next;for(const listen of listeners)listen()}
  },
  addEventListener(_:string,listen:()=>void){listeners.add(listen)},
  removeEventListener(_:string,listen:()=>void){listeners.delete(listen)}
 };
 return {host:host as unknown as Parameters<typeof connectWorkspaceHistory>[0],stack};
}
test('workspace routes round-trip including project and overdub IDs',()=>{
 for(const view of ['Projects','Work queue','Leads','Graphs'] as const){
  const route={view,selected:null};assert.deepEqual(readRoute(routeHash(route)),route);
 }
 const route={view:'Projects' as const,selected:'id /?&#'};
 assert.deepEqual(readRoute(routeHash(route)),route);
 assert.deepEqual(readRoute('#/unknown'),{view:'Projects',selected:null});
 assert.deepEqual(readRoute('#/projects/%bad'),{view:'Projects',selected:null});
});
test('Back and Forward restore tabs and project detail without adding history entries',()=>{
 const {host,stack}=browser();let current!:WorkspaceRoute;
 const controller=connectWorkspaceHistory(host,r=>current=r);
 controller.navigate({view:'Graphs',selected:null});
 controller.navigate({view:'Projects',selected:'project-one'});
 controller.navigate({view:'Projects',selected:'project-one'});
 assert.equal(stack.length,3);
 host.history.go(-1);assert.deepEqual((current as WorkspaceRoute),{view:'Graphs',selected:null});
 host.history.go(-1);assert.deepEqual((current as WorkspaceRoute),{view:'Projects',selected:null});
 host.history.go(1);host.history.go(1);
 assert.equal((current as WorkspaceRoute).selected,'project-one');assert.equal(stack.length,3);
 assert.equal(host.history.state.framework,'retained');
 controller.navigate({view:'Work queue',selected:null});
 host.history.go(-1);
 controller.navigate({view:'Leads',selected:null});
 host.history.go(1);assert.equal((current as WorkspaceRoute).view,'Leads');
 controller.dispose();
});
test('refresh restores a deep link and canceled navigation preserves the form page',()=>{
 const {host,stack}=browser('#/queue/overdub-one');let current!:WorkspaceRoute;let allow=false;
 const controller=connectWorkspaceHistory(host,r=>current=r,()=>allow);
 assert.deepEqual((current as WorkspaceRoute),{view:'Work queue',selected:'overdub-one'});
 controller.navigate({view:'Graphs',selected:null});
 host.history.go(-1);
 assert.deepEqual((current as WorkspaceRoute),{view:'Graphs',selected:null});assert.equal(host.location.hash,'#/graphs');assert.equal(stack.length,2);
 allow=true;host.history.go(-1);
 assert.deepEqual((current as WorkspaceRoute),{view:'Work queue',selected:'overdub-one'});
 controller.dispose();
 const refreshed=connectWorkspaceHistory(host,r=>current=r);
 assert.equal((current as WorkspaceRoute).selected,'overdub-one');
 refreshed.dispose();
});
