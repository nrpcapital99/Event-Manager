import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

const AdminEvents = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState<{ name: string; description: string; eventDate: string; employeeIds: string[] }>({ name: '', description: '', eventDate: '', employeeIds: [] });
  const [error, setError] = useState('');

  const fetchEventsAndEmployees = async () => {
    try {
      const [eventsSnap, empSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'codes'))
      ]);
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchEventsAndEmployees();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newEvent.eventDate) {
      setError('Please select an event date.');
      return;
    }

    try {
      await addDoc(collection(db, 'events'), {
        name: newEvent.name,
        description: newEvent.description,
        eventDate: Timestamp.fromDate(new Date(newEvent.eventDate)),
        employeeIds: newEvent.employeeIds,
        status: 'planning'
      });
      setShowModal(false);
      setNewEvent({ name: '', description: '', eventDate: '', employeeIds: [] });
      fetchEventsAndEmployees();
    } catch (err: any) {
      console.error("Error adding document: ", err);
      setError(err.message || "Failed to create event. Make sure your Firebase rules allow writing.");
    }
  };

  // Helper function to calculate T- timeline
  const getTimeline = (eventDateTimestamp: any) => {
    if (!eventDateTimestamp) return 'T-??';
    
    const eventDate = eventDateTimestamp.toDate();
    const today = new Date();
    
    // Set both to midnight to just calculate full days
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays > 0) return `T-${diffDays} days`;
    if (diffDays === 0) return 'T-0 (Today!)';
    return `T+${Math.abs(diffDays)} (Past Event)`;
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4">
        <h2 className="text-3xl font-bold">Manage Events</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Create Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <div key={event.id} className="glass p-6 hover:shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-all relative overflow-hidden">
            {/* T- Countdown badge */}
            <div className="absolute top-4 right-4 bg-primary text-white font-mono text-sm px-3 py-1 rounded-full shadow-lg font-bold">
              {getTimeline(event.eventDate)}
            </div>
            
            <h3 className="text-xl font-bold mb-2 pr-24">{event.name}</h3>
            <p className="opacity-70 mb-4 text-sm">{event.description}</p>
            
            <div className="flex justify-between text-sm opacity-80 border-t border-black/10 dark:border-white/10 pt-4 mt-4">
              <span className="font-medium">Main Event Date:</span>
              <span>{event.eventDate?.toDate().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            
            <div className="flex justify-between text-sm opacity-80 mt-2">
              <span className="font-medium">Team Size:</span>
              <span>{event.employeeIds?.length || 0} members</span>
            </div>
            
            <div className="mt-4">
               <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                 {event.status || 'Planning'}
               </span>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="opacity-70">No events found. Create one to get started!</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold mb-6">Create New Event</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input type="text" placeholder="Event Name" required className="glass-input" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} />
              <textarea placeholder="Event Description" required className="glass-input min-h-[100px]" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
              
              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Main Event Date</label>
                <input type="date" required className="glass-input" value={newEvent.eventDate} onChange={e => setNewEvent({...newEvent, eventDate: e.target.value})} />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block opacity-80">Assign Team Members</label>
                <div className="max-h-32 overflow-y-auto space-y-2 border border-black/10 dark:border-white/10 p-2 rounded-lg">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="accent-primary"
                        checked={newEvent.employeeIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewEvent({...newEvent, employeeIds: [...newEvent.employeeIds, emp.id]});
                          } else {
                            setNewEvent({...newEvent, employeeIds: newEvent.employeeIds.filter(id => id !== emp.id)});
                          }
                        }}
                      />
                      <span className="text-sm">{emp.name} ({emp.role})</span>
                    </label>
                  ))}
                  {employees.length === 0 && <p className="text-xs opacity-50">No employees found.</p>}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEvents;
