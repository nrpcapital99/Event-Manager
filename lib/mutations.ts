import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, firebaseConfig } from './firebase';
import { db } from './firestore';
import type { Member, PersonProgress, Task } from './model';

type Data = Record<string, unknown>;
const now = () => new Date().toISOString();
const uid = () => { if (!auth.currentUser) throw new Error('Sign in to continue.'); return auth.currentUser.uid; };
const text = (value: unknown, label: string, max = 500, required = true) => { if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label} is required and must be under ${max} characters.`); return value.trim(); };
const date = (value: unknown, label: string) => { const result = text(value, label, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result))) throw new Error(`${label} must be a valid date.`); return result; };
const choice = <T extends string>(value: unknown, choices: readonly T[], label: string): T => { if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; };
const recordId = (value: unknown) => { if (typeof value !== 'string' || !value || value.includes('/') || value.length > 128) throw new Error('Invalid record identifier.'); return value; };
const member = async () => { const id = uid(), snap = await getDoc(doc(db, 'nrp_members', id)); if (!snap.exists() || snap.data().active !== true) throw new Error('Workspace access is inactive.'); return { id, ...snap.data() } as Member; };
const overall = (ids: string[], progress: Record<string, PersonProgress>) => { const statuses = ids.map(id => progress[id]?.status || 'To do'); return statuses.every(status => status === 'Complete') ? 'Complete' : statuses.includes('Blocked') ? 'Blocked' : statuses.some(status => status === 'In progress' || status === 'Complete') ? 'In progress' : 'To do'; };
const log = (taskRef: ReturnType<typeof doc>, actor: Member, action: string, details: string, at: string) => ({ ref: doc(collection(taskRef, 'activity')), data: { actorId: actor.id, actorName: actor.name, action, details, at } });

async function bootstrapAdmin() {
  const user = auth.currentUser;
  if (!user || user.email?.toLowerCase() !== 'nrpcapital99@gmail.com') throw new Error('Only the designated admin email can initialize this workspace.');
  const memberRef = doc(db, 'nrp_members', user.uid), existing = await getDoc(memberRef);
  if (existing.exists()) return { ok: true };
  const at = now(), batch = writeBatch(db);
  batch.set(memberRef, { name: 'NRP Admin', email: user.email.toLowerCase(), role: 'admin', active: true, department: 'Administration', createdAt: at });
  batch.set(doc(db, 'nrp_settings', 'bootstrap'), { uid: user.uid, at });
  await batch.commit();
  return { ok: true };
}

async function saveTask(data: Data) {
  const actor = await member(), at = now(), id = data.id ? recordId(data.id) : '', taskRef = id ? doc(db, 'nrp_tasks', id) : doc(collection(db, 'nrp_tasks'));
  const assigneeIds = Array.isArray(data.assigneeIds) ? [...new Set(data.assigneeIds.filter((value): value is string => typeof value === 'string'))] : [];
  if (!assigneeIds.length || assigneeIds.length > 30) throw new Error('Assign 1–30 people.');
  const peopleDocs = await Promise.all(assigneeIds.map(personId => getDoc(doc(db, 'nrp_members', personId))));
  const people = Object.fromEntries(peopleDocs.map((snap, index) => [assigneeIds[index], snap.exists() ? snap.data() as Member : null]));
  if (Object.values(people).some(person => !person?.active)) throw new Error('Choose active team members.');
  const kind = choice(data.kind, ['office', 'event', 'responsibility'] as const, 'task type');
  if (actor.role !== 'admin' && (kind !== 'office' || assigneeIds.length !== 1 || assigneeIds[0] !== actor.id || id)) throw new Error('You can only create office tasks for yourself.');
  const start = date(data.start, 'Start date'), deadline = date(data.deadline, 'Deadline');
  if (start > deadline) throw new Error('Deadline must be on or after the start date.');
  await runTransaction(db, async transaction => {
    const oldSnap = await transaction.get(taskRef), old = oldSnap.exists() ? oldSnap.data() as Task : undefined;
    if (id && !old) throw new Error('Task not found.');
    if (old && actor.role !== 'admin') throw new Error('Only admins can edit tasks.');
    const progress: Record<string, PersonProgress> = Object.fromEntries(assigneeIds.map(personId => [personId, old?.progress[personId] || { status: 'To do' as const, updatedAt: at, completedAt: null }]));
    const draft = { title: text(data.title, 'Task title', 160), description: text(data.description || '', 'Description', 5000, false), kind, eventId: kind === 'office' ? '' : recordId(data.eventId), start, deadline, originalDeadline: old?.originalDeadline || deadline, priority: choice(data.priority, ['Low', 'Medium', 'High'] as const, 'priority'), assigneeIds, assigneeNames: Object.fromEntries(assigneeIds.map(personId => [personId, people[personId]!.name])), progress, status: overall(assigneeIds, progress), createdBy: old?.createdBy || actor.id, createdAt: old?.createdAt || at, updatedAt: at, completedAt: old?.completedAt || null };
    transaction.set(taskRef, draft);
    const activity = log(taskRef, actor, old ? 'Task updated' : 'Task created', old ? 'Task details saved.' : `Assigned to ${Object.values(draft.assigneeNames).join(', ')}. Due ${deadline}.`, at);
    transaction.set(activity.ref, activity.data);
  });
  return { id: taskRef.id };
}

async function updateProgress(data: Data) {
  const actor = await member(), taskRef = doc(db, 'nrp_tasks', recordId(data.id)), at = now(), nextStatus = choice(data.status, ['To do', 'In progress', 'Blocked', 'Complete'] as const, 'status');
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(taskRef); if (!snap.exists()) throw new Error('Task not found.');
    const task = snap.data() as Task; if (!task.assigneeIds.includes(actor.id)) throw new Error('This task is not assigned to you.');
    const before = task.progress[actor.id]?.status || 'To do';
    const progress = { ...task.progress, [actor.id]: { status: nextStatus, updatedAt: at, completedAt: nextStatus === 'Complete' ? at : null } }, status = overall(task.assigneeIds, progress);
    transaction.update(taskRef, { progress, status, updatedAt: at, completedAt: status === 'Complete' ? at : null });
    const activity = log(taskRef, actor, 'Status updated', `${before} → ${nextStatus}`, at); transaction.set(activity.ref, activity.data);
  });
  return { ok: true };
}

async function completeTask(data: Data) {
  const actor = await member(); if (actor.role !== 'admin') throw new Error('Only admins can complete a task for the team.');
  const taskRef = doc(db, 'nrp_tasks', recordId(data.id)), at = now();
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(taskRef); if (!snap.exists()) throw new Error('Task not found.');
    const task = snap.data() as Task;
    const progress = Object.fromEntries(task.assigneeIds.map(personId => [personId, { status: 'Complete', updatedAt: at, completedAt: at }]));
    transaction.update(taskRef, { progress, status: 'Complete', updatedAt: at, completedAt: at });
    const activity = log(taskRef, actor, 'Task completed', 'Marked complete from the admin control board.', at); transaction.set(activity.ref, activity.data);
  });
  return { ok: true };
}

async function removeTask(data: Data) {
  const actor = await member(); if (actor.role !== 'admin') throw new Error('Only admins can remove tasks.');
  const taskRef = doc(db, 'nrp_tasks', recordId(data.id)), snap = await getDoc(taskRef); if (!snap.exists()) throw new Error('Task not found.');
  await deleteDoc(taskRef); return { ok: true };
}

async function comment(data: Data) {
  const actor = await member(), taskRef = doc(db, 'nrp_tasks', recordId(data.id)), task = await getDoc(taskRef);
  if (!task.exists() || (actor.role !== 'admin' && !(task.data().assigneeIds as string[]).includes(actor.id))) throw new Error('This task is not available to you.');
  await addDoc(collection(taskRef, 'activity'), { actorId: actor.id, actorName: actor.name, action: 'Update posted', details: text(data.text, 'Update', 4000), at: now() });
  return { ok: true };
}

async function saveEvent(data: Data) {
  const actor = await member(); if (actor.role !== 'admin') throw new Error('Only admins can manage events.');
  const at = now(), start = date(data.date, 'Event date'), end = date(data.endDate || data.date, 'End date'); if (end < start) throw new Error('Event end must follow its start.');
  const eventRef = data.id ? doc(db, 'nrp_events', recordId(data.id)) : doc(collection(db, 'nrp_events')), old = await getDoc(eventRef);
  await setDoc(eventRef, { title: text(data.title, 'Event title', 160), date: start, endDate: end, location: text(data.location || '', 'Location', 300, false), type: text(data.type || 'Event', 'Type', 60), description: text(data.description || '', 'Description', 5000, false), status: choice(data.status, ['Planning', 'Live', 'Complete'] as const, 'event status'), createdAt: old.data()?.createdAt || at, updatedAt: at });
  return { id: eventRef.id };
}

async function addMember(data: Data) {
  const actor = await member(); if (actor.role !== 'admin') throw new Error('Only admins can add team members.');
  const email = text(data.email, 'Email', 254).toLowerCase(), name = text(data.name, 'Name', 100), password = text(data.password, 'Temporary password', 128), role = choice(data.role, ['admin', 'team'] as const, 'access level'); if (password.length < 12) throw new Error('Temporary passwords need at least 12 characters.');
  const secondary = initializeApp(firebaseConfig, 'member-' + Date.now()), secondaryAuth = getAuth(secondary);
  try { const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password); try { await setDoc(doc(db, 'nrp_members', credential.user.uid), { name, email, role, active: true, department: role === 'admin' ? 'Administration' : text(data.department || '', 'Department', 100, false), employeeType: role === 'team' ? choice(data.employeeType, ['frontend', 'backend'] as const, 'employee team') : '', createdAt: now() }); } catch (error) { await deleteUser(credential.user); throw error; } return { id: credential.user.uid }; } finally { await deleteApp(secondary); }
}

async function setMemberActive(data: Data) {
  const actor = await member(), targetId = recordId(data.id); if (actor.role !== 'admin' || targetId === actor.id || typeof data.active !== 'boolean') throw new Error('This access change is not allowed.');
  await updateDoc(doc(db, 'nrp_members', targetId), { active: data.active, updatedAt: now() }); return { ok: true };
}

async function saveClient(data: Data) {
  const actor = await member(), ref = data.id ? doc(db, 'nrp_clients', recordId(data.id)) : doc(collection(db, 'nrp_clients')); if (data.id && actor.role !== 'admin') throw new Error('Only admins can edit clients.');
  const email = text(data.email || '', 'Email', 254, false); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  await setDoc(ref, { name: text(data.name, 'Client name', 160), company: text(data.company || '', 'Company', 200, false), email, phone: text(data.phone || '', 'Phone', 40, false), updatedAt: now(), ...(!data.id ? { createdAt: now(), createdBy: actor.id } : {}) }, { merge: true }); return { id: ref.id };
}

async function saveGuest(data: Data) {
  const actor = await member(), eventId = recordId(data.eventId), clientId = recordId(data.clientId), ref = doc(db, 'nrp_guests', `${eventId}_${clientId}`), at = now();
  const attendance = Number(data.attendance); if (!Number.isSafeInteger(attendance) || attendance < 0 || attendance > 1000) throw new Error('Attendance must be from 0 to 1,000.');
  await runTransaction(db, async transaction => { const old = (await transaction.get(ref)).data() || { walkIn: false, attendedAt: null }; const invited = Boolean(data.invited); transaction.set(ref, { eventId, clientId, invited, rsvp: choice(data.rsvp, ['Pending', 'Yes', 'No', 'Maybe'] as const, 'RSVP'), attendance, walkIn: old.walkIn || (attendance > 0 && !invited), attendedAt: attendance > 0 ? old.attendedAt || at : null, updatedAt: at, updatedBy: actor.id }); });
  return { id: ref.id };
}

async function addExpense(data: Data) {
  const actor = await member(), amountPaise = Number(data.amountPaise); if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > 1000000000) throw new Error('Enter a valid amount.');
  const ref = doc(collection(db, 'nrp_expenses')); await setDoc(ref, { eventId: data.eventId ? recordId(data.eventId) : '', description: text(data.description, 'Description', 500), amountPaise, date: date(data.date, 'Expense date'), category: choice(data.category, ['Travel', 'Food & beverage', 'Supplies', 'Venue', 'Other'] as const, 'category'), paidBy: actor.id, paidByName: actor.name, createdAt: now() }); return { id: ref.id };
}

async function addReview(data: Data) {
  const actor = await member(), ref = doc(collection(db, 'nrp_reviews')); await setDoc(ref, { eventId: recordId(data.eventId), kind: choice(data.kind, ['Hit', 'Miss'] as const, 'review type'), text: text(data.text, 'Review', 4000), authorId: actor.id, authorName: actor.name, createdAt: now() }); return { id: ref.id };
}

export async function mutateFirestore(action: string, data: Data) {
  if (action === 'bootstrapAdmin') return bootstrapAdmin();
  if (action === 'saveTask') return saveTask(data);
  if (action === 'progress') return updateProgress(data);
  if (action === 'completeTask') return completeTask(data);
  if (action === 'removeTask') return removeTask(data);
  if (action === 'comment') return comment(data);
  if (action === 'saveEvent') return saveEvent(data);
  if (action === 'addMember') return addMember(data);
  if (action === 'setMemberActive') return setMemberActive(data);
  if (action === 'saveClient') return saveClient(data);
  if (action === 'saveGuest') return saveGuest(data);
  if (action === 'addExpense') return addExpense(data);
  if (action === 'addReview') return addReview(data);
  throw new Error('Unknown action.');
}
