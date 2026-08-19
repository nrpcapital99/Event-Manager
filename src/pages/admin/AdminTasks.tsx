import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { getTaskStyles, groupEvents } from '../../lib/utils';

const AdminTasks = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState('priority'); // 'priority' or 'dueDate' or 'category'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newTask, setNewTask] = useState<{
    eventId: string;
    title: string;
    description: string;
    employeeIds: string[];
    category: string;
    dueDate: string;
    manualColor: string;
    priorityOrder: number;
  }>({
    eventId: '',
    title: '',
    description: '',
    employeeIds: [],
    category: 'logistics',
    dueDate: '',
    manualColor: '',
    priorityOrder: 1
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

  const handleSaveTask = async (e: React.FormEvent) => {
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
      const batch = writeBatch(db);
      
      const eventTasks = tasks.filter(t => t.eventId === newTask.eventId);
      const targetPriority = Number(newTask.priorityOrder) || 1;
      
      const isEdit = !!editingTask;
      const oldPriority = isEdit ? editingTask.priorityOrder : null;
      
      if (!isEdit || oldPriority !== targetPriority) {
        eventTasks.forEach(t => {
          if (isEdit && t.id === editingTask.id) return;
          
          let p = t.priorityOrder;
          if (isEdit && oldPriority) {
            if (oldPriority > targetPriority && p >= targetPriority && p < oldPriority) {
              p++;
            } else if (oldPriority < targetPriority && p > oldPriority && p <= targetPriority) {
              p--;
            }
          } else {
            if (p >= targetPriority) {
              p++;
            }
          }
          
          if (p !== t.priorityOrder) {
            batch.update(doc(db, 'tasks', t.id), { priorityOrder: p });
          }
        });
      }

      if (isEdit) {
        batch.update(doc(db, 'tasks', editingTask.id), {
          ...newTask,
          priorityOrder: targetPriority
        });
      } else {
        const newTaskRef = doc(collection(db, 'tasks'));
        batch.set(newTaskRef, {
          ...newTask,
          status: 'pending',
          completedBy: [],
          completedAt: null,
          priorityOrder: targetPriority
        });
      }
      
      await batch.commit();

      setShowModal(false);
      setEditingTask(null);
      setNewTask({ eventId: '', title: '', description: '', employeeIds: [], category: 'logistics', dueDate: '', manualColor: '', priorityOrder: 1 });
      fetchData();
    } catch (err: any) {
      console.error("Error saving task", err);
      setError(err.message || "Failed to save task.");
    }
  };

  // Calculate relative timeline to the main event date
  const getRelativeTimeline = (task: any) => {
    const parentEvent = events.find(e => e.id === task.eventId);
    if (!parentEvent || !parentEvent.eventDate) return 'N/A';
    
    if (!task.dueDate) return 'No due date';
    const eventDate = parentEvent.eventDate.toDate();
    const taskEnd = new Date(task.dueDate);
    
    if (isNaN(taskEnd.getTime())) return 'Invalid due date';
    
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
        <button onClick={() => {
          setEditingTask(null);
          setNewTask({ eventId: selectedEventForGantt || '', title: '', description: '', employeeIds: [], category: 'logistics', dueDate: '', manualColor: '', priorityOrder: (tasks.filter(t => t.eventId === selectedEventForGantt).length || 0) + 1 });
          setShowModal(true);
        }} className="btn-primary">
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
            <option value="" className="bg-white dark:bg-slate-900 text-black dark:text-white">Select Event to View</option>
            {(() => {
              const { upcoming, past } = groupEvents(events);
              return (
                <>
                  {upcoming.length > 0 && (
                    <optgroup label="Upcoming Events">
                      {upcoming.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </optgroup>
                  )}
                  {past.length > 0 && (
                    <optgroup label="Past Events">
                      {past.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
        </div>
        
        {selectedEventForGantt ? (
          <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 text-[var(--glass-text)] border border-black/5 dark:border-white/5 relative min-h-[16rem]">
            {/* Simple CSS-based Gantt Chart */}
              {(() => {
                const eventTasks = tasks.filter(t => t.eventId === selectedEventForGantt).sort((a, b) => {
                  const timeA = new Date(a.dueDate).getTime();
                  const timeB = new Date(b.dueDate).getTime();
                  if (isNaN(timeA) && isNaN(timeB)) return 0;
                  if (isNaN(timeA)) return 1; // Put invalid dates at the end
                  if (isNaN(timeB)) return -1;
                  return timeA - timeB;
                });
                const eventDoc = events.find(e => e.id === selectedEventForGantt);
                
                if (eventTasks.length === 0) return <p className="opacity-50 text-center py-8 font-medium">No tasks found for this event.</p>;
                
                // Determine timeline boundaries
                const eventDate = eventDoc?.eventDate ? eventDoc.eventDate.toDate().getTime() : new Date().getTime();
                let minDate = eventDate;
                eventTasks.forEach(t => {
                   if (!t.dueDate) return;
                   const tDate = new Date(t.dueDate).getTime();
                   if (!isNaN(tDate) && tDate < minDate) minDate = tDate;
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-xl font-bold">Event Task Board</h3>
          
          {selectedEventForGantt && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="opacity-70">Sort By:</span>
                <select className="glass-input !w-auto !py-1" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="priority" className="bg-white dark:bg-slate-900 text-black dark:text-white">Priority Order</option>
                  <option value="dueDate" className="bg-white dark:bg-slate-900 text-black dark:text-white">Due Date</option>
                  <option value="category" className="bg-white dark:bg-slate-900 text-black dark:text-white">Category</option>
                </select>
              </div>
              
              <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-md transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-md' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                >
                  Tile
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-md transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
                >
                  List
                </button>
              </div>
            </div>
          )}
        </div>
        
        {!selectedEventForGantt ? (
          <p className="opacity-70 text-center py-8">Select an event above to view and sort its tasks.</p>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}>
            {tasks
              .filter(t => t.eventId === selectedEventForGantt)
              .sort((a, b) => {
                if (sortBy === 'dueDate') {
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                } else if (sortBy === 'category') {
                  return (a.category || '').localeCompare(b.category || '');
                }
                return (a.priorityOrder || 0) - (b.priorityOrder || 0);
              })
              .map(task => {
                const assignedEmps = task.employeeIds ? employees.filter(e => task.employeeIds.includes(e.id)) : [];
                const styles = getTaskStyles(task);
                
                if (viewMode === 'list') {
                  return (
                    <div key={task.id} className="p-4 border border-black/10 dark:border-white/10 rounded-lg bg-black/5 dark:bg-white/5 hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="bg-black/10 dark:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{task.priorityOrder || '-'}</span>
                        <div>
                          <div className="font-bold text-lg mb-1">{task.title}</div>
                          <div className="text-sm opacity-80">{task.description}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
                        <span className={`${styles.badge} px-2 py-1 rounded text-xs uppercase tracking-wider font-bold shrink-0`}>
                          {styles.label}
                        </span>
                        
                        <div className="flex -space-x-2 mr-2">
                          {assignedEmps.length > 0 ? (
                            assignedEmps.map(emp => (
                              <div key={emp.id} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-primary" title={emp.name}>
                                {emp.name.substring(0, 2).toUpperCase()}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs italic opacity-50 px-2">Unassigned</span>
                          )}
                        </div>
                        
                        <div className="text-xs opacity-70 text-right min-w-[120px]">
                          <div>Due: {task.dueDate}</div>
                          <div className="font-medium text-pink-500">{getRelativeTimeline(task)}</div>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setEditingTask(task);
                            setNewTask({
                              eventId: task.eventId,
                              title: task.title,
                              description: task.description,
                              employeeIds: task.employeeIds || [],
                              category: task.category || 'logistics',
                              dueDate: task.dueDate || '',
                              manualColor: task.manualColor || '',
                              priorityOrder: task.priorityOrder || 1
                            });
                            setShowModal(true);
                          }}
                          className="px-3 py-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded font-medium text-sm transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={task.id} 
                    className="p-5 border border-black/10 dark:border-white/10 rounded-lg bg-black/5 dark:bg-white/5 hover:shadow-lg transition-all flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-black/10 dark:bg-white/10 w-6 h-6 rounded flex items-center justify-center font-bold text-xs">{task.priorityOrder || '-'}</span>
                        <div className="font-bold text-lg">{task.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${styles.badge} px-2 py-1 rounded text-xs uppercase tracking-wider font-bold`}>
                          {styles.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm opacity-80 mb-4">{task.description}</p>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {assignedEmps.length > 0 ? (
                        assignedEmps.map(emp => (
                          <span key={emp.id} className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                            {emp.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic opacity-50">Unassigned</span>
                      )}
                    </div>
                    
                    {task.remarks && (
                      <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 p-2 rounded text-xs opacity-90">
                        <span className="font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 block mb-1">Remarks / Update:</span>
                        {task.remarks}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs opacity-70 border-t border-black/10 dark:border-white/10 pt-3 mt-auto">
                      <span>{getRelativeTimeline(task)}</span>
                      <div className="flex items-center gap-4">
                        <span>Due: {task.dueDate}</span>
                        <button 
                          onClick={() => {
                            setEditingTask(task);
                            setNewTask({
                              eventId: task.eventId,
                              title: task.title,
                              description: task.description,
                              employeeIds: task.employeeIds || [],
                              category: task.category || 'logistics',
                              dueDate: task.dueDate || '',
                              manualColor: task.manualColor || '',
                              priorityOrder: task.priorityOrder || 1
                            });
                            setShowModal(true);
                          }}
                          className="text-pink-500 hover:text-pink-600 font-bold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
            })}
            
            {tasks.filter(t => t.eventId === selectedEventForGantt).length === 0 && (
              <p className="opacity-70 col-span-full text-center py-4">No tasks found for this event.</p>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSaveTask} className="space-y-4">
              
              <select required className="glass-input appearance-none bg-white dark:bg-black/20" value={newTask.eventId} onChange={e => setNewTask({...newTask, eventId: e.target.value})}>
                <option value="" disabled className="bg-white dark:bg-slate-900 text-black dark:text-white">1. Select Event</option>
                {(() => {
                  const { upcoming, past } = groupEvents(events);
                  return (
                    <>
                      {upcoming.length > 0 && (
                        <optgroup label="Upcoming Events">
                          {upcoming.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                        </optgroup>
                      )}
                      {past.length > 0 && (
                        <optgroup label="Past Events">
                          {past.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>

              <input type="text" placeholder="Task Title (e.g. Setup Mics)" required className="glass-input" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
              <textarea placeholder="Specific Details (e.g. Need 4 wireless mics for main stage)" required className="glass-input min-h-[80px]" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
              
              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Priority Order (1 = Highest)</label>
                <input type="number" min="1" required className="glass-input" value={newTask.priorityOrder} onChange={e => setNewTask({...newTask, priorityOrder: parseInt(e.target.value) || 1})} />
              </div>
              
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
                <option value="logistics" className="bg-white dark:bg-slate-900 text-black dark:text-white">Logistics (T-3)</option>
                <option value="equipment" className="bg-white dark:bg-slate-900 text-black dark:text-white">Equipment & A/V (T-7)</option>
                <option value="marketing" className="bg-white dark:bg-slate-900 text-black dark:text-white">Marketing (T-14)</option>
                <option value="catering" className="bg-white dark:bg-slate-900 text-black dark:text-white">Catering & Food (T-10)</option>
                <option value="entertainment" className="bg-white dark:bg-slate-900 text-black dark:text-white">Entertainment & Talent (T-21)</option>
                <option value="security" className="bg-white dark:bg-slate-900 text-black dark:text-white">Security (T-5)</option>
                <option value="seating" className="bg-white dark:bg-slate-900 text-black dark:text-white">Seating & Bookings (T-1)</option>
              </select>

              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Task Due Date (Auto-suggested based on category)</label>
                <input type="date" required className="glass-input" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Manual Color Override (Optional)</label>
                <select className="glass-input appearance-none bg-white dark:bg-black/20" value={newTask.manualColor} onChange={e => setNewTask({...newTask, manualColor: e.target.value})}>
                  <option value="" className="bg-white dark:bg-slate-900 text-black dark:text-white">Auto (Based on Timeline)</option>
                  <option value="amber" className="bg-white dark:bg-slate-900 text-black dark:text-white">Amber (Pending)</option>
                  <option value="red" className="bg-white dark:bg-slate-900 text-black dark:text-white">Red (Overdue)</option>
                  <option value="green" className="bg-white dark:bg-slate-900 text-black dark:text-white">Green (Completed On Time)</option>
                  <option value="yellow" className="bg-white dark:bg-slate-900 text-black dark:text-white">Yellow (Completed Late)</option>
                  <option value="blue" className="bg-white dark:bg-slate-900 text-black dark:text-white">Custom Blue</option>
                  <option value="purple" className="bg-white dark:bg-slate-900 text-black dark:text-white">Custom Purple</option>
                </select>
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
