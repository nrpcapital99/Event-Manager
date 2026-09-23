"use client";

import { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { BriefcaseBusiness, CalendarRange, CheckCircle2, CircleGauge, Clock3, LayoutDashboard, ListTodo, LogOut, Moon, Plus, Sun, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { auth, friendlyError, mutate } from '@/lib/firebase';
import { useRecords } from '@/lib/hooks';
import { Client, EventRecord, Expense, Guest, Member, Review, Task, overdue } from '@/lib/model';
import { AdminTaskBoard, EmployeeTaskBrowser } from './record-sections';
import { Editor, EditRequest } from './editor';
import { TaskDetail } from './task-detail';
import { Gantt, PageTitle, TaskTable } from './ui';
import { toast } from 'sonner';

export type PreviewData = { member: Member; members: Member[]; events: EventRecord[]; tasks: Task[]; clients: Client[]; guests: Guest[]; expenses: Expense[]; reviews: Review[] };
type TeamFilter = 'all' | 'frontend' | 'backend';
type Section = 'overview' | 'tasks' | 'timeline' | 'team';

const employeeType = (person: Member) => person.employeeType || (/client|marketing|relationship|front/i.test(person.department || '') ? 'frontend' : 'backend');

export function Workspace({ member, dark, toggle, previewData }: { member: Member; dark: boolean; toggle: () => void; previewData?: PreviewData }) {
  const preview = !!previewData, admin = member.role === 'admin';
  const taskQuery = useRecords<Task>('nrp_tasks', !preview, admin ? '' : 'assigneeIds', admin ? '' : member.id);
  const memberQuery = useRecords<Member>('nrp_members', !preview && admin);
  const tasks = (previewData?.tasks || taskQuery.data).filter(task => task.kind === 'office');
  const members = previewData?.members || (admin ? memberQuery.data : [member]);
  const [section, setSection] = useState<Section>('overview');
  const [edit, setEdit] = useState<EditRequest | null>(null), [detailId, setDetailId] = useState(''), [team, setTeam] = useState<TeamFilter>('all'), [busy, setBusy] = useState(false);
  const employees = useMemo(() => members.filter(person => person.role !== 'admin' && (team === 'all' || employeeType(person) === team)), [members, team]);
  const selectedTask = tasks.find(task => task.id === detailId);
  const open = tasks.filter(task => task.status !== 'Complete'), completed = tasks.filter(task => task.status === 'Complete'), late = tasks.filter(overdue);
  const recent = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const loading = !preview && (taskQuery.loading || (admin && memberQuery.loading));
  const error = taskQuery.error || memberQuery.error;
  const newTask = (person?: Member) => setEdit({ type: 'task', kind: 'office', assigneeIds: person ? [person.id] : admin ? [] : [member.id] });

  async function quickTask(action: 'completeTask' | 'removeTask', task: Task) {
    if (preview) return;
    if (action === 'removeTask' && !window.confirm(`Remove “${task.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await mutate(action, { id: task.id });
      toast.success(action === 'completeTask' ? 'Task marked complete' : 'Task removed');
    } catch (reason) { toast.error(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  async function changeAccess(person: Member) {
    if (preview || !window.confirm(`${person.active ? 'Deactivate' : 'Reactivate'} ${person.name}?`)) return;
    setBusy(true);
    try {
      await mutate('setMemberActive', { id: person.id, active: !person.active });
      toast.success(`${person.name} is now ${person.active ? 'inactive' : 'active'}`);
    } catch (reason) { toast.error(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  const navigation: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tasks', label: admin ? 'Office tasks' : 'My tasks', icon: ListTodo },
    { id: 'timeline', label: 'Gantt chart', icon: CalendarRange },
    ...(admin ? [{ id: 'team' as Section, label: 'Team', icon: Users }] : []),
  ];

  return <div className="workspace-shell productivity-shell activity-tracker">
    <a className="skip-link" href="#workspace-body">Skip to content</a>
    <header className="workspace-header">
      <button className="brand" onClick={() => setSection('overview')}><span className="brand-mark">N</span><span>NRP <b>CAPITALS</b></span></button>
      <div className="workspace-account">
        <span className="account-name">{member.name}<small>{admin ? 'Administrator' : employeeType(member) === 'frontend' ? 'Frontend employee' : 'Backend employee'}</small></span>
        <Button variant="outline" size="icon" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>{dark ? <Sun/> : <Moon/>}</Button>
        {!preview && <Button variant="ghost" onClick={() => signOut(auth).catch(reason => toast.error(friendlyError(reason)))}><LogOut/><span className="signout-label">Sign out</span></Button>}
      </div>
    </header>
    <nav className="tracker-navigation" aria-label="Activity tracker sections">
      {navigation.map(item => <button key={item.id} className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}><item.icon/><span>{item.label}</span></button>)}
    </nav>
    {preview && <div className="preview-banner">Design preview · Sample office data · Saving is disabled <a href="/">Go to real sign-in</a></div>}
    <main id="workspace-body" tabIndex={-1} className="workspace-content">
      {error && <div className="error-box" role="alert"><strong>Activity data could not be loaded.</strong><p>{error}</p></div>}
      {loading ? <><PageTitle eyebrow="ACTIVITY TRACKER" title="Opening your workspace…" description="Loading employees, office tasks, and progress."/><div className="stats-grid">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-32"/>)}</div><Skeleton className="mt-6 h-96"/></> : <>
        {section === 'overview' && <>
          <PageTitle eyebrow="OFFICE ACTIVITY" title={admin ? 'Team activity overview' : 'My activity overview'} description={admin ? 'Track assignments, deadlines, completion, and daily progress across the office.' : 'Keep your office tasks, deadlines, and daily updates current.'} actions={<div className="title-actions">{admin && <Button variant="outline" onClick={() => setEdit({ type: 'member' })}><UserPlus/>Add person</Button>}<Button onClick={() => newTask()}><Plus/>New task</Button></div>}/>
          <section className="stats-grid productivity-stats" aria-label="Office activity summary">
            <article className="stat stat-featured"><div className="stat-top"><span>Open tasks</span><CircleGauge/></div><strong>{open.length}</strong><p>Currently in progress or waiting</p></article>
            <article className="stat"><div className="stat-top"><span>Completed</span><CheckCircle2/></div><strong>{completed.length}</strong><p>Finished office tasks</p></article>
            <article className="stat"><div className="stat-top"><span>Overdue</span><Clock3/></div><strong>{late.length}</strong><p>Past the assigned deadline</p></article>
            <article className="stat"><div className="stat-top"><span>{admin ? 'Employees' : 'My tasks'}</span>{admin ? <Users/> : <BriefcaseBusiness/>}</div><strong>{admin ? members.filter(person => person.role !== 'admin').length : tasks.length}</strong><p>{admin ? 'Active and inactive team records' : 'All assigned office work'}</p></article>
          </section>
          {admin ? <>
            <div className="team-switch" role="group" aria-label="Employee team"><button className={team === 'all' ? 'active' : ''} onClick={() => setTeam('all')}>All employees</button><button className={team === 'frontend' ? 'active' : ''} onClick={() => setTeam('frontend')}>Frontend</button><button className={team === 'backend' ? 'active' : ''} onClick={() => setTeam('backend')}>Backend</button></div>
            <AdminTaskBoard members={employees} tasks={tasks} openTask={task => setDetailId(task.id)} addTask={newTask} completeTask={task => quickTask('completeTask', task)} removeTask={task => quickTask('removeTask', task)} admin busy={busy || preview}/>
          </> : <section className="employee-work"><div className="section-heading"><div><h2>My office tasks</h2><p>Open a task to update its status or post today’s activity.</p></div></div><TaskTable tasks={tasks} events={[]} onOpen={task => setDetailId(task.id)}/></section>}
          {!!recent.length && <section className="recent-work"><div className="section-heading"><div><span className="eyebrow">RECENT WORK</span><h2>Recently updated tasks</h2><p>The latest task activity, ordered by the most recent change.</p></div><Button variant="outline" onClick={() => setSection('tasks')}>View all tasks</Button></div><TaskTable tasks={recent} events={[]} onOpen={task => setDetailId(task.id)} compact/></section>}
        </>}

        {section === 'tasks' && <><PageTitle eyebrow="OFFICE TASKS" title={admin ? 'All office tasks' : 'My office tasks'} description={admin ? 'Search, filter, assign, edit, and review every office task.' : 'Create your own tasks and keep assigned work updated.'} actions={<Button onClick={() => newTask()}><Plus/>New task</Button>}/><TaskTable tasks={tasks} events={[]} onOpen={task => setDetailId(task.id)}/></>}

        {section === 'timeline' && <><PageTitle eyebrow="TIMELINE" title="Office Gantt chart" description="See task schedules, owners, deadlines, and completion across time." actions={<Button onClick={() => newTask()}><Plus/>New task</Button>}/><Gantt tasks={tasks} onOpen={task => setDetailId(task.id)}/></>}

        {section === 'team' && admin && <><PageTitle eyebrow="TEAM" title="Employees and workload" description="Review each employee’s assignments, completed work, team, and account status." actions={<Button onClick={() => setEdit({ type: 'member' })}><UserPlus/>Add person</Button>}/><div className="team-switch" role="group" aria-label="Employee team"><button className={team === 'all' ? 'active' : ''} onClick={() => setTeam('all')}>All employees</button><button className={team === 'frontend' ? 'active' : ''} onClick={() => setTeam('frontend')}>Frontend</button><button className={team === 'backend' ? 'active' : ''} onClick={() => setTeam('backend')}>Backend</button></div><EmployeeTaskBrowser members={employees} tasks={tasks} changeAccess={changeAccess} openTask={task => setDetailId(task.id)} canManage/></>}
      </>}
    </main>
    {edit && <Editor key={JSON.stringify(edit)} request={edit} close={() => setEdit(null)} member={member} members={members} events={[]} tasks={tasks} clients={[]} guests={[]} preview={preview}/ >}
    {selectedTask && !edit && <TaskDetail key={selectedTask.id} task={selectedTask} member={member} close={() => setDetailId('')} edit={() => setEdit({ type: 'task', id: selectedTask.id })} preview={preview}/ >}
  </div>;
}
