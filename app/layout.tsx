import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Session — Studio Project Tracker',description:'Bring every music project across the finish line.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
