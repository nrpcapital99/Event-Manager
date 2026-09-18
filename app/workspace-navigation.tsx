import { Building2, CalendarDays, ContactRound, Wallet, Users, ArrowUpRight, House } from 'lucide-react';
import { count } from '@/lib/model';

export type Nav = 'overview' | 'events' | 'tasks' | 'clients' | 'expenses' | 'people';
export const navItems = [
  { id: 'overview', label: 'Home', icon: House },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'tasks', label: 'Office', icon: Building2 },
  { id: 'clients', label: 'Clients', icon: ContactRound },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'people', label: 'Team', icon: Users },
] as const;

export function WorkspaceNavigation({ nav, admin }: { nav: Nav; admin: boolean }) {
  return <nav className="main-navigation" aria-label="Main sections">
    {navItems.filter(item => item.id !== 'people' || admin).map(item =>
      <a key={item.id} href={'#' + item.id} aria-current={nav === item.id ? 'page' : undefined}>
        <item.icon size={21} /><span>{item.label}</span>
      </a>
    )}
  </nav>;
}

export function WorkspaceStart({ admin, activeEvents, officeTasks }: { admin: boolean; activeEvents: number; officeTasks: number }) {
  return <section aria-labelledby="start-heading" className="workspace-start">
    <div className="start-heading"><span className="eyebrow">YOUR WORKSPACE</span><h1 id="start-heading">What are you working on?</h1><p>Choose a section to get started.</p></div>
    <div className="workspace-choices">
      <a href="#events" className="workspace-choice event-choice">
        <span className="choice-icon"><CalendarDays /></span><span className="choice-count">{count(activeEvents, 'active event')}</span>
        <h2>Events</h2><p>Plan an event, assign work, manage guests, and track event expenses.</p>
        <span className="choice-action">Open events <ArrowUpRight size={20} /></span>
      </a>
      <a href="#tasks" className="workspace-choice office-choice">
        <span className="choice-icon"><Building2 /></span><span className="choice-count">{count(officeTasks, 'open office task')}</span>
        <h2>Office</h2><p>Manage everyday tasks, see who is responsible, and follow deadlines.</p>
        <span className="choice-action">Open office <ArrowUpRight size={20} /></span>
      </a>
    </div>
    <div className="workspace-shortcuts">
      <a href="#clients"><ContactRound /><div><strong>Clients</strong><p>Contact details for all your events</p></div><ArrowUpRight /></a>
      <a href="#expenses"><Wallet /><div><strong>Expenses</strong><p>{admin ? 'All office and event spending' : 'Your office and event spending'}</p></div><ArrowUpRight /></a>
      {admin && <a href="#people"><Users /><div><strong>Team</strong><p>Add employees and manage access</p></div><ArrowUpRight /></a>}
    </div>
  </section>;
}
