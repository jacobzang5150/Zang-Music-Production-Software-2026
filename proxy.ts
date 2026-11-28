import {NextResponse,type NextRequest} from 'next/server';
export function proxy(req:NextRequest){if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.get('origin')!==new URL(process.env.RECORD_ROOM_ORIGIN||req.url).origin)return NextResponse.json({error:'Invalid request origin'},{status:403});const r=NextResponse.next();r.headers.set('Cache-Control','private, no-store');return r}
export const config={matcher:'/api/:path*'};
