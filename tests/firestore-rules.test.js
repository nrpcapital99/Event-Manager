// Firestore rules tests. These run against the emulator, not the real project:
//   npm run test:rules
// The emulator needs Java; see README "Validate and build".
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const ADMIN = 'admin1', EMPLOYEE = 'emp1', COLLEAGUE = 'emp2', INACTIVE = 'gone', STRANGER = 'nobody';
let env;

// Signed in and an active member, signed in but unknown, or not signed in at all.
const as = uid => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'nrp-rules-test',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const member = (id, role, active) => setDoc(doc(db, 'nrp_members', id), { name: id, email: id + '@example.test', role, active, department: '' });
    await member(ADMIN, 'admin', true);
    await member(EMPLOYEE, 'team', true);
    await member(COLLEAGUE, 'team', true);
    await member(INACTIVE, 'team', false);
    await setDoc(doc(db, 'nrp_tasks', 'mine'), { title: 'Mine', assigneeIds: [EMPLOYEE] });
    await setDoc(doc(db, 'nrp_tasks', 'theirs'), { title: 'Theirs', assigneeIds: [COLLEAGUE] });
    await setDoc(doc(db, 'nrp_tasks', 'mine', 'activity', 'a1'), { action: 'Task created' });
    await setDoc(doc(db, 'nrp_tasks', 'theirs', 'activity', 'a1'), { action: 'Task created' });
    await setDoc(doc(db, 'nrp_events', 'e1'), { title: 'Investor Connect' });
    await setDoc(doc(db, 'nrp_events', 'e1', 'activity', 'a1'), { action: 'Event created' });
    await setDoc(doc(db, 'nrp_clients', 'c1'), { name: 'Aarav Desai' });
    await setDoc(doc(db, 'nrp_guests', 'e1_c1'), { eventId: 'e1', clientId: 'c1' });
    await setDoc(doc(db, 'nrp_expenses', 'x1'), { description: 'Travel', paidBy: EMPLOYEE, amountPaise: 1000 });
    await setDoc(doc(db, 'nrp_expenses', 'x2'), { description: 'Venue', paidBy: COLLEAGUE, amountPaise: 2000 });
    await setDoc(doc(db, 'nrp_reviews', 'r1'), { kind: 'Hit', text: 'Went well' });
  });
});

after(async () => { await env?.cleanup(); });

describe('who counts as a member', () => {
  it('shuts out visitors who are not signed in', async () => {
    const db = anonymous();
    await assertFails(getDoc(doc(db, 'nrp_events', 'e1')));
    await assertFails(getDoc(doc(db, 'nrp_clients', 'c1')));
    await assertFails(getDoc(doc(db, 'nrp_tasks', 'mine')));
  });

  it('shuts out a signed-in account with no member record', async () => {
    const db = as(STRANGER);
    await assertFails(getDoc(doc(db, 'nrp_events', 'e1')));
    await assertFails(getDoc(doc(db, 'nrp_clients', 'c1')));
    await assertFails(getDoc(doc(db, 'nrp_reviews', 'r1')));
  });

  it('shuts out a deactivated member but keeps their own record readable', async () => {
    const db = as(INACTIVE);
    await assertFails(getDoc(doc(db, 'nrp_events', 'e1')));
    await assertFails(getDoc(doc(db, 'nrp_clients', 'c1')));
    // The sign-in screen reads this to explain that access is inactive.
    await assertSucceeds(getDoc(doc(db, 'nrp_members', INACTIVE)));
  });
});

describe('member records', () => {
  it('lets someone read only their own record', async () => {
    const db = as(EMPLOYEE);
    await assertSucceeds(getDoc(doc(db, 'nrp_members', EMPLOYEE)));
    await assertFails(getDoc(doc(db, 'nrp_members', COLLEAGUE)));
  });

  it('lets only an admin list the team', async () => {
    await assertFails(getDocs(collection(as(EMPLOYEE), 'nrp_members')));
    await assertSucceeds(getDocs(collection(as(ADMIN), 'nrp_members')));
  });

  it('lets an admin read anyone', async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN), 'nrp_members', EMPLOYEE)));
  });
});

