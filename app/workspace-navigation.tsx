import { Building2, ContactRound, Wallet, House } from 'lucide-react';

export type Nav = 'overview' | 'events' | 'tasks' | 'clients' | 'expenses';
export const navItems = [
  { id: 'overview', label: 'Home', icon: House },
  { id: 'tasks', label: 'Office', icon: Building2 },
  { id: 'clients', label: 'Clients', icon: ContactRound },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
] as const;

export function WorkspaceNavigation({ nav }: { nav: Nav }) {
  return <nav className="main-navigation" aria-label="Main sections">
    {navItems.map(item =>
      <a key={item.id} href={'#' + item.id} aria-current={nav === item.id ? 'page' : undefined}>
        <item.icon size={21} /><span>{item.label}</span>
      </a>
    )}
  </nav>;
}
