import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const AdminResponsibilities = () => {
  const [responsibilities, setResponsibilities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  
  const [filterEvent, setFilterEvent] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  const [newResp, setNewResp] = useState({
    eventId: '',
    employeeId: '',
    title: '',
    time: '',
    description: ''
  });

  const fetchData = async () => {
    try {
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      setEvents(eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const empSnapshot = await getDocs(collection(db, 'codes'));
      setEmployees(empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const respSnapshot = await getDocs(collection(db, 'responsibilities'));
      setResponsibilities(respSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newResp.eventId || !newResp.employeeId || !newResp.title) {
      setError('Please fill in required fields (Event, Employee, Title).');
      return;
    }

    try {
      const batch = writeBatch(db);
      const newRef = doc(collection(db, 'responsibilities'));
      batch.set(newRef, {
        ...newResp,
        createdAt: new Date().toISOString()
      });
      await batch.commit();

      setShowModal(false);
      setNewResp({ eventId: '', employeeId: '', title: '', time: '', description: '' });
      fetchData();
    } catch (err: any) {
      console.error("Error saving responsibility", err);
      setError(err.message || "Failed to save.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this responsibility?')) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'responsibilities', id));
      await batch.commit();
      fetchData();
    } catch (err) {
      console.error('Error deleting', err);
    }
  };

  const filteredResponsibilities = responsibilities.filter(r => {
    if (filterEvent && r.eventId !== filterEvent) return false;
    if (filterEmployee && r.employeeId !== filterEmployee) return false;
    return true;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4">
        <h2 className="text-3xl font-bold">Event Day Responsibilities</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Assign Responsibility
        </button>
      </div>

      <div className="glass p-6 mb-8 flex flex-wrap gap-4 items-center">
        <div className="font-bold mr-4">Filters:</div>
        <select 
          className="glass-input !w-auto bg-white dark:bg-black/20"
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
        >
          <option value="" className="bg-white dark:bg-slate-900 text-black dark:text-white">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id} className="bg-white dark:bg-slate-900 text-black dark:text-white">{ev.name}</option>)}
        </select>

        <select 
          className="glass-input !w-auto bg-white dark:bg-black/20"
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
        >
          <option value="" className="bg-white dark:bg-slate-900 text-black dark:text-white">All Team Members</option>
          {employees.map(emp => <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-900 text-black dark:text-white">{emp.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResponsibilities.map(resp => {
          const ev = events.find(e => e.id === resp.eventId);
          const emp = employees.find(e => e.id === resp.employeeId);
          
          return (
            <div key={resp.id} className="glass p-6 relative group border-t-4 border-t-blue-500">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDelete(resp.id)} className="text-red-500 hover:text-red-700 text-sm font-bold">
                  Delete
                </button>
              </div>
              
              <h3 className="text-xl font-bold mb-1 text-blue-600 dark:text-blue-400">{resp.title}</h3>
              <p className="text-sm font-semibold opacity-70 mb-4 flex justify-between">
                <span>{ev?.name || 'Unknown Event'}</span>
                <span>{resp.time}</span>
              </p>
              
              <p className="opacity-80 text-sm mb-4 min-h-[40px]">
                {resp.description}
              </p>
              
              <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                  {emp?.name?.substring(0, 2).toUpperCase() || 'NA'}
                </div>
                <span className="font-medium text-sm">{emp?.name || 'Unknown Employee'}</span>
              </div>
            </div>
          );
        })}
        
        {filteredResponsibilities.length === 0 && (
          <div className="col-span-full py-12 text-center opacity-50 font-medium glass">
            No responsibilities found matching your filters.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold mb-6">Assign Responsibility</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSave} className="space-y-4">
              <select required className="glass-input appearance-none bg-white dark:bg-black/20" value={newResp.eventId} onChange={e => setNewResp({...newResp, eventId: e.target.value})}>
                <option value="" disabled className="bg-white dark:bg-slate-900 text-black dark:text-white">1. Select Event</option>
                {events.map(ev => <option key={ev.id} value={ev.id} className="bg-white dark:bg-slate-900 text-black dark:text-white">{ev.name}</option>)}
              </select>

              <select required className="glass-input appearance-none bg-white dark:bg-black/20" value={newResp.employeeId} onChange={e => setNewResp({...newResp, employeeId: e.target.value})}>
                <option value="" disabled className="bg-white dark:bg-slate-900 text-black dark:text-white">2. Select Team Member</option>
                {employees.map(emp => <option key={emp.id} value={emp.id} className="bg-white dark:bg-slate-900 text-black dark:text-white">{emp.name}</option>)}
              </select>

              <input type="text" placeholder="Responsibility Title (e.g. VIP Greeting)" required className="glass-input" value={newResp.title} onChange={e => setNewResp({...newResp, title: e.target.value})} />
              
              <input type="text" placeholder="Time Frame (e.g. 5:00 PM - 7:00 PM)" className="glass-input" value={newResp.time} onChange={e => setNewResp({...newResp, time: e.target.value})} />
              
              <textarea placeholder="Specific Details or Instructions..." className="glass-input min-h-[80px]" value={newResp.description} onChange={e => setNewResp({...newResp, description: e.target.value})} />
              
              <div className="flex gap-4 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResponsibilities;
