"use client";

import { ReactNode, useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Circle, CircleAlert, Clock3, LayoutGrid, List, ListTodo, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { EventRecord, Task, completion, dateLabel, initials, overdue } from '@/lib/model';

export type ViewMode = 'tiles' | 'list';

export function Picker({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[]; label: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(option => { const id = typeof option === 'string' ? option : option.value, text = typeof option === 'string' ? option : option.label; return <SelectItem key={id} value={id}>{text}</SelectItem>; })}</SelectContent></Select>;
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="search-box"><Search size={17}/><Input aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></div>;
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return <div className="view-toggle" role="group" aria-label="Choose view"><button type="button" className={value === 'tiles' ? 'active' : ''} aria-pressed={value === 'tiles'} onClick={() => onChange('tiles')}><LayoutGrid size={16}/><span>Tiles</span></button><button type="button" className={value === 'list' ? 'active' : ''} aria-pressed={value === 'list'} onClick={() => onChange('list')}><List size={16}/><span>List</span></button></div>;
}

export function Status({ value }: { value: string }) {
  const type = ['Complete', 'Yes', 'Active', 'Hit'].includes(value) ? 'green' : ['Blocked', 'No', 'Overdue', 'Miss', 'Inactive'].includes(value) ? 'red' : ['In progress', 'Live', 'Invited'].includes(value) ? 'blue' : ['Maybe', 'High', 'Pending'].includes(value) ? 'amber' : 'neutral';
  const Icon = value === 'Complete' ? Check : value === 'Blocked' || value === 'Overdue' ? CircleAlert : value === 'In progress' ? Clock3 : Circle;
  return <span className={'status ' + type}><Icon size={12}/>{value}</span>;
}

export function Avatars({ names }: { names: string[] }) {
  return <div className="avatar-stack" aria-label={names.join(', ')}>{names.slice(0, 4).map((name, index) => <span key={name + index} className={'avatar tone-' + index} title={name}>{initials(name)}</span>)}{names.length > 4 && <span className="avatar">+{names.length - 4}</span>}</div>;
}

export function Blank({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Empty className="blank"><EmptyHeader><EmptyMedia variant="icon"><ListTodo/></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{action}</Empty>;
}

export function PageTitle({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="title-actions">{actions}</div>}</div>;
}

export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  return <div className="table-footer"><span>{total === 0 ? '0' : Math.min(page * 12 + 1, total)}–{Math.min((page + 1) * 12, total)} of {total}</span><Pagination className="m-0 w-auto"><PaginationContent><PaginationItem><Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft/></Button></PaginationItem><PaginationItem><Button variant="outline" size="icon" aria-label="Next page" disabled={(page + 1) * 12 >= total} onClick={() => onChange(page + 1)}><ChevronRight/></Button></PaginationItem></PaginationContent></Pagination></div>;
}

export function TaskTable({ tasks, events, onOpen, compact = false }: { tasks: Task[]; events: EventRecord[]; onOpen: (task: Task) => void; compact?: boolean }) {
  const [search, setSearch] = useState(''), [status, setStatus] = useState('All statuses'), [owner, setOwner] = useState('all'), [page, setPage] = useState(0), [view, setView] = useState<ViewMode>(compact ? 'list' : 'tiles');
  const people = Object.fromEntries(tasks.flatMap(task => Object.entries(task.assigneeNames)));
  const rows = tasks.filter(task => (status === 'All statuses' || (status === 'Overdue' ? overdue(task) : task.status === status)) && (owner === 'all' || task.assigneeIds.includes(owner)) && [task.title, task.description, ...Object.values(task.assigneeNames), events.find(event => event.id === task.eventId)?.title].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(a.status === 'Complete') - Number(b.status === 'Complete') || a.deadline.localeCompare(b.deadline));
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1)), visible = rows.slice(safePage * 12, (safePage + 1) * 12);
  const controls = <div className="panel-toolbar"><SearchBox value={search} onChange={value => { setSearch(value); setPage(0); }} placeholder="Search tasks or people…"/><div className="filters"><Picker label="Task status" value={status} onChange={value => { setStatus(value); setPage(0); }} options={['All statuses', 'To do', 'In progress', 'Blocked', 'Complete', 'Overdue']}/>{!compact && <Picker label="Assignee filter" value={owner} onChange={value => { setOwner(value); setPage(0); }} options={[{ value: 'all', label: 'All people' }, ...Object.entries(people).map(([value, label]) => ({ value, label }))]}/>}<ViewToggle value={view} onChange={setView}/></div></div>;
  if (!rows.length) return <section className="panel">{controls}<Blank title={tasks.length ? 'No matching tasks' : 'No tasks yet'} description={tasks.length ? 'Try a different search or filter.' : 'New assignments will appear here.'}/></section>;
  return <section className="panel">{controls}{view === 'tiles' ? <div className="record-grid task-card-grid">{visible.map(task => <button className="record-card task-card" key={task.id} onClick={() => onOpen(task)}><div className="card-heading"><Status value={overdue(task) ? 'Overdue' : task.status}/><span className={'priority ' + task.priority.toLowerCase()}>{task.priority}</span></div><h3>{task.title}</h3><p>{events.find(event => event.id === task.eventId)?.title || 'Office task'}</p><div className="card-progress"><span>{completion(task)}% complete</span><Progress value={completion(task)}/></div><div className="card-footer"><span>{Object.values(task.assigneeNames).join(', ')}</span><strong>{dateLabel(task.deadline)}</strong></div></button>)}</div> : <Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Assignees</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead><TableHead>Progress</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader><TableBody>{visible.map(task => <TableRow key={task.id}><TableCell><button className="row-title" onClick={() => onOpen(task)}>{task.title}</button><span className="row-subtitle">{events.find(event => event.id === task.eventId)?.title || 'Office task'} <span className={'priority ' + task.priority.toLowerCase()}>{task.priority}</span></span></TableCell><TableCell><Avatars names={Object.values(task.assigneeNames)}/><span className="row-subtitle">{task.assigneeIds.length === 1 ? Object.values(task.assigneeNames)[0] : task.assigneeIds.length + ' people'}</span></TableCell><TableCell><Status value={overdue(task) ? 'Overdue' : task.status}/></TableCell><TableCell>{dateLabel(task.deadline)}</TableCell><TableCell><div className="task-progress"><Progress value={completion(task)}/><span>{completion(task)}%</span></div></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={'Open ' + task.title} onClick={() => onOpen(task)}><ArrowUpRight size={18}/></Button></TableCell></TableRow>)}</TableBody></Table>}<Pager page={safePage} total={rows.length} onChange={setPage}/></section>;
}

