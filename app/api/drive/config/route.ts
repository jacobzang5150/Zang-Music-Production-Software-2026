import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
export async function GET(){
 if(!await getChatGPTUser())return Response.json({error:'Sign in to Session first.'},{status:401});
 const {GOOGLE_DRIVE_CLIENT_ID:clientId,GOOGLE_PICKER_API_KEY:apiKey,GOOGLE_DRIVE_APP_ID:appId}=env;
 if(!clientId||!apiKey||!appId)return Response.json({error:'Google Drive is not configured yet.'},{status:503});
 // These are public browser identifiers, not an OAuth client secret or access token.
 return Response.json({clientId,apiKey,appId},{headers:{'Cache-Control':'private, no-store'}});
}
