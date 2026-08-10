import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getTaskStyles } from '../../lib/utils';

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const employeeData = location.state?.employeeData || { name: 'Employee', id: '' };

  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
  const [remarksDrafts, setRemarksDrafts] = useState<Record<string, string>>({});

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
    
    eventDate.setHours(0,0,0,0);
    taskEnd.setHours(0,0,0,0);
    
    const diffTime = eventDate.getTime() - taskEnd.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `T-${diffDays}`;
    if (diffDays === 0) return `Event Day`;
    return `T+${Math.abs(diffDays)}`;
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventTasks = selectedEvent ? tasks.filter(t => t.eventId === selectedEventId).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) : [];
  
  const myTasks = eventTasks.filter(t => t.employeeIds?.includes(employeeData.id));
  const otherTasks = eventTasks.filter(t => !t.employeeIds?.includes(employeeData.id));

  // Gantt Chart Rendering Logic
  const renderGanttChart = () => {
    if (!selectedEvent) return null;
    if (eventTasks.length === 0) return <p className="opacity-50 text-center py-8 font-medium">No tasks found for this event.</p>;
    
    const eventDate = selectedEvent.eventDate ? selectedEvent.eventDate.toDate().getTime() : new Date().getTime();
    let minDate = eventDate;
    eventTasks.forEach(t => {
       const tDate = new Date(t.dueDate).getTime();
       if (tDate < minDate) minDate = tDate;
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

  return (
    <div className="w-full max-w-6xl glass-panel relative overflow-hidden min-h-[80vh] animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {employeeData.name}</h1>
          <p className="opacity-70 mt-1">Employee Workspace</p>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-500/20 transition-colors">
          Sign Out
        </button>
      </div>
      
      {events.length === 0 ? (
        <div className="glass p-12 text-center border border-pink-500/20">
          <h3 className="text-2xl font-bold mb-2">No Events Assigned</h3>
          <p className="opacity-70">You are currently not assigned to any events. Please contact your administrator.</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <label className="block text-sm font-bold opacity-70 uppercase tracking-wider mb-2">Select Event Workspace</label>
            <select 
              className="glass-input !w-auto bg-white/50 dark:bg-black/20 font-bold text-xl px-4 py-3 border-pink-500/30"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.map(ev => <option key={ev.id} value={ev.id} className="text-black">{ev.name}</option>)}
            </select>
          </div>

          {/* Live Gantt Chart Section */}
          <div className="glass p-8 mb-8 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.1)]">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-pink-500">
              Live Gantt Timeline
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider font-bold">Live</span>
            </h3>
            {renderGanttChart()}
          </div>
          
          {/* Event Expenses */}
          <div className="glass p-6 mb-8 border-l-4 border-l-green-500">
            <h3 className="text-2xl font-bold mb-4">Event Expenses</h3>
            <p className="opacity-70 text-sm mb-4">Submit expenses for this event. These will be reviewed by the event administrators.</p>
            
            <div className="flex gap-4 mb-6 flex-wrap">
              <input type="text" placeholder="Expense description (e.g. Uber, Catering supplies)" className="glass-input flex-1 min-w-[200px]" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
              <input type="number" placeholder="Amount ($)" className="glass-input w-32" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
              <button onClick={handleAddExpense} className="btn-primary whitespace-nowrap bg-green-500 hover:bg-green-600 text-white">Submit Expense</button>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider opacity-50">Recent Expenses Logged by You</h4>
              {(selectedEvent?.expenses || []).filter((exp: any) => exp.addedBy === employeeData.name).length === 0 ? (
                <p className="text-sm opacity-50 italic">You haven't logged any expenses for this event yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10 opacity-70">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedEvent?.expenses || [])
                        .filter((exp: any) => exp.addedBy === employeeData.name)
                        .map((exp: any) => (
                        <tr key={exp.id} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 opacity-70">{new Date(exp.date).toLocaleDateString()}</td>
                          <td className="py-2 font-medium">{exp.description}</td>
                          <td className="py-2 font-mono text-right text-green-600 dark:text-green-400 font-bold">${exp.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* My Tasks */}
            <div className="glass p-6 border-t-4 border-t-pink-500">
              <h3 className="text-2xl font-bold mb-4">My Tasks</h3>
              {myTasks.length === 0 ? (
                <p className="opacity-50 text-sm">You have no tasks for this event.</p>
              ) : (
                <div className="space-y-4">
                  {myTasks.map(task => {
                    const styles = getTaskStyles(task);
                    const iHaveCompleted = task.completedBy?.includes(employeeData.id);
                    const assignedEmps = employees.filter(emp => task.employeeIds?.includes(emp.id));
                    
                    return (
                    <div key={task.id} className={`p-4 border rounded-lg transition-all ${task.status === 'completed' ? 'bg-green-500/5 border-green-500/20 opacity-70' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-lg block">{task.title}</span>
                          <span className="text-xs font-bold uppercase tracking-wider opacity-60 text-pink-500">{task.category}</span>
                        </div>
                        <span className={`${styles.badge} px-2 py-1 rounded text-xs uppercase tracking-wider font-bold`}>
                          {styles.label}
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-3">{task.description}</p>
                      
                      {assignedEmps.length > 1 && (
                        <div className="mb-4">
                          <p className="text-xs font-bold opacity-50 mb-1 uppercase tracking-wider">Team on this task:</p>
                          <div className="flex flex-wrap gap-1">
                            {assignedEmps.map(emp => {
                              const empDone = task.completedBy?.includes(emp.id);
                              return (
                                <span key={emp.id} className={`text-xs px-2 py-0.5 rounded-full ${empDone ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' : 'bg-black/10 dark:bg-white/10 opacity-70'}`}>
                                  {emp.name} {empDone && '✓'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <p className="text-xs font-bold opacity-50 mb-1 uppercase tracking-wider">Remarks / Updates:</p>
                        <textarea 
                          className="w-full text-sm p-2 rounded bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 min-h-[60px] mb-2"
                          placeholder="Add your updates, issues, or reasons for delay here..."
                          value={remarksDrafts[task.id] !== undefined ? remarksDrafts[task.id] : (task.remarks || '')}
                          onChange={(e) => setRemarksDrafts(prev => ({...prev, [task.id]: e.target.value}))}
                        />
                        {remarksDrafts[task.id] !== undefined && remarksDrafts[task.id] !== (task.remarks || '') && (
                          <div className="flex justify-end">
                            <button 
                              onClick={() => handleSaveRemark(task.id, task.remarks || '')}
                              className="text-xs bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded font-bold transition-colors"
                            >
                              Update Remarks
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 pt-3">
                        <span className="text-sm font-medium opacity-70">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-3">
                          {iHaveCompleted && task.status !== 'completed' && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold italic animate-pulse">Waiting on team...</span>
                          )}
                          <button 
                            onClick={() => handleToggleTaskStatus(task)}
                            className={`text-sm px-4 py-1.5 rounded font-bold transition-all ${iHaveCompleted ? 'bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20' : 'bg-pink-500 text-white hover:bg-pink-600'}`}
                          >
                            {iHaveCompleted ? 'Withdraw Complete' : 'Mark Complete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>

            {/* Team Tasks */}
            <div className="glass p-6">
              <h3 className="text-2xl font-bold mb-4 opacity-80">Team Tasks</h3>
              {otherTasks.length === 0 ? (
                <p className="opacity-50 text-sm">No other tasks assigned to the team.</p>
              ) : (
                <div className="space-y-4">
                  {otherTasks.map(task => {
                    const assignedEmps = employees.filter(emp => task.employeeIds?.includes(emp.id));
                    const styles = getTaskStyles(task);
                    return (
                      <div key={task.id} className="p-3 border border-black/5 dark:border-white/5 rounded-lg bg-black/5 dark:bg-white/5 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{task.title}</span>
                          <span className={`${styles.badge} text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold`}>
                            {styles.label}
                          </span>
                        </div>
                        <div className="text-xs opacity-60 mb-2">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {assignedEmps.length > 0 ? assignedEmps.map(emp => (
                            <span key={emp.id} className="text-[10px] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                              {emp.name}
                            </span>
                          )) : (
                            <span className="text-[10px] italic opacity-50">Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeDashboard;
