import test from 'node:test';
import assert from 'node:assert/strict';
import {connectDriveHistory} from '../lib/drive-history.ts';
import {DRIVE_FOLDER} from '../lib/drive-files.ts';
test('folder history supports Back/Forward without changing the workspace URL, and truncates forward history',()=>{
 const stack=[{state:{framework:'keep',studioNavigationIndex:2} as Record<string,any>}];let index=0;const listeners=new Set<()=>void>();
 const host={location:{href:'https://session.test/#/home/project'},history:{get state(){return stack[index].state},pushState(state:Record<string,any>){stack.splice(index+1);stack.push({state});index++},replaceState(state:Record<string,any>){stack[index]={state}},go(delta:number){const next=index+delta;if(next<0||next>=stack.length)return;index=next;for(const fn of listeners)fn()}},addEventListener(_:string,fn:()=>void){listeners.add(fn)},removeEventListener(_:string,fn:()=>void){listeners.delete(fn)}};
 const file=(id:string)=>({id,name:id,mimeType:DRIVE_FOLDER});let current='',exited=0,back=false,forward=false;
 const history=connectDriveHistory(host as unknown as Parameters<typeof connectDriveHistory>[0],path=>current=path.at(-1)!.id,()=>exited++,()=>true,(b,f)=>{back=b;forward=f});
 history.record([file('project')]);history.record([file('project'),file('mixes')]);history.record([file('project'),file('mixes'),file('v1')]);history.back();assert.equal(current,'mixes');assert(back&&forward);history.forward();assert.equal(current,'v1');history.back();history.record([file('project'),file('edits')]);assert(!forward);history.back();assert.equal(current,'mixes');history.back();assert.equal(current,'project');history.back();assert.equal(exited,1);assert.equal(host.history.state.framework,'keep');history.dispose();
});
