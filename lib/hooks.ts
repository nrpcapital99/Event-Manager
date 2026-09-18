"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, friendlyError } from './firebase';
import { Member } from './model';
// Firestore is only read once someone is signed in, so it loads on demand
// rather than in the bundle the sign-in screen needs.
const firestore = () => Promise.all([import('firebase/firestore'), import('./firestore')]);
export function useSession(){
 const [user,setUser]=useState<User|null>(null),[member,setMember]=useState<Member|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>onAuthStateChanged(auth,u=>{setMember(null);setUser(u);setError('');setLoading(!!u);}),[]);
 useEffect(()=>{if(!user)return;
 let stop:(()=>void)|undefined,cancelled=false;
 firestore().then(([{doc,onSnapshot},{db}])=>{if(cancelled)return;
  stop=onSnapshot(doc(db,'nrp_members',user.uid),snap=>{setMember(snap.exists()?{id:snap.id,...snap.data()} as Member:null);setLoading(false);},e=>{setError(friendlyError(e));setLoading(false);});
 }).catch(e=>{if(!cancelled){setError(friendlyError(e));setLoading(false);}});
 return ()=>{cancelled=true;stop?.();};},[user]);
 return {user,member,loading,error};
}
export function useRecords<T>(name:string,enabled:boolean,filterField='',filterValue=''){
 const [data,setData]=useState<T[]>([]),[loading,setLoading]=useState(enabled),[error,setError]=useState('');
 useEffect(()=>{setData([]);setError('');setLoading(enabled);if(!enabled)return;
 let stop:(()=>void)|undefined,cancelled=false;
 firestore().then(([{collection,onSnapshot,query,where},{db}])=>{if(cancelled)return;
  const constraints=filterField?[where(filterField,filterField==='assigneeIds'?'array-contains':'==',filterValue)]:[];
  stop=onSnapshot(query(collection(db,name),...constraints),snap=>{setData(snap.docs.map(d=>({id:d.id,...d.data()} as T)));setLoading(false);setError('');},e=>{setError(friendlyError(e));setLoading(false);setData([]);});
 }).catch(e=>{if(!cancelled){setError(friendlyError(e));setLoading(false);setData([]);}});
 return ()=>{cancelled=true;stop?.();};
 },[name,enabled,filterField,filterValue]);return {data,loading,error};
}