describe('tasks', () => {
  it('lets an employee read a task assigned to them, but not a colleague’s', async () => {
    const db = as(EMPLOYEE);
    await assertSucceeds(getDoc(doc(db, 'nrp_tasks', 'mine')));
    await assertFails(getDoc(doc(db, 'nrp_tasks', 'theirs')));
  });

  it('lets an employee list tasks only when the query filters to their own', async () => {
    const db = as(EMPLOYEE);
    await assertFails(getDocs(collection(db, 'nrp_tasks')));
    // The filter the app actually uses.
    await assertSucceeds(getDocs(query(collection(db, 'nrp_tasks'), where('assigneeIds', 'array-contains', EMPLOYEE))));
    // Asking for someone else's tasks stays denied.
    await assertFails(getDocs(query(collection(db, 'nrp_tasks'), where('assigneeIds', 'array-contains', COLLEAGUE))));
  });

  it('lets an admin read every task', async () => {
    const db = as(ADMIN);
    await assertSucceeds(getDoc(doc(db, 'nrp_tasks', 'mine')));
    await assertSucceeds(getDoc(doc(db, 'nrp_tasks', 'theirs')));
    await assertSucceeds(getDocs(collection(db, 'nrp_tasks')));
  });

  it('guards task activity the same way as the task itself', async () => {
    const db = as(EMPLOYEE);
    await assertSucceeds(getDoc(doc(db, 'nrp_tasks', 'mine', 'activity', 'a1')));
    await assertFails(getDoc(doc(db, 'nrp_tasks', 'theirs', 'activity', 'a1')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'nrp_tasks', 'theirs', 'activity', 'a1')));
  });
});

describe('shared event and client records', () => {
  it('lets any active member read events, clients, guests and reviews', async () => {
    const db = as(EMPLOYEE);
    await assertSucceeds(getDoc(doc(db, 'nrp_events', 'e1')));
    await assertSucceeds(getDoc(doc(db, 'nrp_clients', 'c1')));
    await assertSucceeds(getDoc(doc(db, 'nrp_guests', 'e1_c1')));
    await assertSucceeds(getDoc(doc(db, 'nrp_reviews', 'r1')));
  });

  it('keeps event and guest activity for admins only', async () => {
    await assertFails(getDoc(doc(as(EMPLOYEE), 'nrp_events', 'e1', 'activity', 'a1')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'nrp_events', 'e1', 'activity', 'a1')));
  });
});

describe('expenses', () => {
  it('shows an employee only what they paid for', async () => {
    const db = as(EMPLOYEE);
    await assertSucceeds(getDoc(doc(db, 'nrp_expenses', 'x1')));
    await assertFails(getDoc(doc(db, 'nrp_expenses', 'x2')));
    await assertFails(getDocs(collection(db, 'nrp_expenses')));
    await assertSucceeds(getDocs(query(collection(db, 'nrp_expenses'), where('paidBy', '==', EMPLOYEE))));
  });

  it('shows an admin everything', async () => {
    const db = as(ADMIN);
    await assertSucceeds(getDoc(doc(db, 'nrp_expenses', 'x2')));
    await assertSucceeds(getDocs(collection(db, 'nrp_expenses')));
  });
});

describe('writes', () => {
  it('refuses every direct client write, including an admin’s', async () => {
    // Mutations go through the callable backend, which authorizes and validates
    // them; the rules deny the client path outright.
    await assertFails(setDoc(doc(as(ADMIN), 'nrp_events', 'e2'), { title: 'Sneaky' }));
    await assertFails(setDoc(doc(as(ADMIN), 'nrp_members', 'new'), { role: 'admin', active: true }));
    await assertFails(setDoc(doc(as(EMPLOYEE), 'nrp_tasks', 'mine'), { title: 'Renamed' }));
    await assertFails(setDoc(doc(as(EMPLOYEE), 'nrp_expenses', 'x3'), { paidBy: EMPLOYEE, amountPaise: 1 }));
    await assertFails(setDoc(doc(anonymous(), 'nrp_clients', 'c2'), { name: 'Anyone' }));
  });
});
