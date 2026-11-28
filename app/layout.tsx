import type {Metadata,Viewport} from 'next';
import './globals.css';
import './appearance.css';
export const metadata:Metadata={title:'Record Room — Studio Workspace',icons:{icon:'/record-room.webp'},description:'Bring every music project across the finish line.'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#111115',interactiveWidget:'resizes-content'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
