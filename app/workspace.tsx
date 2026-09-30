"use client";

import { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { ArrowLeft, CalendarDays, CheckCircle2, CircleGauge, Clock3, ListTodo, LogOut, Moon, Pencil, Plus, Sparkles, Sun, TrendingUp, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth, friendlyError, mutate } from '@/lib/firebase';
import { useRecords } from '@/lib/hooks';
import { Client, completion, dateLabel, EventRecord, Expense, Guest, initials, Member, money, Review, ScheduleItem, Task, timeLabel } from '@/lib/model';
import { EventBrowser, ExpenseBrowser, GuestBrowser } from './record-sections';
import { Editor, EditRequest } from './editor';
import { TaskDetail } from './task-detail';
import { Gantt, PageTitle, Status, TaskTable } from './ui';
import { toast } from 'sonner';

export type PreviewData = { member: Member; members: Member[]; events: EventRecord[]; tasks: Task[]; clients: Client[]; guests: Guest[]; expenses: Expense[]; reviews: Review[]; schedules?: ScheduleItem[] };
type Section = 'overview' | 'events' | 'tasks' | 'team';
type EventTab = 'Brief' | 'Flow' | 'Tasks' | 'Timeline' | 'Guests' | 'Event day' | 'Expenses' | 'Review';

export function Workspace({ member, dark, toggle, previewData }: { member: Member; dark: boolean; toggle: () => void; previewData?: PreviewData }) {
  const preview = !!previewData, admin = member.role === 'admin';
  const eventQuery = useRecords<EventRecord>('nrp_events', !preview);
  const taskQuery = useRecords<Task>('nrp_tasks', !preview, admin ? '' : 'assigneeIds', admin ? '' : member.id);
  const memberQuery = useRecords<Member>('nrp_members', !preview && admin);
  const clientQuery = useRecords<Client>('nrp_clients', !preview);
  const guestQuery = useRecords<Guest>('nrp_guests', !preview);
  const expenseQuery = useRecords<Expense>('nrp_expenses', !preview, admin ? '' : 'paidBy', admin ? '' : member.id);
  const reviewQuery = useRecords<Review>('nrp_reviews', !preview);
  const scheduleQuery = useRecords<ScheduleItem>('nrp_schedule', !preview);
  const events = previewData?.events || eventQuery.data;
  const tasks = (previewData?.tasks || taskQuery.data).filter(task => task.kind !== 'office');
  const members = previewData?.members || (admin ? memberQuery.data : [member]);
  const clients = previewData?.clients || clientQuery.data, guests = previewData?.guests || guestQuery.data, expenses = previewData?.expenses || expenseQuery.data, reviews = previewData?.reviews || reviewQuery.data, schedules = previewData?.schedules || scheduleQuery.data;
  const [section, setSection] = useState<Section>('overview'), [eventId, setEventId] = useState(''), [eventTab, setEventTab] = useState<EventTab>('Brief');
  const [edit, setEdit] = useState<EditRequest | null>(null), [detailId, setDetailId] = useState(''), [busy, setBusy] = useState(false);
  const selectedEvent = events.find(event => event.id === eventId), selectedTask = tasks.find(task => task.id === detailId);
  const activeEvents = events.filter(event => event.status !== 'Complete'), liveEvents = events.filter(event => event.status === 'Live'), completeEvents = events.filter(event => event.status === 'Complete');
  const openTasks = tasks.filter(task => task.status !== 'Complete'), eventTasks = tasks.filter(task => task.eventId === eventId), eventGuests = guests.filter(guest => guest.eventId === eventId), eventExpenses = expenses.filter(expense => expense.eventId === eventId), eventSchedule = schedules.filter(item => item.eventId === eventId).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextEvent = [...activeEvents].sort((a, b) => a.date.localeCompare(b.date))[0];
  const errors = [eventQuery.error, taskQuery.error, memberQuery.error, clientQuery.error, guestQuery.error, expenseQuery.error, reviewQuery.error, scheduleQuery.error].filter(Boolean);
  const loading = !preview && (eventQuery.loading || taskQuery.loading || clientQuery.loading || guestQuery.loading || expenseQuery.loading || reviewQuery.loading || scheduleQuery.loading || (admin && memberQuery.loading));
  const navigation = useMemo(() => [
    { id: 'overview' as Section, label: 'Overview', icon: CircleGauge },
    { id: 'events' as Section, label: 'Events', icon: CalendarDays },
    { id: 'tasks' as Section, label: admin ? 'All tasks' : 'My tasks', icon: ListTodo },
    ...(admin ? [{ id: 'team' as Section, label: 'People', icon: Users }] : []),
  ], [admin]);

  function go(sectionName: Section) { setEventId(''); setEventTab('Brief'); setSection(sectionName); window.scrollTo(0, 0); }
  function openEvent(id: string) { setEventId(id); setEventTab('Brief'); setSection('events'); window.scrollTo(0, 0); }
  function newTask(kind: 'event' | 'responsibility' = 'event') { if (!eventId) return; setEdit({ type: 'task', kind, eventId }); }

  async function changeAccess(person: Member) {
    if (preview || !window.confirm(`${person.active ? 'Deactivate' : 'Reactivate'} ${person.name}?`)) return;
    setBusy(true);
    try { await mutate('setMemberActive', { id: person.id, active: !person.active }); toast.success(`${person.name} is now ${person.active ? 'inactive' : 'active'}`); }
    catch (reason) { toast.error(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  const eventPercent = eventTasks.length ? Math.round(eventTasks.reduce((sum, task) => sum + completion(task), 0) / eventTasks.length) : 0;

  return <div className="workspace-shell event-workspace">
    <a className="skip-link" href="#workspace-body">Skip to content</a>
    <header className="workspace-header">
      <button className="brand" onClick={() => go('overview')}><span className="brand-mark">N</span><span>NRP <b>CAPITALS</b></span></button>
      <div className="workspace-account"><span className="account-name">{member.name}<small>{admin ? 'Admin' : 'Employee'}</small></span><Button variant="outline" size="icon" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>{dark ? <Sun/> : <Moon/>}</Button>{!preview && <Button variant="ghost" onClick={() => signOut(auth).catch(reason => toast.error(friendlyError(reason)))}><LogOut/><span className="signout-label">Sign out</span></Button>}</div>
    </header>
    <nav className="tracker-navigation" aria-label="Event workspace sections">{navigation.map(item => <button key={item.id} className={section === item.id && !eventId ? 'active' : ''} aria-current={section === item.id && !eventId ? 'page' : undefined} onClick={() => go(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
    {preview && <div className="preview-banner">Design preview · Sample event data · Saving is disabled <a href="/">Go to real sign-in</a></div>}
    <main id="workspace-body" tabIndex={-1} className="workspace-content">
      {!!errors.length && <div className="error-box" role="alert"><strong>Event data could not be loaded.</strong><p>{errors[0]}</p></div>}
      {loading ? <><PageTitle eyebrow="EVENT WORKSPACE" title="Opening your events…" description="Loading schedules, people, guests, and progress."/><div className="stats-grid">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-32"/>)}</div><Skeleton className="mt-6 h-96"/></> : <>
        {section === 'overview' && !selectedEvent && <>
          <PageTitle eyebrow="EVENT COMMAND CENTRE" title={admin ? 'Events at a glance' : 'My event work'} description={admin ? 'Upcoming events, team progress, guests, and spending in one clear view.' : 'Your event assignments, deadlines, and updates in one place.'} actions={admin && <Button onClick={() => setEdit({ type: 'event' })}><Plus/>New event</Button>}/>
          <section className="stats-grid productivity-stats" aria-label="Event summary">
            <article className="stat stat-featured"><div className="stat-top"><span>Active events</span><CalendarDays/></div><strong>{activeEvents.length}</strong><p>{nextEvent ? `Next: ${nextEvent.title}` : 'Nothing currently scheduled'}</p></article>
            <article className="stat"><div className="stat-top"><span>Live now</span><CircleGauge/></div><strong>{liveEvents.length}</strong><p>Events currently underway</p></article>
            <article className="stat"><div className="stat-top"><span>Open tasks</span><Clock3/></div><strong>{openTasks.length}</strong><p>{admin ? 'Across all visible events' : 'Assigned to you'}</p></article>
            <article className="stat"><div className="stat-top"><span>Completed</span><CheckCircle2/></div><strong>{completeEvents.length}</strong><p>Finished events</p></article>
          </section>
          <div className="section-heading event-list-heading"><div><h2>{admin ? 'All events' : 'Events'}</h2><p>Open an event to manage its tasks, guests, timeline, and costs.</p></div></div>
          <EventBrowser events={events} tasks={tasks} guests={guests} expenses={expenses} admin={admin} open={openEvent} create={() => setEdit({ type: 'event' })}/>
        </>}

        {section === 'events' && !selectedEvent && <><PageTitle eyebrow="EVENTS" title="All events" description="Plans, people, progress, attendance, and costs together." actions={admin && <Button onClick={() => setEdit({ type: 'event' })}><Plus/>New event</Button>}/><EventBrowser events={events} tasks={tasks} guests={guests} expenses={expenses} admin={admin} open={openEvent} create={() => setEdit({ type: 'event' })}/></>}

        {section === 'events' && selectedEvent && <>
          <Button variant="ghost" className="back-button" onClick={() => { setEventId(''); window.scrollTo(0, 0); }}><ArrowLeft/>All events</Button>
          <PageTitle eyebrow={selectedEvent.status.toUpperCase()} title={selectedEvent.title} description={`${dateLabel(selectedEvent.date)}${selectedEvent.endDate !== selectedEvent.date ? ` – ${dateLabel(selectedEvent.endDate)}` : ''}${selectedEvent.startTime ? ` · ${selectedEvent.startTime}${selectedEvent.endTime ? `–${selectedEvent.endTime}` : ''}` : ''} · ${selectedEvent.location || 'Location to be confirmed'}`} actions={<div className="title-actions"><Status value={selectedEvent.status}/>{admin && <Button variant="outline" onClick={() => setEdit({ type: 'event', id: selectedEvent.id })}><Pencil/>Edit event</Button>}</div>}/>
          {selectedEvent.description && <p className="event-brief">{selectedEvent.description}</p>}
          <section className="event-summary" aria-label="Selected event summary"><div><strong>{eventPercent}%</strong><small>Task progress</small></div><div><strong>{eventGuests.filter(guest => guest.rsvp === 'Yes').length}</strong><small>Confirmed guests</small></div><div><strong>{eventGuests.reduce((sum, guest) => sum + guest.attendance, 0)}</strong><small>People attended</small></div><div><strong>{money(eventExpenses.reduce((sum, expense) => sum + expense.amountPaise, 0))}</strong><small>{admin ? 'Event spending' : 'My logged expenses'}</small></div></section>
          <Tabs value={eventTab} onValueChange={value => setEventTab(value as EventTab)} className="event-tabs"><TabsList variant="line">{(['Brief', 'Flow', 'Tasks', 'Timeline', 'Guests', 'Event day', 'Expenses', 'Review'] as EventTab[]).map(tab => <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>)}</TabsList></Tabs>
          <div className="section-heading"><div><h2>{eventTab}</h2><p>{eventTab === 'Brief' ? 'Complete timings, contacts, purpose, and operating instructions.' : eventTab === 'Flow' ? 'The minute-by-minute run of show and handovers.' : eventTab === 'Tasks' ? 'Preparation work and deadlines.' : eventTab === 'Timeline' ? 'The preparation plan across dates.' : eventTab === 'Guests' ? 'Invitations, replies, and attendance.' : eventTab === 'Event day' ? 'Responsibilities for the live event.' : eventTab === 'Expenses' ? 'Event spending recorded by the team.' : 'What worked and what should improve.'}</p></div><div className="title-actions">{admin && eventTab === 'Brief' && <Button variant="outline" onClick={() => setEdit({ type: 'event', id: selectedEvent.id })}><Pencil/>Edit details</Button>}{admin && eventTab === 'Flow' && <Button onClick={() => setEdit({ type: 'schedule', eventId })}><Plus/>Add flow item</Button>}{admin && eventTab === 'Tasks' && <Button onClick={() => newTask('event')}><Plus/>Add task</Button>}{admin && eventTab === 'Event day' && <Button onClick={() => newTask('responsibility')}><Plus/>Add responsibility</Button>}{eventTab === 'Expenses' && <Button onClick={() => setEdit({ type: 'expense', eventId })}><Plus/>Log expense</Button>}{eventTab === 'Review' && <Button onClick={() => setEdit({ type: 'review', eventId })}><Plus/>Add note</Button>}</div></div>
          {eventTab === 'Brief' && <div className="event-brief-grid">
            <section className="panel event-detail-panel"><header><span>01</span><div><h3>Purpose and audience</h3><p>Why this event exists and who it serves</p></div></header><dl><div><dt>Objective</dt><dd>{selectedEvent.objective || 'Add the desired outcome for this event.'}</dd></div><div><dt>Audience</dt><dd>{selectedEvent.audience || 'Audience not specified'}</dd></div><div><dt>Expected guests</dt><dd>{selectedEvent.expectedGuests || 'Not specified'}</dd></div><div><dt>Dress code</dt><dd>{selectedEvent.dressCode || 'Not specified'}</dd></div></dl></section>
            <section className="panel event-detail-panel"><header><span>02</span><div><h3>Timing and ownership</h3><p>Reporting, setup, start, and key contact</p></div></header><dl><div><dt>Setup begins</dt><dd>{selectedEvent.setupTime || 'Not specified'}</dd></div><div><dt>Team reports</dt><dd>{selectedEvent.reportingTime || 'Not specified'}</dd></div><div><dt>Event time</dt><dd>{selectedEvent.startTime ? `${selectedEvent.startTime}${selectedEvent.endTime ? `–${selectedEvent.endTime}` : ''}` : 'Not specified'}</dd></div><div><dt>Lead organiser</dt><dd>{selectedEvent.organiserName || 'Not assigned'}{selectedEvent.organiserPhone ? <small>{selectedEvent.organiserPhone}</small> : null}</dd></div></dl></section>
            <section className="panel event-detail-panel"><header><span>03</span><div><h3>Arrival and hospitality</h3><p>Access, parking, food, and guest comfort</p></div></header><dl className="detail-notes"><div><dt>Venue</dt><dd>{selectedEvent.location || 'Not confirmed'}</dd></div><div><dt>Parking and entry</dt><dd>{selectedEvent.parkingNotes || 'No instructions added'}</dd></div><div><dt>Catering</dt><dd>{selectedEvent.cateringNotes || 'No instructions added'}</dd></div></dl></section>
            <section className="panel event-detail-panel"><header><span>04</span><div><h3>Production and backup</h3><p>Equipment, materials, and contingency plan</p></div></header><dl className="detail-notes"><div><dt>Equipment and AV</dt><dd>{selectedEvent.equipmentNotes || 'No instructions added'}</dd></div><div><dt>Emergency and backup</dt><dd>{selectedEvent.emergencyNotes || 'No instructions added'}</dd></div></dl></section>
          </div>}
          {eventTab === 'Flow' && <section className="panel runbook"><div className="runbook-head"><span>Time</span><span>Activity and instructions</span><span>Owner</span><span>Area</span></div>{eventSchedule.map((item, index) => <button key={item.id} className="runbook-row" onClick={() => admin && setEdit({ type: 'schedule', id: item.id, eventId })}><span className="runbook-time"><strong>{item.startTime}</strong><small>{item.endTime}</small></span><span className="runbook-activity"><b>{index + 1}</b><span><strong>{item.title}</strong><small>{item.notes || 'No additional instructions'}</small></span></span><span>{item.ownerName || 'Unassigned'}</span><span>{item.location || '—'}</span></button>)}{!eventSchedule.length && <div className="runbook-empty"><Clock3/><strong>No event flow added yet</strong><p>Add arrival, registration, sessions, breaks, speeches, meals, and closing so everyone knows exactly what happens when.</p>{admin && <Button onClick={() => setEdit({ type: 'schedule', eventId })}><Plus/>Add first flow item</Button>}</div>}</section>}
          {eventTab === 'Tasks' && <TaskTable tasks={eventTasks.filter(task => task.kind === 'event')} events={events} onOpen={task => setDetailId(task.id)}/ >}
          {eventTab === 'Timeline' && <Gantt tasks={eventTasks} onOpen={task => setDetailId(task.id)}/ >}
          {eventTab === 'Guests' && <GuestBrowser guests={eventGuests} clients={clients} edit={id => setEdit({ type: 'guest', id, eventId })} add={walkIn => setEdit({ type: 'guest', eventId, walkIn })}/ >}
          {eventTab === 'Event day' && <TaskTable tasks={eventTasks.filter(task => task.kind === 'responsibility')} events={events} onOpen={task => setDetailId(task.id)}/ >}
          {eventTab === 'Expenses' && <ExpenseBrowser expenses={eventExpenses} events={events}/ >}
          {eventTab === 'Review' && <div className="reviews-grid">{(['Hit', 'Miss'] as const).map(kind => <section className="panel review-column" key={kind}><header><span className={`review-icon ${kind === 'Hit' ? 'green' : 'amber'}`}>{kind === 'Hit' ? <TrendingUp/> : <Sparkles/>}</span><div><h3>{kind === 'Hit' ? 'What worked' : 'What to improve'}</h3></div></header>{reviews.filter(review => review.eventId === eventId && review.kind === kind).map(review => <article className="review-card" key={review.id}><p>{review.text}</p><footer><span>{review.authorName}</span><time>{timeLabel(review.createdAt)}</time></footer></article>)}{!reviews.some(review => review.eventId === eventId && review.kind === kind) && <p className="subtle p-6">No notes yet.</p>}</section>)}</div>}
        </>}

        {section === 'tasks' && !selectedEvent && <><PageTitle eyebrow="EVENT TASKS" title={admin ? 'All event tasks' : 'My event tasks'} description={admin ? 'Search every assignment and open it to edit the people, dates, or priority.' : 'Update your assigned work, completion, and daily notes.'}/><TaskTable tasks={tasks} events={events} onOpen={task => setDetailId(task.id)}/></>}

        {section === 'team' && admin && !selectedEvent && <><PageTitle eyebrow="PEOPLE" title="Admins and employees" description="Every account has one clear role: Admin or Employee." actions={<Button onClick={() => setEdit({ type: 'member' })}><UserPlus/>Add person</Button>}/><section className="panel"><div className="simple-people-grid">{members.map(person => <article className="simple-person" key={person.id}><span className="avatar">{initials(person.name)}</span><div><strong>{person.name}</strong><p>{person.email}</p></div><span className="person-role">{person.role === 'admin' ? 'Admin' : 'Employee'}</span><Status value={person.active ? 'Active' : 'Inactive'}/>{person.id !== member.id && <Button variant="outline" size="sm" disabled={busy || preview} onClick={() => changeAccess(person)}>{person.active ? 'Deactivate' : 'Reactivate'}</Button>}</article>)}</div></section></>}
      </>}
    </main>
    {edit && <Editor key={JSON.stringify(edit)} request={edit} close={() => setEdit(null)} member={member} members={members} events={events} tasks={tasks} clients={clients} guests={guests} schedules={schedules} preview={preview}/ >}
    {selectedTask && !edit && <TaskDetail key={selectedTask.id} task={selectedTask} member={member} event={events.find(event => event.id === selectedTask.eventId)} close={() => setDetailId('')} edit={() => setEdit({ type: 'task', id: selectedTask.id, eventId: selectedTask.eventId, kind: selectedTask.kind })} preview={preview}/ >}
  </div>;
}
