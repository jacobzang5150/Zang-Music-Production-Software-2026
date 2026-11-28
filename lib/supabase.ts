import 'server-only';
import {operate,type StudioRequest} from './studio-database';
export async function callStudioDatabase(input:StudioRequest){
 if(!/^beta:[0-9a-f-]{36}$/i.test(input.owner))throw new Error('Invalid workspace');
 const secret=process.env.SUPABASE_SECRET_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!secret||!url)throw new Error('Database is not configured');
 return operate(input,secret,url);
}
