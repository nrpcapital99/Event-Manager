import { execFileSync } from 'node:child_process';

const project = 'teammanagement-882f0';
const login = JSON.parse(execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx --yes firebase-tools@latest login:list --json'], { encoding: 'utf8', windowsHide: true }));
const token = login.result?.[0]?.tokens?.access_token;
if (!token) throw new Error('Firebase CLI login is required.');

const typed = value => {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(typed) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typed(item)])) } };
};

async function write(collection, id, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}/${id}`;
  const response = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typed(value)])) }) });
  if (!response.ok) throw new Error(`${collection}/${id}: ${response.status} ${await response.text()}`);
}

const at = new Date().toISOString();
const people = [
  ['test_employee_1', 'TEST 1 · Assigned work', 'Test Operations'],
  ['test_employee_2', 'TEST 2 · In progress', 'Test Marketing'],
  ['test_employee_3', 'TEST 3 · Completed work', 'Test Finance'],
];
const memberName = Object.fromEntries(people.map(([id, name]) => [id, name]));
const person = (id, status, completedAt = null) => ({ status, updatedAt: at, completedAt });
const task = (title, ids, statuses, deadline, kind = 'office', eventId = '') => ({
  title, description: 'Clearly labeled Firebase testing data. Use the admin board controls to test this task.', kind, eventId,
  start: '2026-09-21', deadline, originalDeadline: deadline, priority: statusPriority(statuses), assigneeIds: ids,
  assigneeNames: Object.fromEntries(ids.map(id => [id, memberName[id]])),
  progress: Object.fromEntries(ids.map((id, index) => [id, person(id, statuses[index], statuses[index] === 'Complete' ? at : null)])),
  status: statuses.every(value => value === 'Complete') ? 'Complete' : statuses.includes('Blocked') ? 'Blocked' : statuses.some(value => value !== 'To do') ? 'In progress' : 'To do',
  createdBy: 'firebase_test_seed', createdAt: at, updatedAt: at, completedAt: statuses.every(value => value === 'Complete') ? at : null,
});
function statusPriority(statuses) { return statuses.includes('Blocked') ? 'High' : statuses.every(value => value === 'Complete') ? 'Low' : 'Medium'; }

for (const [id, name, department] of people) await write('nrp_members', id, { name, email: `${id}@example.test`, role: 'team', active: true, department, createdAt: at });
await write('nrp_events', 'test_event_1', { title: 'TEST EVENT 1 · Planning demo', date: '2026-09-28', endDate: '2026-09-29', location: 'Test Venue A', type: 'Workshop', description: 'Testing data for the separate event workspace.', status: 'Planning', createdAt: at, updatedAt: at });
await write('nrp_events', 'test_event_2', { title: 'TEST EVENT 2 · Completed demo', date: '2026-09-10', endDate: '2026-09-10', location: 'Test Venue B', type: 'Client event', description: 'Completed testing event.', status: 'Complete', createdAt: at, updatedAt: at });
await write('nrp_tasks', 'test_task_1', task('TEST 1 · Newly assigned task', ['test_employee_1'], ['To do'], '2026-09-24'));
await write('nrp_tasks', 'test_task_2', task('TEST 2 · Work in progress', ['test_employee_2'], ['In progress'], '2026-09-26'));
await write('nrp_tasks', 'test_task_3', task('TEST 3 · Completed task', ['test_employee_3'], ['Complete'], '2026-09-20'));
await write('nrp_tasks', 'test_task_4', task('TEST 4 · Blocked group event task', ['test_employee_1', 'test_employee_2'], ['Blocked', 'In progress'], '2026-09-29', 'event', 'test_event_1'));
await write('nrp_clients', 'test_client_1', { name: 'TEST CLIENT 1', company: 'Test Company One', email: 'test.client1@example.test', phone: '+91 90000 00001', createdBy: 'firebase_test_seed', createdAt: at, updatedAt: at });
await write('nrp_clients', 'test_client_2', { name: 'TEST CLIENT 2', company: 'Test Company Two', email: 'test.client2@example.test', phone: '+91 90000 00002', createdBy: 'firebase_test_seed', createdAt: at, updatedAt: at });
await write('nrp_guests', 'test_event_1_test_client_1', { eventId: 'test_event_1', clientId: 'test_client_1', invited: true, rsvp: 'Yes', attendance: 2, walkIn: false, attendedAt: at, updatedAt: at, updatedBy: 'firebase_test_seed' });
await write('nrp_guests', 'test_event_1_test_client_2', { eventId: 'test_event_1', clientId: 'test_client_2', invited: true, rsvp: 'Pending', attendance: 0, walkIn: false, attendedAt: null, updatedAt: at, updatedBy: 'firebase_test_seed' });
await write('nrp_expenses', 'test_expense_1', { eventId: 'test_event_1', description: 'TEST EXPENSE 1 · Venue deposit', amountPaise: 250000, date: '2026-09-21', category: 'Venue', paidBy: 'test_employee_3', paidByName: memberName.test_employee_3, createdAt: at });
await write('nrp_expenses', 'test_expense_2', { eventId: '', description: 'TEST EXPENSE 2 · Office supplies', amountPaise: 12500, date: '2026-09-21', category: 'Supplies', paidBy: 'test_employee_1', paidByName: memberName.test_employee_1, createdAt: at });
await write('nrp_reviews', 'test_review_1', { eventId: 'test_event_2', kind: 'Hit', text: 'TEST REVIEW 1 · The test workflow completed successfully.', authorId: 'firebase_test_seed', authorName: 'TEST ADMIN', createdAt: at });
await write('nrp_reviews', 'test_review_2', { eventId: 'test_event_2', kind: 'Miss', text: 'TEST REVIEW 2 · Use this note to verify improvement tracking.', authorId: 'firebase_test_seed', authorName: 'TEST ADMIN', createdAt: at });

console.log('Seeded 3 employees, 4 tasks, 2 events, 2 clients, 2 guests, 2 expenses, and 2 reviews.');
