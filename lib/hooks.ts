"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where, QueryConstraint } from 'firebase/firestore';
import { auth, db, friendlyError } from './firebase';
import { Member } from './model';
export function useSession(){
 const [user,setUser]=useState<User|null>(null),[member,setMember]=useState<Member|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>onAuthStateChanged(auth,u=>{setMember(null);setUser(u);setError('');setLoading(!!u);}),[]);
 useEffect(()=>{if(!user)return;return onSnapshot(doc(db,'nrp_members',user.uid),snap=>{setMember(snap.exists()?{id:snap.id,...snap.data()} as Member:null);setLoading(false);},e=>{setError(friendlyError(e));setLoading(false);});},[user]);
 return {user,member,loading,error};
}
export function useRecords<T>(name:string,enabled:boolean,filterField='',filterValue=''){
 const [data,setData]=useState<T[]>([]),[loading,setLoading]=useState(enabled),[error,setError]=useState('');
 useEffect(()=>{setData([]);setError('');setLoading(enabled);if(!enabled)return;
 const constraints:QueryConstraint[]=filterField?[where(filterField,filterField==='assigneeIds'?'array-contains':'==',filterValue)]:[];
 return onSnapshot(query(collection(db,name),...constraints),snap=>{setData(snap.docs.map(d=>({id:d.id,...d.data()} as T)));setLoading(false);setError('');},e=>{setError(friendlyError(e));setLoading(false);setData([]);});
 },[name,enabled,filterField,filterValue]);return {data,loading,error};
}

