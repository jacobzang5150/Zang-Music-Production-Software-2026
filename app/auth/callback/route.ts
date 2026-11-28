import {serverAuth} from '@/lib/rr-server';
import {NextResponse} from 'next/server';
export async function GET(req:Request){const u=new URL(req.url),dest=new URL('/',req.url),code=u.searchParams.get('code');if(!code||(await (await serverAuth()).auth.exchangeCodeForSession(code)).error)dest.searchParams.set('auth_error','1');return NextResponse.redirect(dest)}
