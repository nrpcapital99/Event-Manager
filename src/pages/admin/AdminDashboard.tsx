import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { Calendar, CheckSquare, Users, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';

// Placeholders for inner components
import AdminEvents from './AdminEvents';
import AdminTasks from './AdminTasks';
import AdminEmployees from './AdminEmployees';

const AdminOverview = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500">
      <Link to="/admin/events" className="glass p-8 hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] hover:-translate-y-1 transition-all duration-300 group">
        <div className="bg-primary/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Calendar size={32} className="text-primary" />
        </div>
        <h3 className="text-2xl font-semibold mb-3">Manage Events</h3>
        <p className="opacity-80">Create and oversee all events, timelines, and high-level details.</p>
      </Link>
      
      <Link to="/admin/tasks" className="glass p-8 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:-translate-y-1 transition-all duration-300 group">
        <div className="bg-pink-500/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <CheckSquare size={32} className="text-pink-500" />
        </div>
        <h3 className="text-2xl font-semibold mb-3">Manage Tasks</h3>
        <p className="opacity-80">Assign tasks, map equipment, and track progress on Gantt charts.</p>
      </Link>
      
      <Link to="/admin/employees" className="glass p-8 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1 transition-all duration-300 group">
        <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Users size={32} className="text-blue-500" />
        </div>
        <h3 className="text-2xl font-semibold mb-3">Manage Employees</h3>
        <p className="opacity-80">Generate access codes and manage event personnel.</p>
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
    { path: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/admin/employees', label: 'Employees', icon: Users },
  ];

  return (
    <div className="w-full max-w-7xl h-[90vh] flex flex-col md:flex-row gap-6 text-[var(--glass-text)]">
      
      {/* Sidebar Navigation */}
      <div className="glass w-full md:w-64 h-full flex flex-col justify-between p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-wider mb-8 text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500">
            EventManager
          </h2>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                    isActive ? 'bg-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-col gap-2 mt-auto">
          <button 
            onClick={toggleTheme} 
            className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            <span className="font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass flex-1 p-8 overflow-y-auto relative">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/events" element={<AdminEvents />} />
          <Route path="/tasks" element={<AdminTasks />} />
          <Route path="/employees" element={<AdminEmployees />} />
        </Routes>
      </div>

    </div>
  );
};

export default AdminDashboard;
