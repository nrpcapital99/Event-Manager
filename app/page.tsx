"use client";
import { useEffect,useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useSession } from '@/lib/hooks';
import { Login } from './login';
import { Workspace,PreviewData } from './workspace';
export default function Home(){
 const [dark,setDark]=useState(false),[preview,setPreview]=useState<PreviewData|undefined>();
 const {user,member,loading,error}=useSession();
 useEffect(()=>{try{setDark(localStorage.getItem('nrp-theme')==='dark');}catch{}
 if(process.env.NODE_ENV==='development'){const mode=new URLSearchParams(location.search).get('preview');if(mode==='admin'||mode==='team')import('@/lib/preview').then(m=>setPreview(m.createPreview(mode)));}},[]);
 useEffect(()=>{document.documentElement.classList.toggle('dark',dark);try{localStorage.setItem('nrp-theme',dark?'dark':'light');}catch{}},[dark]);
 const toggle=()=>setDark(v=>!v);
 return <>{preview?<Workspace member={preview.member} dark={dark} toggle={toggle} previewData={preview}/>:loading?<div className="session-loading"><span className="brand-mark">N</span><p>Opening your workspace…</p></div>:user&&member?.active?<Workspace key={user.uid} member={member} dark={dark} toggle={toggle}/>:<Login dark={dark} toggle={toggle} user={user} accessError={member&&!member.active?'Your workspace access is inactive. Contact your admin.':error}/>}<Toaster theme={dark?'dark':'light'} position="bottom-right" richColors/></>;
}