export function Gantt({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) {
  const [search, setSearch] = useState(''), [zoom, setZoom] = useState('Week');
  const rows = tasks.filter(task => [task.title, ...Object.values(task.assigneeNames)].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.start.localeCompare(b.start));
  if (!tasks.length) return <div className="panel"><Blank title="No timeline yet" description="Add office tasks with start dates and deadlines to build the team schedule."/></div>;
  const day = 86400000, parse = (value: string) => Date.parse(value + 'T00:00:00Z'), min = Math.min(...tasks.map(task => parse(task.start))), max = Math.max(...tasks.map(task => parse(task.deadline))), unit = zoom === 'Day' ? day : 7 * day, width = zoom === 'Day' ? 46 : 112, total = Math.max(4, Math.ceil((max - min + day) / unit)), canvas = total * width;
  return <div className="panel"><div className="panel-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search timeline…"/><Picker label="Timeline scale" value={zoom} onChange={setZoom} options={['Day', 'Week']}/></div><div className="gantt-scroll"><div style={{ minWidth: canvas + 260 }}><div className="gantt-header"><div className="gantt-label">TASK & OWNER</div><div className="gantt-axis" style={{ width: canvas }}>{Array.from({ length: total }, (_, index) => <span key={index} style={{ width }}>{new Date(min + index * unit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>)}</div></div>{rows.map(task => <div className="gantt-row" key={task.id}><button className="gantt-label" onClick={() => onOpen(task)}><strong>{task.title}</strong><span>{Object.values(task.assigneeNames).join(', ')}</span></button><div className="gantt-track" style={{ width: canvas, backgroundSize: width + 'px 100%' }}><button aria-label={task.title + ', ' + dateLabel(task.start) + ' to ' + dateLabel(task.deadline) + ', ' + task.status} className={'gantt-bar ' + (task.status === 'Complete' ? 'done' : overdue(task) ? 'late' : '')} style={{ left: (parse(task.start) - min) / unit * width, width: Math.max(24, (parse(task.deadline) - parse(task.start) + day) / unit * width) }} onClick={() => onOpen(task)}><span style={{ width: completion(task) + '%' }}/><b>{completion(task)}%</b></button></div></div>)}</div></div><div className="gantt-legend"><span><i/>Scheduled</span><span><i className="green"/>Complete</span><span><i className="red"/>Overdue</span><span>Dates in IST</span></div></div>;
}
