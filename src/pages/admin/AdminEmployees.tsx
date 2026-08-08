import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

const AdminEmployees = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState<any>(null); // To view/edit assignments
  const [newEmployee, setNewEmployee] = useState({ name: '', role: 'employee' });

  const fetchData = async () => {
    const [empSnap, eventSnap, taskSnap] = await Promise.all([
      getDocs(collection(db, 'codes')),
      getDocs(collection(db, 'events')),
      getDocs(collection(db, 'tasks'))
    ]);
    setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setEvents(eventSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setTasks(taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'EMP-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const generatedCode = generateCode();
    await addDoc(collection(db, 'codes'), {
      ...newEmployee,
      code: generatedCode,
      active: true,
      createdAt: new Date()
    });
    setShowModal(false);
    fetchData();
  };

  const toggleEventAssignment = async (empId: string, eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    let updatedEmployeeIds = event.employeeIds || [];
    if (updatedEmployeeIds.includes(empId)) {
      updatedEmployeeIds = updatedEmployeeIds.filter((id: string) => id !== empId);
    } else {
      updatedEmployeeIds = [...updatedEmployeeIds, empId];
    }
    
    await updateDoc(doc(db, 'events', eventId), { employeeIds: updatedEmployeeIds });
    fetchData();
  };

  const toggleTaskAssignment = async (empId: string, taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    let updatedEmployeeIds = task.employeeIds || [];
    if (updatedEmployeeIds.includes(empId)) {
      updatedEmployeeIds = updatedEmployeeIds.filter((id: string) => id !== empId);
    } else {
      updatedEmployeeIds = [...updatedEmployeeIds, empId];
    }
    
    await updateDoc(doc(db, 'tasks', taskId), { employeeIds: updatedEmployeeIds });
    fetchData();
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4">
        <h2 className="text-3xl font-bold">Manage Employees</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Generate Access Code
        </button>
      </div>

      <div className="glass p-6 overflow-hidden">
        <p className="opacity-70 mb-6 text-sm">Click on any employee to assign or de-assign them from events and tasks.</p>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/20 text-[var(--glass-text)] opacity-70">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Role</th>
              <th className="pb-3 font-medium">Access Code</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setShowEmployeeModal(emp)}>
                <td className="py-4 font-medium">{emp.name}</td>
                <td className="py-4 capitalize">{emp.role}</td>
                <td className="py-4">
                  <span className="font-mono bg-black/10 dark:bg-black/30 px-2 py-1 rounded text-pink-600 dark:text-pink-300 tracking-wider">
                    {emp.code}
                  </span>
                </td>
                <td className="py-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase tracking-wider font-bold ${emp.active ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                    {emp.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p className="opacity-70 mt-4 text-center">No employees found. Generate a code to add someone.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold mb-6">Add New Employee</h3>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <input type="text" placeholder="Employee Name" required className="glass-input" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
              <div className="flex gap-4 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Generate Code</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b border-black/10 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-bold">{showEmployeeModal.name}</h3>
                <p className="opacity-70 capitalize">{showEmployeeModal.role} | Code: {showEmployeeModal.code}</p>
              </div>
              <button onClick={() => setShowEmployeeModal(null)} className="opacity-50 hover:opacity-100 text-3xl font-light">&times;</button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  Event Assignments
                </h4>
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-lg space-y-1">
                  {events.length === 0 && <p className="text-sm opacity-50">No events exist.</p>}
                  {events.map(ev => {
                    const isAssigned = ev.employeeIds?.includes(showEmployeeModal.id);
                    return (
                      <label key={ev.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          className="accent-primary w-4 h-4"
                          checked={isAssigned}
                          onChange={() => toggleEventAssignment(showEmployeeModal.id, ev.id)}
                        />
                        <span className="font-medium">{ev.name}</span>
                        <span className="text-xs opacity-50 ml-auto">{ev.eventDate?.toDate().toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <span className="bg-pink-500/20 text-pink-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Task Assignments (From Assigned Events)
                </h4>
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-lg space-y-1">
                  {tasks.length === 0 && <p className="text-sm opacity-50">No tasks exist.</p>}
                  {events.filter(ev => ev.employeeIds?.includes(showEmployeeModal.id)).map(ev => {
                    const eventTasks = tasks.filter(t => t.eventId === ev.id);
                    if (eventTasks.length === 0) return null;
                    return (
                      <div key={`tasks-${ev.id}`} className="mb-4 last:mb-0">
                        <div className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 pl-2">{ev.name} Tasks</div>
                        {eventTasks.map(task => {
                          const isAssigned = task.employeeIds?.includes(showEmployeeModal.id);
                          return (
                            <label key={task.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors ml-2 border-l-2 border-black/10 dark:border-white/10">
                              <input 
                                type="checkbox" 
                                className="accent-pink-500 w-4 h-4"
                                checked={isAssigned}
                                onChange={() => toggleTaskAssignment(showEmployeeModal.id, task.id)}
                              />
                              <span className="font-medium text-sm">{task.title}</span>
                              <span className="text-xs opacity-50 ml-auto capitalize">{task.category}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                  {events.filter(ev => ev.employeeIds?.includes(showEmployeeModal.id)).length === 0 && (
                    <p className="text-sm opacity-80 text-red-500 font-medium p-2">Assign the employee to an event first to see their tasks.</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmployees;
