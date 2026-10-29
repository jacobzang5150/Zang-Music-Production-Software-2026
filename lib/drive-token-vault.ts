const encoder=new TextEncoder();
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function key(secret:string){const bytes=decode(secret);if(bytes.length!==32)throw new Error('Invalid encryption key');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt'])}
export async function sealDriveToken(secret:string,owner:string,refreshToken:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('session-drive:'+owner)},await key(secret),encoder.encode(refreshToken));
 return 'v1.'+encode(iv)+'.'+encode(new Uint8Array(encrypted));
}
export async function openDriveToken(secret:string,owner:string,sealed:string){
 const [version,iv,cipher,...extra]=sealed.split('.');if(version!=='v1'||extra.length||!iv||!cipher)throw new Error('Invalid token envelope');
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:encoder.encode('session-drive:'+owner)},await key(secret),decode(cipher)));
}
export function validDriveMutation(request:Request,origin:string){return request.headers.get('Origin')===origin&&request.headers.get('X-Requested-With')==='XmlHttpRequest'&&request.headers.get('Content-Type')?.split(';')[0]==='application/json'}
