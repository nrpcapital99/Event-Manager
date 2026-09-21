"use client";

import { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { BriefcaseBusiness, CheckCircle2, CircleGauge, Clock3, LogOut, Moon, Plus, Sun, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { auth, friendlyError } from '@/lib/firebase';
import { useRecords } from '@/lib/hooks';
import { Client, EventRecord, Expense, Guest, Member, Review, Task, overdue } from '@/lib/model';
import { AdminTaskBoard } from './record-sections';
import { Editor, EditRequest } from './editor';
import { TaskDetail } from './task-detail';
import { PageTitle, TaskTable } from './ui';
import { toast } from 'sonner';

export type PreviewData = { member: Member; members: Member[]; events: EventRecord[]; tasks: Task[]; clients: Client[]; guests: Guest[]; expenses: Expense[]; reviews: Review[] };
type TeamFilter = 'all' | 'frontend' | 'backend';

const employeeType = (person: Member) => person.employeeType || (/client|marketing|relationship|front/i.test(person.department || '') ? 'frontend' : 'backend');

export function Workspace({ member, dark, toggle, previewData }: { member: Member; dark: boolean; toggle: () => void; previewData?: PreviewData }) {
  const preview = !!previewData, admin = member.role === 'admin';
  const taskQuery = useRecords<Task>('nrp_tasks', !preview, admin ? '' : 'assigneeIds', admin ? '' : member.id);
  const memberQuery = useRecords<Member>('nrp_members', !preview && admin);
  const tasks = (previewData?.tasks || taskQuery.data).filter(task => task.kind === 'office');
  const members = previewData?.members || (admin ? memberQuery.data : [member]);
  const [edit, setEdit] = useState<EditRequest | null>(null), [detailId, setDetailId] = useState(''), [team, setTeam] = useState<TeamFilter>('all');
  const employees = useMemo(() => members.filter(person => person.role !== 'admin' && (team === 'all' || employeeType(person) === team)), [members, team]);
  const selectedTask = tasks.find(task => task.id === detailId);
  const open = tasks.filter(task => task.status !== 'Complete'), completed = tasks.filter(task => task.status === 'Complete'), late = tasks.filter(overdue);
  const loading = !preview && (taskQuery.loading || (admin && memberQuery.loading));
  const error = taskQuery.error || memberQuery.error;
  const newTask = (person?: Member) => setEdit({ type: 'task', kind: 'office', assigneeIds: person ? [person.id] : admin ? [] : [member.id] });

  return <div className="workspace-shell productivity-shell">
    <a className="skip-link" href="#workspace-body">Skip to content</a>
    <header className="workspace-header">
      <a href="#" className="brand"><span className="brand-mark">N</span><span>NRP <b>CAPITALS</b></span></a>
      <div className="workspace-account">
        <span className="account-name">{member.name}<small>{admin ? 'Administrator' : employeeType(member) === 'frontend' ? 'Frontend employee' : 'Backend employee'}</small></span>
        <Button variant="outline" size="icon" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>{dark ? <Sun /> : <Moon />}</Button>
        {!preview && <Button variant="ghost" onClick={() => signOut(auth).catch(reason => toast.error(friendlyError(reason)))}><LogOut/><span className="signout-label">Sign out</span></Button>}
      </div>
    </header>
    {preview && <div className="preview-banner">Design preview · Sample data · Saving is disabled <a href="/">Go to real sign-in</a></div>}
    <main id="workspace-body" tabIndex={-1} className="workspace-content">
      {error && <div className="error-box" role="alert"><strong>Productivity data could not be loaded.</strong><p>{error}</p></div>}
      {loading ? <><PageTitle eyebrow="PRODUCTIVITY" title="Opening the command board…" description="Loading employees, tasks, and progress."/><div className="stats-grid">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-32"/>)}</div><Skeleton className="mt-6 h-96"/></> : <>
        <PageTitle eyebrow="PRODUCTIVITY PORTAL" title={admin ? 'Team command board' : 'My productivity'} description={admin ? 'One view of every employee’s tasks, deadlines, and progress.' : 'Create your tasks, post daily updates, and keep your progress current.'} actions={<div className="title-actions">{admin && <Button variant="outline" onClick={() => setEdit({ type: 'member' })}><UserPlus/>Add employee</Button>}<Button onClick={() => newTask()}><Plus/>New task</Button></div>}/>
        <section className="stats-grid productivity-stats" aria-label="Productivity summary">
          <article className="stat stat-featured"><div className="stat-top"><span>Open tasks</span><CircleGauge/></div><strong>{open.length}</strong><p>Currently in the team’s queue</p></article>
          <article className="stat"><div className="stat-top"><span>Completed</span><CheckCircle2/></div><strong>{completed.length}</strong><p>Finished work</p></article>
          <article className="stat"><div className="stat-top"><span>Overdue</span><Clock3/></div><strong>{late.length}</strong><p>Past the assigned deadline</p></article>
          <article className="stat"><div className="stat-top"><span>{admin ? 'Employees' : 'My tasks'}</span>{admin ? <Users/> : <BriefcaseBusiness/>}</div><strong>{admin ? members.filter(person => person.role !== 'admin').length : tasks.length}</strong><p>{admin ? 'Frontend and backend team' : 'All assigned work'}</p></article>
        </section>
        {admin ? <>
          <div className="team-switch" role="group" aria-label="Employee team"><button className={team === 'all' ? 'active' : ''} onClick={() => setTeam('all')}>All employees</button><button className={team === 'frontend' ? 'active' : ''} onClick={() => setTeam('frontend')}>Frontend</button><button className={team === 'backend' ? 'active' : ''} onClick={() => setTeam('backend')}>Backend</button></div>
          <AdminTaskBoard members={employees} tasks={tasks} openTask={task => setDetailId(task.id)} addTask={newTask} completeTask={() => {}} removeTask={() => {}} admin={false} busy={preview}/>
        </> : <section className="employee-work"><div className="section-heading"><div><h2>My tasks</h2><p>Open a task to change its status or post today’s update.</p></div></div><TaskTable tasks={tasks} events={[]} onOpen={task => setDetailId(task.id)}/></section>}
      </>}
    </main>
    {edit && <Editor key={JSON.stringify(edit)} request={edit} close={() => setEdit(null)} member={member} members={members} events={[]} tasks={tasks} clients={[]} guests={[]} preview={preview}/ >}
    {selectedTask && !edit && <TaskDetail key={selectedTask.id} task={selectedTask} member={member} close={() => setDetailId('')} edit={() => setEdit({ type: 'task', id: selectedTask.id })} preview={preview}/ >}
  </div>;
}
