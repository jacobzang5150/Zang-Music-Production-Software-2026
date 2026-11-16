import {songProgress,type Project} from './projects.ts';
export type SongOrder='track'|'alphabetical'|'most-finished'|'least-finished';
export const songOrderLabels:Record<SongOrder,string>={track:'Track order',alphabetical:'Alphabetical', 'most-finished':'Most finished','least-finished':'Least finished'};
export function orderedSongs(project:Project,order:SongOrder){
 return project.songs.map((song,index)=>({song,number:index+1})).sort((a,b)=>{
  if(order==='alphabetical')return a.song.name.localeCompare(b.song.name,undefined,{sensitivity:'base',numeric:true})||a.number-b.number;
  if(order==='most-finished')return songProgress(project,b.song)-songProgress(project,a.song)||a.number-b.number;
  if(order==='least-finished')return songProgress(project,a.song)-songProgress(project,b.song)||a.number-b.number;
  return a.number-b.number;
 });
}
