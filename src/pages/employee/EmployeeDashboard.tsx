import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getTaskStyles, groupEvents } from '../../lib/utils';
import '../admin/AdminCommandBoard.css';
import AdminCommandBoard from '../admin/AdminCommandBoard';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const employeeData = location.state?.employeeData;

  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
  const [remarksDrafts, setRemarksDrafts] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'command-board' | 'deadlines'>('command-board');

  useEffect(() => {
    if (!employeeData.id) {
      navigate('/login');
      return;
    }

    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const allEvents: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter events where the employee is assigned
      const myEvents = allEvents.filter(ev => ev.employeeIds?.includes(employeeData.id));
      setEvents(myEvents);
      
      // Auto-select if there's only one, or if current selection is invalid
      if (myEvents.length > 0 && (!selectedEventId || !myEvents.find(e => e.id === selectedEventId))) {
        setSelectedEventId(myEvents[0].id);
      }
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEmployees = onSnapshot(collection(db, 'codes'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubEvents();
      unsubTasks();
      unsubEmployees();
    };
  }, [employeeData.id, navigate, selectedEventId]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleToggleTaskStatus = async (task: any) => {
    let newCompletedBy = task.completedBy || [];
    
    if (newCompletedBy.includes(employeeData.id)) {
      // Unmark complete (withdraw consensus)
      newCompletedBy = newCompletedBy.filter((id: string) => id !== employeeData.id);
      await updateDoc(doc(db, 'tasks', task.id), { 
        completedBy: newCompletedBy,
        status: 'pending'
      });
    } else {
      // Mark complete
      newCompletedBy = [...newCompletedBy, employeeData.id];
      const allDone = task.employeeIds.every((id: string) => newCompletedBy.includes(id));
      
      const updates: any = { completedBy: newCompletedBy };
      if (allDone) {
        updates.status = 'completed';
        updates.completedAt = new Date();
      }
      await updateDoc(doc(db, 'tasks', task.id), updates);
    }
  };

  const handleSaveRemark = async (taskId: string, currentRemarks: string) => {
    const newRemark = remarksDrafts[taskId];
    if (newRemark === undefined || currentRemarks === newRemark) return; // no change
    await updateDoc(doc(db, 'tasks', taskId), { remarks: newRemark });
  };

  const handleAddExpense = async () => {
    if (!selectedEventId || !newExpense.description || !newExpense.amount) return;
    
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return;

    const expense = {
      id: Date.now().toString(),
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      addedBy: employeeData.name, // Tag the employee's name
      date: new Date().toISOString()
    };

    const currentExpenses = event.expenses || [];
    await updateDoc(doc(db, 'events', selectedEventId), {
      expenses: [...currentExpenses, expense]
    });

    setNewExpense({ description: '', amount: '' });
  };

  // Helper for Gantt
  const getRelativeTimeline = (task: any, parentEvent: any) => {
    if (!parentEvent || !parentEvent.eventDate) return 'N/A';
    if (!task.dueDate) return 'No due date';
    const eventDate = parentEvent.eventDate.toDate();
    const taskEnd = new Date(task.dueDate);
    
    if (isNaN(taskEnd.getTime())) return 'Invalid due date';
    
    eventDate.setHours(0,0,0,0);
    taskEnd.setHours(0,0,0,0);
    
    const diffTime = eventDate.getTime() - taskEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `T-${diffDays}`;
    if (diffDays === 0) return `Event Day`;
    return `T+${Math.abs(diffDays)}`;
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventTasks = selectedEvent ? tasks.filter(t => t.eventId === selectedEventId).sort((a, b) => {
    const timeA = new Date(a.dueDate).getTime();
    const timeB = new Date(b.dueDate).getTime();
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    return timeA - timeB;
  }) : [];
  
  const myTasks = eventTasks.filter(t => t.employeeIds?.includes(employeeData.id));
  const otherTasks = eventTasks.filter(t => !t.employeeIds?.includes(employeeData.id));

  // Gantt Chart Rendering Logic
  const renderGanttChart = () => {
    if (!selectedEvent) return null;
    if (eventTasks.length === 0) return <p className="opacity-50 text-center py-8 font-medium">No tasks found for this event.</p>;
    
    const eventDate = selectedEvent.eventDate ? selectedEvent.eventDate.toDate().getTime() : new Date().getTime();
    let minDate = eventDate;
    eventTasks.forEach(t => {
       if (!t.dueDate) return;
       const tDate = new Date(t.dueDate).getTime();
       if (!isNaN(tDate) && tDate < minDate) minDate = tDate;
    });
    
    const totalDuration = (eventDate - minDate) || 1; 
    const totalDays = Math.max(1, Math.ceil(totalDuration / (1000 * 60 * 60 * 24)));
    
    const markers = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(minDate + i * (1000 * 60 * 60 * 24));
      markers.push({
        percent: (i / totalDays) * 90, 
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      });
    }
    
    return (
      <div className="bg-black/5 dark:bg-black/20 rounded-lg p-4 text-[var(--glass-text)] border border-black/5 dark:border-white/5 overflow-x-auto custom-scrollbar relative min-h-[16rem]">
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
             const percentStart = Math.max(0, ((tDate - minDate) / totalDuration) * 90);
             const styles = getTaskStyles(task);
             
             return (
               <div key={task.id} className="flex items-center gap-4 group relative z-10">
                 <div className="w-32 text-right truncate text-sm font-medium">{task.title}</div>
                 <div className="flex-1 h-8 bg-black/5 dark:bg-white/5 rounded relative">
                   <div 
                     className={`absolute top-1 bottom-1 rounded px-2 text-xs text-white flex items-center shadow-lg transition-all z-20 ${styles.bar}`}
                     style={{ left: `${percentStart}%`, width: '12%' }}
                   >
                      <span className="truncate w-full block">
                        {new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} ({getRelativeTimeline(task, selectedEvent)})
                      </span>
                   </div>
                 </div>
               </div>
             );
          })}
        </div>
      </div>
    );
  };

  if (events.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto command-board-theme command-board-wrap relative overflow-hidden min-h-[90vh] animate-in fade-in duration-500 !p-6">
        <header className="flex justify-between items-end mb-6 pb-4 border-b-2 border-[var(--ink)]">
          <div>
            <div className="eyebrow !text-[var(--ink)] mb-1">Employee Workspace / {employeeData.name}</div>
            <h1 className="text-3xl leading-none m-0 p-0">No Assignments</h1>
          </div>
          <button onClick={handleLogout} className="btn-secondary !border-[var(--red)] !text-[var(--red)] !bg-transparent hover:!bg-[#FBF0EE]">
            Sign Out
          </button>
        </header>
        <div className="glass-panel text-center py-12">
          <h3 className="disp text-xl mb-2">No Events Assigned</h3>
          <p className="text-[var(--soft)] font-mono text-sm">You are currently not assigned to any events. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const renderHeaderActions = () => (
    <div className="flex items-center gap-4">
      <div className="flex bg-[var(--rule)] rounded-[3px] p-0.5">
        <button 
          onClick={() => setViewMode('command-board')}
          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-[2px] transition-colors ${viewMode === 'command-board' ? 'bg-[var(--chalk)] shadow-sm' : 'text-[var(--soft)] hover:text-[var(--ink)]'}`}
        >
          Command Board
        </button>
        <button 
          onClick={() => setViewMode('deadlines')}
          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded-[2px] transition-colors ${viewMode === 'deadlines' ? 'bg-[var(--chalk)] shadow-sm' : 'text-[var(--soft)] hover:text-[var(--ink)]'}`}
        >
          Deadlines
        </button>
      </div>
      <select 
        className="cb-select !text-sm !py-1.5"
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
      >
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
      <button onClick={handleLogout} className="btn-secondary !border-[var(--red)] !text-[var(--red)] !bg-transparent hover:!bg-[#FBF0EE]">
        Sign Out
      </button>
    </div>
  );

  return (
    <AdminCommandBoard 
      isEmployeeMode={true} 
      syncEventId={selectedEventId} 
      employeeData={employeeData}
      renderHeaderActions={renderHeaderActions}
      hideTeamTasks={viewMode === 'deadlines'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Live Gantt Chart Section */}
          <div className="glass-panel !p-5">
            <div className="flex justify-between items-end mb-4 border-b border-[var(--rule)] pb-2">
              <h2 className="disp text-lg text-[var(--pine)] flex items-center gap-2 m-0">
                Live Gantt Timeline
                <span className="bg-[var(--pine)] text-white font-mono text-[9px] px-1.5 py-0.5 rounded-sm animate-pulse uppercase tracking-wider">Live</span>
              </h2>
            </div>
            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
              {renderGanttChart()}
            </div>
          </div>

          {viewMode === 'deadlines' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* My Tasks */}
              <div className="glass-panel !p-5 !border-t-2 !border-t-[var(--plum)]">
                <h3 className="disp text-lg mb-4 border-b border-[var(--rule)] pb-2">My Tasks</h3>
                {myTasks.length === 0 ? (
                  <p className="text-[var(--soft)] font-mono text-xs">You have no tasks for this event.</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {myTasks.map(task => {
                      const styles = getTaskStyles(task);
                      const iHaveCompleted = task.completedBy?.includes(employeeData.id);
                      
                      return (
                      <div key={task.id} className={`p-3 border rounded-[3px] transition-all ${task.status === 'completed' ? 'bg-[#EDF2EE] border-[var(--pine-lt)]' : 'bg-[var(--chalk)] border-[var(--rule)]'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm block leading-tight">{task.title}</span>
                          <span className={`${styles.badge} px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-mono`}>
                            {styles.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--soft)] mb-2 leading-snug">{task.description}</p>
                        
                        <textarea 
                          className="w-full text-xs p-2 rounded-[2px] bg-[var(--paper)] border border-[var(--rule)] min-h-[45px] mb-2 font-mono text-[var(--ink)] resize-none"
                          placeholder="Updates / issues..."
                          value={remarksDrafts[task.id] !== undefined ? remarksDrafts[task.id] : (task.remarks || '')}
                          onChange={(e) => setRemarksDrafts(prev => ({...prev, [task.id]: e.target.value}))}
                          onBlur={() => handleSaveRemark(task.id, task.remarks || '')}
                        />
                        
                        <div className="flex items-center justify-between border-t border-[var(--rule)] pt-2 mt-1">
                          <span className="font-mono text-[10px] text-[var(--soft)]">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                          <button 
                            onClick={() => handleToggleTaskStatus(task)}
                            className={`text-[10px] px-2 py-1 rounded-[2px] font-mono uppercase tracking-wider transition-all ${iHaveCompleted ? 'bg-[var(--rule)] text-[var(--ink)] hover:bg-[var(--soft)] hover:text-[var(--chalk)]' : 'bg-[var(--plum)] text-[var(--chalk)] hover:bg-[var(--plum-lt)]'}`}
                          >
                            {iHaveCompleted ? 'Undo' : 'Complete'}
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {/* Team Tasks */}
              <div className="glass-panel !p-5">
                <h3 className="disp text-lg mb-4 border-b border-[var(--rule)] pb-2 text-[var(--soft)]">Team Tasks</h3>
                {otherTasks.length === 0 ? (
                  <p className="text-[var(--soft)] font-mono text-xs">No other tasks assigned to the team.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {otherTasks.map(task => {
                      const assignedEmps = employees.filter(emp => task.employeeIds?.includes(emp.id));
                      return (
                        <div key={task.id} className="p-2 border border-[var(--rule)] rounded-[2px] bg-[var(--chalk)] text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium truncate pr-2">{task.title}</span>
                          </div>
                          <div className="font-mono text-[9px] text-[var(--soft)] mb-1.5">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                          
                          <div className="flex flex-wrap gap-1">
                            {assignedEmps.length > 0 ? assignedEmps.map(emp => (
                              <span key={emp.id} className="font-mono text-[9px] bg-[var(--paper)] px-1.5 py-0.5 rounded-[2px] text-[var(--ink)] border border-[var(--rule)]">
                                {emp.name}
                              </span>
                            )) : (
                              <span className="font-mono text-[9px] italic text-[var(--soft)]">Unassigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Event Expenses */}
          <div className="glass-panel !p-5 !border-l-4 !border-l-[var(--pine)] h-full">
            <h3 className="disp text-lg mb-2">Expenses</h3>
            <p className="text-[var(--soft)] text-xs mb-4">Submit expenses for admin review.</p>
            
            <div className="flex flex-col gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Description (e.g. Uber)" 
                className="glass-input !text-sm !p-2" 
                value={newExpense.description} 
                onChange={e => setNewExpense({...newExpense, description: e.target.value})} 
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="₹ Amount" 
                  className="glass-input !text-sm !p-2 flex-1" 
                  value={newExpense.amount} 
                  onChange={e => setNewExpense({...newExpense, amount: e.target.value})} 
                />
                <button onClick={handleAddExpense} className="btn-primary !bg-[var(--pine)] !text-[11px] !px-3">Submit</button>
              </div>
            </div>
            
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--soft)] mb-2 border-b border-[var(--rule)] pb-1">Your Logged Expenses</h4>
            {(selectedEvent?.expenses || []).filter((exp: any) => exp.addedBy === employeeData.name).length === 0 ? (
              <p className="text-[var(--soft)] font-mono text-[10px] italic">No expenses logged.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {(selectedEvent?.expenses || [])
                  .filter((exp: any) => exp.addedBy === employeeData.name)
                  .map((exp: any) => (
                  <div key={exp.id} className="flex justify-between items-center text-sm border-b border-[var(--rule)] pb-1">
                    <div>
                      <div className="font-medium text-xs leading-tight">{exp.description}</div>
                      <div className="font-mono text-[9px] text-[var(--soft)]">{new Date(exp.date).toLocaleDateString()}</div>
                    </div>
                    <div className="font-mono font-bold text-[var(--pine)] text-sm">₹{exp.amount.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </AdminCommandBoard>
  );
};

export default EmployeeDashboard;
