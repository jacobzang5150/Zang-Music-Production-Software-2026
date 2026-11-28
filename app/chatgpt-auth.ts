import {serverAuth} from '@/lib/rr-server';
export async function getChatGPTUser(){const db=await serverAuth();const {data:{user}}=await db.auth.getUser();if(!user?.email||!user.email_confirmed_at)return null;const {data}=await db.rpc('rr_invited');return data===true?{userId:'beta:'+user.id,id:user.id,email:user.email}:null}
