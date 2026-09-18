import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DomainError, requireAdmin, text, date, choice, taskDraft, updateProgress, expenseAmount, attendanceCount } from './domain.js';
initializeApp();
const db=getFirestore(), auth=getAuth();
const c=(name)=>db.collection('nrp_'+name);
const now=()=>new Date().toISOString();
function id(value){if(typeof value!=='string'||!value||value.includes('/')||value.length>128)throw new DomainError('Invalid record identifier.');return value;}
async function existing(name,key){const doc=await c(name).doc(id(key)).get();if(!doc.exists)throw new DomainError('Record not found.','not-found');return {id:doc.id,...doc.data()};}
function log(tx,ref,member,action,details,at){tx.set(ref.collection('activity').doc(),{actorId:member.id,actorName:member.name,action,details,at});}
async function run(request){
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in to continue.');
 const uid=request.auth.uid, d=request.data||{}, at=now();
 if(d.action==='bootstrapAdmin'){
  const u=await auth.getUser(uid);
  if(u.email?.toLowerCase()!=='nrpcapital99@gmail.com'||!u.emailVerified||u.disabled)throw new HttpsError('permission-denied','Verify the designated admin email before activating the workspace.');
  await db.runTransaction(async tx=>{const ref=c('members').doc(uid), old=await tx.get(ref);if(old.exists)return;const lock=db.doc('nrp_settings/bootstrap'),initialized=await tx.get(lock);if(initialized.exists)throw new HttpsError('failed-precondition','An admin has already activated this workspace.');tx.set(ref,{name:'NRP Admin',email:u.email.toLowerCase(),role:'admin',active:true,department:'Administration',createdAt:at});tx.set(lock,{uid,at});});return {ok:true};
 }
 const member=await existing('members',uid);if(!member.active)throw new HttpsError('permission-denied','Your workspace access is inactive.');
 if(d.action==='saveTask'){
  if(d.id)requireAdmin(member);
  if(!Array.isArray(d.assigneeIds)||d.assigneeIds.length>30)throw new DomainError('Choose up to 30 assignees.');
  const people=Object.fromEntries(await Promise.all(d.assigneeIds.map(async uid=>[id(uid),await existing('members',uid)])));
  if(d.kind!=='office')await existing('events',d.eventId);
  const ref=d.id?c('tasks').doc(id(d.id)):c('tasks').doc();
  await db.runTransaction(async tx=>{const old=await tx.get(ref);if(d.id&&!old.exists)throw new DomainError('Task not found.','not-found');const before=old.data(),draft=taskDraft(d,member,before,people,at);tx.set(ref,draft);log(tx,ref,member,old.exists?'Task updated':'Task created',old.exists?JSON.stringify({before:{title:before.title,deadline:before.deadline,start:before.start,assigneeNames:before.assigneeNames,priority:before.priority,description:before.description},after:{title:draft.title,deadline:draft.deadline,start:draft.start,assigneeNames:draft.assigneeNames,priority:draft.priority,description:draft.description}}):`Assigned to ${Object.values(draft.assigneeNames).join(', ')}. Due ${draft.deadline}.`,at);});return {id:ref.id};
 }
 if(d.action==='progress'||d.action==='comment'){
  const ref=c('tasks').doc(id(d.id));await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new DomainError('Task not found.','not-found');const task=snap.data();if(member.role!=='admin'&&!task.assigneeIds.includes(uid))throw new HttpsError('permission-denied','This task is not assigned to you.');if(d.action==='progress'){const change=updateProgress(task,uid,d.status,at);tx.update(ref,change);log(tx,ref,member,'Status updated',`${task.progress[uid]?.status||'To do'} → ${d.status}`,at);}else log(tx,ref,member,'Update posted',text(d.text,'Update',4000),at);});return {ok:true};
 }
 if(d.action==='saveEvent'){
  requireAdmin(member);const start=date(d.date,'Event date'),end=date(d.endDate||d.date,'End date');if(end<start)throw new DomainError('Event end must follow its start.');
  const ref=d.id?c('events').doc(id(d.id)):c('events').doc();
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(d.id&&!snap.exists)throw new DomainError('Event not found.');tx.set(ref,{title:text(d.title,'Event title',160),date:start,endDate:end,location:text(d.location||'','Location',300,false),type:text(d.type||'Event','Type',60),description:text(d.description||'','Description',5000,false),status:choice(d.status,['Planning','Live','Complete'],'event status'),createdAt:snap.data()?.createdAt||at,updatedAt:at});log(tx,ref,member,snap.exists?'Event updated':'Event created',d.title,at);});return {id:ref.id};
 }
 if(d.action==='addMember'){
  requireAdmin(member);const email=text(d.email,'Email',254).toLowerCase(),name=text(d.name,'Name',100);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new DomainError('Enter a valid email address.');
  const password=text(d.password,'Temporary password',128);if(password.length<12)throw new DomainError('Temporary passwords need at least 12 characters.');
  const user=await auth.createUser({email,password,displayName:name});
  try{await c('members').doc(user.uid).set({name,email,role:'team',active:true,department:text(d.department||'','Department',100,false),createdAt:at});}catch(e){await auth.deleteUser(user.uid);throw e;}
  return {id:user.uid};
 }
 if(d.action==='setMemberActive'){
  requireAdmin(member);if(d.id===uid)throw new DomainError('You cannot deactivate your own admin account.');const target=await existing('members',d.id);if(target.role==='admin')throw new DomainError('Admin access cannot be changed here.');if(typeof d.active!=='boolean')throw new DomainError('Invalid access state.');
  await c('members').doc(target.id).update({active:d.active,updatedAt:at});await auth.updateUser(target.id,{disabled:!d.active});if(!d.active)await auth.revokeRefreshTokens(target.id);return {ok:true};
 }
 if(d.action==='saveClient'){
  if(d.id){requireAdmin(member);await existing('clients',d.id);}
  const ref=d.id?c('clients').doc(id(d.id)):c('clients').doc();const values={name:text(d.name,'Client name',160),company:text(d.company||'','Company',200,false),email:text(d.email||'','Email',254,false),phone:text(d.phone||'','Phone',40,false),updatedAt:at};if(values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))throw new DomainError('Enter a valid email address.');await ref.set({...values,...(!d.id?{createdAt:at,createdBy:uid}:{})},{merge:true});return {id:ref.id};
 }
 if(d.action==='saveGuest'){
  await existing('events',d.eventId);await existing('clients',d.clientId);const eventId=id(d.eventId),clientId=id(d.clientId),ref=c('guests').doc(`${eventId}_${clientId}`);
  await db.runTransaction(async tx=>{const old=await tx.get(ref),v=old.data()||{invited:false,rsvp:'Pending',attendance:0,walkIn:false,attendedAt:null};const count=d.attendance===undefined?v.attendance:attendanceCount(d.attendance);if(d.invited!==undefined&&typeof d.invited!=='boolean')throw new DomainError('Invalid invitation flag.');const invited=d.invited??v.invited;
  const next={eventId,clientId,invited,rsvp:d.rsvp===undefined?v.rsvp:choice(d.rsvp,['Pending','Yes','No','Maybe'],'RSVP'),attendance:count,walkIn:v.walkIn||(!old.exists&&count>0&&!invited),attendedAt:count>0?(v.attendedAt||at):null,updatedAt:at,updatedBy:uid};tx.set(ref,next);log(tx,ref,member,old.exists?'Guest updated':'Guest added',JSON.stringify({before:v,after:next}),at);});return {id:ref.id};
 }
 if(d.action==='addExpense'){
  if(d.eventId)await existing('events',d.eventId);const ref=c('expenses').doc();await ref.set({eventId:d.eventId||'',description:text(d.description,'Description',500),amountPaise:expenseAmount(d.amountPaise),date:date(d.date,'Expense date'),category:choice(d.category,['Travel','Food & beverage','Supplies','Venue','Other'],'category'),paidBy:uid,paidByName:member.name,createdAt:at});return {id:ref.id};
 }
 if(d.action==='addReview'){
  await existing('events',d.eventId);const ref=c('reviews').doc();await ref.set({eventId:id(d.eventId),kind:choice(d.kind,['Hit','Miss'],'review type'),text:text(d.text,'Review',4000),authorId:uid,authorName:member.name,createdAt:at});return {id:ref.id};
 }
 throw new DomainError('Unknown action.');
}
export const workspace=onCall({region:'asia-south1',maxInstances:10,timeoutSeconds:60,memory:'256MiB'},async request=>{try{return await run(request);}catch(e){if(e instanceof HttpsError)throw e;if(e instanceof DomainError)throw new HttpsError(e.code,e.message);if(e.code==='auth/email-already-exists')throw new HttpsError('already-exists','This email already has an account.');console.error('Workspace request failed',{action:request.data?.action,code:e.code,message:e.message});throw new HttpsError('internal','The request could not be completed. Please try again.');}});
