"use client";
import { lazy,Suspense,useEffect,useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useSession } from '@/lib/hooks';
import { Login } from './login';
import type { PreviewData } from './workspace';
// Only signed-in people reach the workspace, so its tables, sheets and editors
// stay out of the bundle that the sign-in screen needs.
const Workspace = lazy(()=>import('./workspace').then(m=>({default:m.Workspace})));
const opening = <div className="session-loading"><span className="brand-mark">N</span><p>Opening your workspace…</p></div>;
export default function Home(){
 const [dark,setDark]=useState(false),[preview,setPreview]=useState<PreviewData|undefined>();
 const {user,member,loading,error}=useSession();
 useEffect(()=>{try{setDark(localStorage.getItem('nrp-theme')==='dark');}catch{}
 if(process.env.NODE_ENV==='development'){const mode=new URLSearchParams(location.search).get('preview');if(mode==='admin'||mode==='team')import('@/lib/preview').then(m=>setPreview(m.createPreview(mode)));}},[]);
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark);try{localStorage.setItem('nrp-theme',dark?'dark':'light');}catch{}},[dark]);
 const toggle=()=>setDark(v=>!v);
 return <><Suspense fallback={opening}>{preview?<Workspace member={preview.member} dark={dark} toggle={toggle} previewData={preview}/>:loading?opening:user&&member?.active?<Workspace key={user.uid} member={member} dark={dark} toggle={toggle}/>:<Login dark={dark} toggle={toggle} user={user} accessError={member&&!member.active?'Your workspace access is inactive. Contact your admin.':error}/>}</Suspense><Toaster theme={dark?'dark':'light'} position="bottom-right" richColors/></>;
}

