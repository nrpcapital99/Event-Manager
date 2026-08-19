import { useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, CheckSquare, Users, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';

// Placeholders for inner components
import AdminEvents from './AdminEvents';
import AdminTasks from './AdminTasks';
import AdminEmployees from './AdminEmployees';
import AdminClients from './AdminClients';
import AdminAttendees from './AdminAttendees';
import AdminResponsibilities from './AdminResponsibilities';
import AdminCommandBoard from './AdminCommandBoard';
import { Briefcase, ListOrdered, ClipboardList, Target } from 'lucide-react';

const AdminOverview = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500">
      <Link to="/admin/events" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Calendar size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Manage Events</h3>
        <p className="opacity-80">Create and oversee all events, timelines, and high-level details.</p>
      </Link>
      
      <Link to="/admin/attendees" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <ListOrdered size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Manage Attendees</h3>
        <p className="opacity-80">Track invites, RSVPs, and client attendance for events.</p>
      </Link>
      
      <Link to="/admin/tasks" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <CheckSquare size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Manage Tasks</h3>
        <p className="opacity-80">Assign tasks, map equipment, and track progress on Gantt charts.</p>
      </Link>
      
      <Link to="/admin/employees" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Users size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Manage Employees</h3>
        <p className="opacity-80">Generate access codes and manage event personnel.</p>
      </Link>
      
      <Link to="/admin/clients" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Briefcase size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Manage Clients</h3>
        <p className="opacity-80">Track clients, AUM, offices, and event attendance.</p>
      </Link>
      
      <Link to="/admin/responsibilities" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group">
        <div className="bg-[var(--paper)] p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <ClipboardList size={32} className="text-[var(--pine)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp">Responsibilities</h3>
        <p className="opacity-80">Assign event-day roles and filter tasks per team member.</p>
      </Link>
      
      <Link to="/admin/command-board" className="glass-panel hover:bg-[var(--paper)] transition-all duration-300 group border-red-500">
        <div className="bg-red-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Target size={32} className="text-[var(--red)]" />
        </div>
        <h3 className="text-2xl font-semibold mb-3 disp text-[var(--red)]">Command Board</h3>
        <p className="opacity-80">War room overview for event numbers, targets, and risks.</p>
      </Link>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { path: '/admin', label: 'Overview', icon: LayoutDashboard },
    { path: '/admin/events', label: 'Events', icon: Calendar },
    { path: '/admin/attendees', label: 'Attendees', icon: ListOrdered },
    { path: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/admin/employees', label: 'Employees', icon: Users },
    { path: '/admin/clients', label: 'Clients', icon: Briefcase },
    { path: '/admin/responsibilities', label: 'Responsibilities', icon: ClipboardList },
    { path: '/admin/command-board', label: 'Command Board', icon: Target },
  ];

  return (
    <div className="w-full max-w-7xl h-[90vh] flex flex-col md:flex-row gap-6 text-[var(--ink)]">
      
      {/* Sidebar Navigation */}
      <div className="glass-panel w-full md:w-64 h-full flex flex-col justify-between p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-wider mb-8 disp text-[var(--ink)]">
            NRP EventManager
          </h2>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[3px] transition-all duration-300 ${
                    isActive ? 'bg-[var(--pine)] text-[var(--chalk)]' : 'hover:bg-[var(--paper)]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-mono text-[11px] uppercase tracking-[.08em]">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-col gap-2 mt-auto">
          <button 
            onClick={toggleTheme} 
            className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--paper)] rounded-[3px] transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-mono text-[11px] uppercase tracking-[.08em]">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-4 py-3 text-[var(--red)] hover:bg-red-50 rounded-[3px] transition-colors"
          >
            <LogOut size={20} />
            <span className="font-mono text-[11px] uppercase tracking-[.08em]">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-panel flex-1 p-8 overflow-y-auto relative">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/events" element={<AdminEvents />} />
          <Route path="/attendees" element={<AdminAttendees />} />
          <Route path="/tasks" element={<AdminTasks />} />
          <Route path="/employees" element={<AdminEmployees />} />
          <Route path="/clients" element={<AdminClients />} />
          <Route path="/responsibilities" element={<AdminResponsibilities />} />
          <Route path="/command-board" element={<AdminCommandBoard />} />
        </Routes>
      </div>

    </div>
  );
};

export default AdminDashboard;
