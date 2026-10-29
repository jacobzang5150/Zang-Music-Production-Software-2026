'use client';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive';
export type DriveConfig={clientId:string;apiKey:string;appId:string;rememberConnection?:boolean};
type TokenResponse={access_token?:string;expires_in?:number;scope?:string;error?:string;error_description?:string};
type CodeResponse={code?:string;error?:string;error_description?:string};
type CodeOptions={client_id:string;scope:string;ux_mode:'popup';include_granted_scopes:boolean;select_account:boolean;callback:(r:CodeResponse)=>void;error_callback:(e:{type:string})=>void};
type TokenClient={requestAccessToken:(options:{prompt:string})=>void};
type PickerDoc={id:string;name?:string;url?:string;resourceKey?:string};
type PickerResult={action:string;docs?:PickerDoc[]};
type Picker={setVisible:(visible:boolean)=>void;dispose:()=>void};
// SDK boundaries; these objects are supplied by Google's own scripts.
type PickerView={setIncludeFolders:(v:boolean)=>PickerView;setSelectFolderEnabled:(v:boolean)=>PickerView;setParent:(id:string)=>PickerView};
type PickerBuilder={setDeveloperKey:(v:string)=>PickerBuilder;setAppId:(v:string)=>PickerBuilder;setOAuthToken:(v:string)=>PickerBuilder;setOrigin:(v:string)=>PickerBuilder;setTitle:(v:string)=>PickerBuilder;addView:(v:PickerView)=>PickerBuilder;setCallback:(v:(r:PickerResult)=>void)=>PickerBuilder;build:()=>Picker};
type GoogleSdk={accounts:{oauth2:{initCodeClient:(options:CodeOptions)=>{requestCode:()=>void};initTokenClient:(options:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(r:TokenResponse)=>void;error_callback:(e:{type:string})=>void})=>TokenClient}},picker?:{DocsView:new(id:string)=>PickerView;ViewId:{FOLDERS:string};PickerBuilder:new()=>PickerBuilder;Action:{PICKED:string;CANCEL:string}}};
declare global{interface Window{google?:GoogleSdk;gapi?:{load:(name:string,options:{callback:()=>void;onerror:()=>void;timeout:number;ontimeout:()=>void})=>void}}}
let configPromise:Promise<DriveConfig>|null=null;
let identityPromise:Promise<void>|null=null;
let pickerPromise:Promise<void>|null=null;
let session:{token:string;expiresAt:number}|null=null;
export function currentDriveToken(){if(!session||Date.now()>=session.expiresAt){session=null;return null}return session.token}
let restorePromise:Promise<string|null>|null=null;
let generation=0;
export function forgetDriveToken(){generation++;session=null;window.dispatchEvent(new Event('session-drive-auth'))}
function rememberSession(token:string,expiresIn:number){session={token,expiresAt:Date.now()+Math.max(0,expiresIn-120)*1000};window.dispatchEvent(new Event('session-drive-auth'));return token}
export async function restoreDriveConnection():Promise<string|null>{
 const current=currentDriveToken();if(current)return current;if(restorePromise)return restorePromise;
 const started=generation;
 restorePromise=(async()=>{
  const r=await fetch('/api/drive/session',{cache:'no-store'});const data=await r.json() as {connected?:boolean;accessToken?:string;expiresIn?:number};
  if(started!==generation)return currentDriveToken();
  if(r.ok&&data.connected&&data.accessToken)return rememberSession(data.accessToken,data.expiresIn||3600);
  if(r.ok||r.status===401)window.dispatchEvent(new Event('session-drive-auth'));
  return null;
 })().catch(()=>null).finally(()=>{restorePromise=null});return restorePromise;
}
export async function disconnectDrive(){
 const r=await fetch('/api/drive/session',{method:'DELETE',headers:{'Content-Type':'application/json','X-Requested-With':'XmlHttpRequest'}});
 if(!r.ok)throw new Error('Could not forget the saved Drive connection. Please retry.');forgetDriveToken();
}
export function keepDriveConnected(){
 void restoreDriveConnection();const timer=setInterval(()=>{void restoreDriveConnection()},60000);
 const visible=()=>{if(document.visibilityState==='visible')void restoreDriveConnection()};document.addEventListener('visibilitychange',visible);
 return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
}
function loadScript(src:string){return new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;const timer=setTimeout(()=>{script.remove();reject(new Error('Google took too long to load. Check your connection and retry.'))},20000);script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Could not load Google. Check your connection or browser content blocker.'))};document.head.appendChild(script)})}
export async function prepareDrive(){
 if(!configPromise)configPromise=fetch('/api/drive/config',{cache:'no-store'}).then(async r=>{const data=await r.json() as DriveConfig&{error?:string};if(!r.ok)throw new Error(data.error||'Drive is unavailable');return data as DriveConfig}).catch(e=>{configPromise=null;throw e});
 if(!identityPromise)identityPromise=(window.google?.accounts?Promise.resolve():loadScript('https://accounts.google.com/gsi/client')).catch(e=>{identityPromise=null;throw e});
 const [config]=await Promise.all([configPromise,identityPromise]);return config;
}
/** Called directly from a click so Google's authorization popup isn't blocked. */
export function connectDrive(config:DriveConfig):Promise<string>{
 return new Promise((resolve,reject)=>{
  if(!window.google?.accounts) return reject(new Error('Google sign-in has not finished loading.'));
  if(config.rememberConnection){
   generation++;
   const client=window.google.accounts.oauth2.initCodeClient({client_id:config.clientId,scope:DRIVE_SCOPE,ux_mode:'popup',include_granted_scopes:false,select_account:false,
    callback:async r=>{
     if(r.error||!r.code){reject(new Error(r.error_description||'Google authorization was not completed.'));return}
     try{
      const response=await fetch('/api/drive/session',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XmlHttpRequest'},body:JSON.stringify({code:r.code})});
      const result=await response.json() as {accessToken?:string;expiresIn?:number;error?:string};
      if(!response.ok||!result.accessToken)throw new Error(result.error||'Could not remember this Drive connection.');
      resolve(rememberSession(result.accessToken,result.expiresIn||3600));
     }catch(e){reject(e)}
    },error_callback:e=>reject(new Error(e.type==='popup_closed'?'Google sign-in was closed.':'Allow popups for Session, then try connecting again.'))});
   client.requestCode();return;
  }
  const client=window.google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:DRIVE_SCOPE,include_granted_scopes:false,callback:r=>{
   if(r.error||!r.access_token)return reject(new Error(r.error_description||r.error||'Google authorization was not completed.'));
   if(!r.scope?.split(' ').includes(DRIVE_SCOPE))return reject(new Error('Drive access was not granted. Reconnect and allow access to manage your files.'));
   session={token:r.access_token,expiresAt:Date.now()+Math.max(0,(r.expires_in||3600)-60)*1000};window.dispatchEvent(new Event('session-drive-auth'));resolve(r.access_token);
  },error_callback:e=>reject(new Error(e.type==='popup_closed'?'Google sign-in was closed.':e.type==='popup_failed_to_open'?'Allow popups for Session, then try Connect Google Drive again.':'Google sign-in could not open.'))});
  client.requestAccessToken({prompt:'select_account'});
 });
}
export async function pickDriveFolder(config:DriveConfig,token:string,parent?:string):Promise<PickerDoc|null>{
 if(!pickerPromise)pickerPromise=(async()=>{
  if(!window.gapi)await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve,reject)=>{
   window.gapi!.load('picker',{callback:resolve,onerror:()=>reject(new Error('Could not load the Google folder picker.')),timeout:20000,ontimeout:()=>reject(new Error('The Google folder picker timed out.'))});
  });
 })().catch(e=>{pickerPromise=null;throw e});
 await pickerPromise;
 return new Promise((resolve,reject)=>{
  const sdk=window.google?.picker;if(!sdk)return reject(new Error('The Google folder picker is unavailable.'));
  let picker:Picker;
  const view=new sdk.DocsView(sdk.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);if(parent)view.setParent(parent);
  picker=new sdk.PickerBuilder().setDeveloperKey(config.apiKey).setAppId(config.appId).setOAuthToken(token).setOrigin(window.location.origin).setTitle('Choose the project deliverables folder').addView(view).setCallback(data=>{if(data.action===sdk.Action.PICKED||data.action===sdk.Action.CANCEL){picker.dispose();resolve(data.docs?.[0]||null)}}).build();
  picker.setVisible(true);
 });
}
