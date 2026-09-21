"use client";

import { useState } from 'react';
import { CalendarDays, Check, Clock3, Flag, Loader2, Pencil, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Activity, completion, dateLabel, EventRecord, initials, Member, Task, timeLabel } from '@/lib/model';
import { useRecords } from '@/lib/hooks';
import { friendlyError, mutate } from '@/lib/firebase';
import { Picker, Status } from './ui';
import { toast } from 'sonner';

function details(text: string) {
  try {
    const parsed = JSON.parse(text);
    if (parsed.before && parsed.after) {
      return Object.keys(parsed.after)
        .filter(key => JSON.stringify(parsed.before[key]) !== JSON.stringify(parsed.after[key]))
        .map(key => ({ deadline: 'Deadline', start: 'Start date', title: 'Title', assigneeNames: 'Assignees', priority: 'Priority', description: 'Description' }[key] || key) + ': ' + (typeof parsed.before[key] === 'object' ? Object.values(parsed.before[key]).join(', ') : parsed.before[key]) + ' → ' + (typeof parsed.after[key] === 'object' ? Object.values(parsed.after[key]).join(', ') : parsed.after[key]))
        .join('\n') || 'Task details saved.';
    }
  } catch {}
  return text;
}

export function TaskDetail({ task, member, event, close, edit, preview = false }: { task: Task; member: Member; event?: EventRecord; close: () => void; edit: () => void; preview?: boolean }) {
  const activity = useRecords<Activity>('nrp_tasks/' + task.id + '/activity', !preview);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const mine = task.progress[member.id], [status, setStatus] = useState(mine?.status || 'To do');

  async function perform(action: string, data: Record<string, unknown>) {
    if (preview) return;
    setBusy(true); setError('');
    try {
      await mutate(action, { id: task.id, ...data });
      setNote('');
      toast.success(action === 'comment' ? 'Update posted' : 'Your progress is saved');
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setBusy(false); }
  }

  return <Sheet open onOpenChange={open => { if (!open) close(); }}><SheetContent className="task-sheet">
    <SheetHeader>
      <div className="flex gap-2 items-center mb-2"><Status value={task.status}/><span className="subtle">{event?.title || 'Productivity task'}</span></div>
      <SheetTitle>{task.title}</SheetTitle>
      <SheetDescription>{task.description || 'No additional instructions.'}</SheetDescription>
    </SheetHeader>
    <div className="sheet-body">
      <div className="detail-facts">
        <div><CalendarDays/><span>Deadline<strong>{dateLabel(task.deadline)}</strong></span></div>
        <div><Flag/><span>Priority<strong>{task.priority}</strong></span></div>
        <div><Clock3/><span>Start date<strong>{dateLabel(task.start)}</strong></span></div>
        <div><Check/><span>Completed<strong>{task.completedAt ? timeLabel(task.completedAt) : 'Not yet'}</strong></span></div>
      </div>
      {task.originalDeadline !== task.deadline && <p className="form-note">Original deadline: {dateLabel(task.originalDeadline)}. Changed by an admin.</p>}
      <div className="section-heading"><h3>People & progress</h3><strong>{completion(task)}%</strong></div>
      <Progress value={completion(task)} className="mb-5"/>
      <div className="people-progress">{task.assigneeIds.map(id => <div key={id}><span className="avatar">{initials(task.assigneeNames[id])}</span><span className="person-name">{task.assigneeNames[id]}{id === member.id && <small>You</small>}<small>{task.progress[id]?.completedAt ? timeLabel(task.progress[id].completedAt!) : 'Assigned'}</small></span><Status value={task.progress[id]?.status || 'To do'}/></div>)}</div>
      {mine && <div className="your-progress">
        <h3>Your progress</h3>
        {mine.status === 'Complete' ? <>
          <p className="success-inline"><Check size={17}/>Completed {timeLabel(mine.completedAt!)}</p>
          <Button className="mt-3 w-full" variant="outline" disabled={busy || preview} onClick={() => perform('progress', { status: 'In progress' })}>Reopen task</Button>
        </> : <>
          <div className="flex gap-2 mt-3"><Picker label="Your progress" value={status} onChange={value => setStatus(value as typeof status)} options={['To do', 'In progress', 'Blocked']}/><Button variant="outline" disabled={busy || preview || status === mine.status} onClick={() => perform('progress', { status })}>Update</Button></div>
          <Button className="mt-3 w-full" disabled={busy || preview} onClick={() => perform('progress', { status: 'Complete' })}><Check/>Mark complete</Button>
        </>}
        <p className="form-note">For shared tasks, the task completes after every assignee finishes.</p>
      </div>}
      {member.role === 'admin' && <Button variant="outline" className="mt-4 w-full" onClick={edit}><Pencil size={16}/>Edit task and deadline</Button>}
      <div className="section-heading mt-8"><h3>Daily updates</h3><span className="subtle">IST</span></div>
      <form onSubmit={formEvent => { formEvent.preventDefault(); perform('comment', { text: note }); }}>
        <Textarea aria-label="Post a task update" placeholder="What did you work on today? Add progress or a blocker…" value={note} onChange={changeEvent => setNote(changeEvent.target.value)} maxLength={4000} required/>
        <Button className="mt-3" size="sm" disabled={busy || preview || !note.trim()}>{busy ? <Loader2 className="animate-spin"/> : <Send size={14}/>}Post update</Button>
      </form>
      {(error || activity.error) && <p className="error-box" role="alert">{error || activity.error}</p>}
      <div className="activity-feed">{activity.data.sort((a, b) => b.at.localeCompare(a.at)).map(item => <article key={item.id}><span className="activity-dot"/><div><p><strong>{item.actorName}</strong> <span>{item.action.toLowerCase()}</span></p><p className="activity-details">{details(item.details)}</p><time>{timeLabel(item.at)}</time></div></article>)}{!activity.data.length && <p className="subtle mt-5">{preview ? 'Updates are recorded in the live portal.' : 'Progress changes and daily updates appear here.'}</p>}</div>
    </div>
  </SheetContent></Sheet>;
}
