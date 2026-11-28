import 'server-only';
import {createBudget} from './budget';
import {BudgetModelSchema,writeBudgetModel} from './budget-model';
import {serverAuth} from './rr-server';
import {operate,type StudioRequest} from './studio-database';
export async function callStudioDatabase(input:StudioRequest){
 if(!/^beta:[0-9a-f-]{36}$/i.test(input.owner))throw new Error('Invalid workspace');
 const secret=process.env.SUPABASE_SECRET_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!secret||!url)throw new Error('Database is not configured');
 return operate(input,secret,url,async project=>{
  const budget=createBudget(project),db=await serverAuth();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user||'beta:'+user.id!==input.owner)throw Error('Studio unavailable.');
  const name=user.user_metadata.rr_default_template;
  if(typeof name!=='string'||!name)return budget;
  const {data,error}=await db.from('rr_templates').select('model').eq('owner',user.id).eq('name',name).maybeSingle();
  if(error)throw error;
  return data?writeBudgetModel(budget,BudgetModelSchema.parse(data.model)):budget
 });
}
