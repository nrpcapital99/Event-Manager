import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { getTaskStyles } from '../../lib/utils';

const AdminTasks = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const [newTask, setNewTask] = useState<{
    eventId: string;
    title: string;
    description: string;
    employeeIds: string[];
    category: string;
    dueDate: string;
  }>({
    eventId: '',
    title: '',
    description: '',
    employeeIds: [],
    category: 'logistics',
    dueDate: ''
  });

  const [selectedEventForGantt, setSelectedEventForGantt] = useState<string>('');

  // Auto-calculate suggested timeline when event or category changes
  useEffect(() => {
    if (newTask.eventId && newTask.category) {
      const parentEvent = events.find(e => e.id === newTask.eventId);
      if (parentEvent && parentEvent.eventDate) {
        const eventDate = parentEvent.eventDate.toDate();
        let daysToSubtract = 0;
        
        switch (newTask.category) {
          case 'marketing': daysToSubtract = 14; break;
          case 'equipment': daysToSubtract = 7; break;
          case 'logistics': daysToSubtract = 3; break;
          case 'catering': daysToSubtract = 10; break;
          case 'entertainment': daysToSubtract = 21; break;
          case 'security': daysToSubtract = 5; break;
          case 'seating': daysToSubtract = 1; break;
          default: daysToSubtract = 0;
        }
        
        const suggestedDate = new Date(eventDate);
        suggestedDate.setDate(suggestedDate.getDate() - daysToSubtract);
        
        // Format to YYYY-MM-DD for input type="date"
        const formattedDate = suggestedDate.toISOString().split('T')[0];
        setNewTask(prev => ({ ...prev, dueDate: formattedDate }));
      }
    }
  }, [newTask.eventId, newTask.category, events]);

  const fetchData = async () => {
    try {
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const fetchedEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(fetchedEvents);

      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      setTasks(tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const empSnapshot = await getDocs(collection(db, 'codes'));
      setEmployees(empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newTask.eventId) {
      setError('Please select an event.');
      return;
    }
    if (!newTask.dueDate) {
      setError('Please select a due date.');
      return;
    }

    try {
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        status: 'pending',
        completedBy: [],
        completedAt: null
      });
      setShowModal(false);
      setNewTask({ ...newTask, title: '', description: '', employeeIds: [], dueDate: '' });
      fetchData();
    } catch (err: any) {
      console.error("Error creating task", err);
      setError(err.message || "Failed to create task.");
    }
  };

  // Calculate relative timeline to the main event date
  const getRelativeTimeline = (task: any) => {
    const parentEvent = events.find(e => e.id === task.eventId);
    if (!parentEvent || !parentEvent.eventDate) return 'N/A';
    
    if (!task.dueDate) return 'No due date';
    const eventDate = parentEvent.eventDate.toDate();
    const taskEnd = new Date(task.dueDate);
    
    eventDate.setHours(0,0,0,0);
    taskEnd.setHours(0,0,0,0);
    
    const diffTime = eventDate.getTime() - taskEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `Due T-${diffDays} Days`;
    if (diffDays === 0) return `Due on Event Day`;
    return `Due T+${Math.abs(diffDays)} Days (Post Event)`;
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4">
        <h2 className="text-3xl font-bold">Manage Tasks & Logistics</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Add Task
        </button>
      </div>

      {/* Event Selector and Gantt Chart */}
      <div className="glass p-8 mb-8 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.1)]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-pink-500">
            Interactive Gantt Timeline
          </h3>
          <select 
            className="glass-input !w-auto bg-white dark:bg-black/20 font-medium"
            value={selectedEventForGantt}
            onChange={(e) => setSelectedEventForGantt(e.target.value)}
          >
            <option value="" className="text-black">Select Event to View</option>
            {events.map(ev => <option key={ev.id} value={ev.id} className="text-black">{ev.name}</option>)}
          </select>
        </div>
        
        {selectedEventForGantt ? (
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 text-[var(--glass-text)] border border-black/5 dark:border-white/5 relative min-h-[16rem]">
            {/* Simple CSS-based Gantt Chart */}
              {(() => {
                const eventTasks = tasks.filter(t => t.eventId === selectedEventForGantt).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                const eventDoc = events.find(e => e.id === selectedEventForGantt);
                
                if (eventTasks.length === 0) return <p className="opacity-50 text-center py-8 font-medium">No tasks found for this event.</p>;
                
                // Determine timeline boundaries
                const eventDate = eventDoc?.eventDate ? eventDoc.eventDate.toDate().getTime() : new Date().getTime();
                let minDate = eventDate;
                eventTasks.forEach(t => {
                   const tDate = new Date(t.dueDate).getTime();
                   if (tDate < minDate) minDate = tDate;
                });
                
                // Add some padding to minDate
                const totalDuration = (eventDate - minDate) || 1; // avoid divide by zero
                const totalDays = Math.max(1, Math.ceil(totalDuration / (1000 * 60 * 60 * 24)));
                
                // Generate X-Axis markers for EVERY day
                const markers = [];
                for (let i = 0; i <= totalDays; i++) {
                  const date = new Date(minDate + i * (1000 * 60 * 60 * 24));
                  markers.push({
                    percent: (i / totalDays) * 90, // Align with 90% scale
                    label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  });
                }
                
                return (
                  <div className="overflow-x-auto custom-scrollbar pb-4">
                    <div className="flex flex-col gap-3 relative z-10" style={{ minWidth: `${Math.max(600, totalDays * 60)}px` }}>
                      {/* X-Axis Dates */}
                      <div className="flex relative h-10 mb-2 ml-[8.5rem] border-b border-black/10 dark:border-white/10 z-20">
                        {markers.map((m, i) => (
                          <div key={i} className="absolute text-xs opacity-70 transform -translate-x-1/2 flex flex-col items-center" style={{ left: `${m.percent}%` }}>
                            <span className="font-medium bg-white/50 dark:bg-black/50 px-2 py-1 rounded backdrop-blur-sm whitespace-nowrap">{m.label}</span>
                            <div className="h-3 border-l border-black/20 dark:border-white/20 mt-1"></div>
                          </div>
                        ))}
                      </div>

                      {/* Background Grid Lines */}
                      <div className="absolute top-14 bottom-0 left-[8.5rem] right-[10%] pointer-events-none z-0">
                         {markers.map((m, i) => (
                           <div key={`grid-${i}`} className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5 border-dashed" style={{ left: `${(m.percent / 90) * 100}%` }}></div>
                         ))}
                      </div>

                      {/* Y-Axis Tasks */}
                      {eventTasks.map(task => {
                         const tDate = new Date(task.dueDate).getTime();
                         const percentStart = Math.max(0, ((tDate - minDate) / totalDuration) * 90); // cap at 90%
                         const styles = getTaskStyles(task);
                         
                         return (
                           <div key={task.id} className="flex items-center gap-4 group relative z-10">
                             <div className="w-32 text-right truncate text-sm font-medium">{task.title}</div>
                             <div className="flex-1 h-8 bg-black/5 dark:bg-white/5 rounded relative">
                               <div 
                                 className={`absolute top-1 bottom-1 ${styles.bar} rounded px-2 text-xs text-white flex items-center shadow-lg transition-all z-20`}
                                 style={{ left: `${percentStart}%`, width: '12%' }}
                               >
                                  <span className="truncate w-full block">
                                    {new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} ({getRelativeTimeline(task)})
                                  </span>
                               </div>
                             </div>
                           </div>
                         );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Timeline markers */}
            {events.find(e => e.id === selectedEventForGantt) && tasks.filter(t => t.eventId === selectedEventForGantt).length > 0 && (
              <div className="absolute right-[10%] top-0 bottom-0 border-l-2 border-dashed border-red-500/50 flex flex-col justify-end pb-2 z-0">
                <span className="text-xs text-red-500 font-bold ml-1 rotate-90 transform origin-left whitespace-nowrap translate-y-[-20px]">Event Day</span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-48 bg-black/5 dark:bg-black/20 rounded-lg flex items-center justify-center text-[var(--glass-text)] border border-black/5 dark:border-white/5 opacity-50 font-medium">
            <p>Please select an event above to view its Gantt timeline.</p>
          </div>
        )}
      </div>

      <div className="glass p-6">
        <h3 className="text-xl font-bold mb-4">All Tasks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/20 text-[var(--glass-text)] opacity-70">
                <th className="pb-3 font-medium">Task</th>
                <th className="pb-3 font-medium">Event</th>
                <th className="pb-3 font-medium">Assignee</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Timeline</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const parentEvent = events.find(e => e.id === task.eventId);
                const assignedEmps = task.employeeIds ? employees.filter(e => task.employeeIds.includes(e.id)) : [];
                
                return (
                  <tr key={task.id} className="border-b border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm opacity-60 truncate w-48">{task.description}</div>
                    </td>
                    <td className="py-4 font-medium opacity-80">
                      {parentEvent?.name || 'Unknown Event'}
                    </td>
                    <td className="py-4 opacity-80">
                      {assignedEmps.length > 0 
                        ? <div className="flex flex-wrap gap-1">{assignedEmps.map(emp => <span key={emp.id} className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">{emp.name}</span>)}</div> 
                        : <span className="text-black/50 dark:text-white/50 italic">Unassigned</span>}
                    </td>
                    <td className="py-4 capitalize">
                      <span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded text-xs">{task.category}</span>
                    </td>
                    <td className="py-4">
                      <div className="text-sm font-medium mb-1">{getRelativeTimeline(task)}</div>
                      <div className="text-xs opacity-60 font-mono">Due: {task.dueDate}</div>
                    </td>
                    <td className="py-4">
                      {(() => {
                        const styles = getTaskStyles(task);
                        return (
                          <span className={`${styles.badge} px-2 py-1 rounded text-xs uppercase tracking-wider font-bold inline-block`}>
                            {styles.label}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 && <p className="opacity-70 mt-4 text-center">No tasks assigned yet.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">Create New Task</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              
              <select required className="glass-input appearance-none bg-white dark:bg-black/20" value={newTask.eventId} onChange={e => setNewTask({...newTask, eventId: e.target.value})}>
                <option value="" disabled className="text-black">1. Select Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id} className="text-black">{ev.name}</option>)}
              </select>

              <input type="text" placeholder="Task Title (e.g. Setup Mics)" required className="glass-input" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              <textarea placeholder="Specific Details (e.g. Need 4 wireless mics for main stage)" required className="glass-input min-h-[80px]" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
              
              <div>
                <label className="text-sm font-medium mb-2 block opacity-80">2. Assign Employees (Must be in Event Team)</label>
                {!newTask.eventId ? (
                  <p className="text-xs text-red-500 font-medium p-2 bg-black/5 dark:bg-white/5 rounded">Please select an event first to see its assigned team members.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-2 border border-black/10 dark:border-white/10 p-2 rounded-lg">
                    {(() => {
                      const parentEv = events.find(e => e.id === newTask.eventId);
                      const availableEmps = employees.filter(emp => parentEv?.employeeIds?.includes(emp.id));
                      
                      if (availableEmps.length === 0) return <p className="text-xs opacity-50">No employees assigned to this event team. Go to Events to assign them.</p>;
                      
                      return availableEmps.map(emp => (
                        <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="accent-primary"
                            checked={newTask.employeeIds.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewTask({...newTask, employeeIds: [...newTask.employeeIds, emp.id]});
                              } else {
                                setNewTask({...newTask, employeeIds: newTask.employeeIds.filter(id => id !== emp.id)});
                              }
                            }}
                          />
                          <span className="text-sm">{emp.name} ({emp.role})</span>
                        </label>
                      ));
                    })()}
                  </div>
                )}
              </div>

              <select required className="glass-input appearance-none bg-white dark:bg-black/20" value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})}>
                <option value="logistics" className="text-black">Logistics (T-3)</option>
                <option value="equipment" className="text-black">Equipment & A/V (T-7)</option>
                <option value="marketing" className="text-black">Marketing (T-14)</option>
                <option value="catering" className="text-black">Catering & Food (T-10)</option>
                <option value="entertainment" className="text-black">Entertainment & Talent (T-21)</option>
                <option value="security" className="text-black">Security (T-5)</option>
                <option value="seating" className="text-black">Seating & Bookings (T-1)</option>
              </select>

              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Task Due Date (Auto-suggested based on category)</label>
                <input type="date" required className="glass-input" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              
              <div className="flex gap-4 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTasks;
