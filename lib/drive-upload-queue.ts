import {uploadBatchPercent} from './drive-upload-progress.ts';
export type UploadJob={file:File;destination:{id:string;name:string};run:(progress:(value:number)=>void,signal:AbortSignal)=>Promise<unknown>};
export type UploadQueueState={total:number;completed:number;failed:number;percent:number;active:boolean;name:string};
/** New drops append to the running queue; every job captures its own destination. */
export class DriveUploadQueue{
 jobs:UploadJob[]=[];completed=0;failed=0;percent=0;running=false;controller:AbortController|null=null;
 changed:(state:UploadQueueState)=>void;failedJob:(error:unknown)=>void;finishedJob:(job:UploadJob)=>void;
 constructor(changed:(state:UploadQueueState)=>void,failedJob:(error:unknown)=>void,finishedJob:(job:UploadJob)=>void){this.changed=changed;this.failedJob=failedJob;this.finishedJob=finishedJob}
 emit(){this.changed({total:this.jobs.length,completed:this.completed,failed:this.failed,percent:uploadBatchPercent(this.jobs.map(j=>j.file.size),this.completed,this.percent),active:this.running,name:this.jobs[this.completed]?.file.name||''})}
 add(jobs:UploadJob[]){if(!jobs.length)return;if(!this.running){this.jobs=[];this.completed=0;this.failed=0;this.percent=0}this.jobs.push(...jobs);if(this.running){this.emit();return}this.running=true;this.controller=new AbortController();this.emit();void this.drain()}
 private async drain(){const controller=this.controller!;try{while(this.completed<this.jobs.length&&!controller.signal.aborted){const job=this.jobs[this.completed];try{await job.run(value=>{this.percent=value;this.emit()},controller.signal);this.finishedJob(job)}catch(error){if(controller.signal.aborted)break;this.failed++;this.failedJob(error);if((error as {status?:number}).status===401){controller.abort();break}}this.completed++;this.percent=0;this.emit()}}finally{this.running=false;this.emit()}}
 cancel(){this.controller?.abort()}
}
