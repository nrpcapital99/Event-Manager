import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import EventInvitesManager from '../../components/EventInvitesManager';

const AdminEvents = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, invites, postEvent, expenses
  
  const [newEvent, setNewEvent] = useState<{ id?: string, name: string; description: string; eventDate: string; employeeIds: string[] }>({ name: '', description: '', eventDate: '', employeeIds: [] });
  
  // States for new features
  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
  const fetchData = async () => {
    try {
      const [eventsSnap, empSnap, clientsSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'codes')),
        getDocs(collection(db, 'clients'))
      ]);
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newEvent.eventDate) {
      setError('Please select an event date.');
      return;
    }

    try {
      const eventData = {
        name: newEvent.name,
        description: newEvent.description,
        eventDate: Timestamp.fromDate(new Date(newEvent.eventDate)),
        employeeIds: newEvent.employeeIds,
      };

      if (newEvent.id) {
        await updateDoc(doc(db, 'events', newEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          status: 'planning',
          invitees: [],
          hits: '',
          misses: '',
          expenses: []
        });
      }
      setShowModal(false);
      setNewEvent({ name: '', description: '', eventDate: '', employeeIds: [] });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to save event.");
    }
  };

  const getTimeline = (eventDateTimestamp: any) => {
    if (!eventDateTimestamp) return 'T-??';
    const eventDate = eventDateTimestamp.toDate();
    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 0) return `T-${diffDays} days`;
    if (diffDays === 0) return 'T-0 (Today!)';
    return `T+${Math.abs(diffDays)} (Past)`;
  };


  const handleSavePostEvent = async (eventId: string, hits: string, misses: string) => {
    await updateDoc(doc(db, 'events', eventId), { hits, misses });
    fetchData();
  };

  const handleAddExpense = async (eventId: string) => {
    if (!newExpense.description || !newExpense.amount) return;
    const event = events.find(e => e.id === eventId);
    const expenseObj = {
      id: Date.now().toString(),
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      addedBy: 'Admin', // Hardcoded as admin is using this dashboard
      date: new Date().toISOString()
    };
    await updateDoc(doc(db, 'events', eventId), { 
      expenses: [...(event.expenses || []), expenseObj] 
    });
    setNewExpense({ description: '', amount: '' });
    fetchData();
  };

  const handleRemoveExpense = async (eventId: string, expenseId: string) => {
    const event = events.find(e => e.id === eventId);
    const newExpenses = (event.expenses || []).filter((e: any) => e.id !== expenseId);
    await updateDoc(doc(db, 'events', eventId), { expenses: newExpenses });
    fetchData();
  };

  if (selectedEventId) {
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return <p>Event not found</p>;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <button onClick={() => setSelectedEventId(null)} className="mb-6 flex items-center gap-2 text-primary font-medium hover:opacity-80">
          ← Back to Events
        </button>
        
        <div className="glass p-8 mb-8 border border-primary/20">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold mb-2">{event.name}</h2>
              <p className="opacity-70">{event.description}</p>
              <div className="mt-4 flex gap-4 text-sm opacity-80">
                <span className="font-mono bg-black/10 dark:bg-white/10 px-2 py-1 rounded">
                  {event.eventDate?.toDate().toLocaleDateString()} ({getTimeline(event.eventDate)})
                </span>
              </div>
            </div>
            <button onClick={() => {
              setNewEvent({
                id: event.id,
                name: event.name,
                description: event.description,
                eventDate: event.eventDate?.toDate().toISOString().split('T')[0],
                employeeIds: event.employeeIds || []
              });
              setShowModal(true);
            }} className="btn-secondary">Edit Event</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-black/10 dark:border-white/10 pb-2 overflow-x-auto">
          {['overview', 'invites', 'postEvent', 'expenses'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg font-bold capitalize whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'}`}
            >
              {tab === 'postEvent' ? 'Hits & Misses' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass p-6 min-h-[400px]">
          {activeTab === 'overview' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Event Team</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(event.employeeIds || []).map((empId: string) => {
                  const emp = employees.find(e => e.id === empId);
                  return emp ? (
                    <div key={emp.id} className="p-3 bg-black/5 dark:bg-white/5 rounded-lg flex justify-between items-center">
                      <span className="font-bold">{emp.name}</span>
                      <span className="text-xs uppercase opacity-70">{emp.role}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {activeTab === 'invites' && (
            <EventInvitesManager 
              event={event} 
              clients={clients} 
              onUpdate={fetchData} 
            />
          )}

          {activeTab === 'postEvent' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-4 text-green-500">Hits (What went well)</h3>
                <textarea 
                  className="glass-input min-h-[200px]" 
                  placeholder="Record successes and positive feedback..."
                  value={event.hits || ''}
                  onChange={(e) => handleSavePostEvent(event.id, e.target.value, event.misses)}
                  onBlur={() => handleSavePostEvent(event.id, event.hits, event.misses)}
                />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4 text-red-500">Misses (Areas for improvement)</h3>
                <textarea 
                  className="glass-input min-h-[200px]" 
                  placeholder="Record issues, delays, or negative feedback..."
                  value={event.misses || ''}
                  onChange={(e) => handleSavePostEvent(event.id, event.hits, e.target.value)}
                  onBlur={() => handleSavePostEvent(event.id, event.hits, event.misses)}
                />
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Event Expenses</h3>
              <div className="flex gap-4 mb-6 flex-wrap">
                <input type="text" placeholder="Expense description..." className="glass-input flex-1 min-w-[200px]" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                <input type="number" placeholder="Amount (₹)" className="glass-input w-32" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
                <button onClick={() => handleAddExpense(event.id)} className="btn-primary whitespace-nowrap">Add Expense</button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-sm opacity-70">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Added By</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(event.expenses || []).map((exp: any) => (
                      <tr key={exp.id} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-3 text-sm opacity-70">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="py-3 font-medium">{exp.description}</td>
                        <td className="py-3 text-sm">{exp.addedBy}</td>
                        <td className="py-3 font-mono text-right">₹{exp.amount.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <button onClick={() => handleRemoveExpense(event.id, exp.id)} className="text-red-500 text-xs hover:underline ml-4">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {(event.expenses || []).length > 0 && (
                      <tr className="font-bold text-lg bg-black/5 dark:bg-white/5">
                        <td colSpan={3} className="py-3 text-right pr-4">Total Expenses:</td>
                        <td className="py-3 text-right text-pink-500">₹{(event.expenses || []).reduce((sum: number, exp: any) => sum + exp.amount, 0).toFixed(2)}</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
              <h3 className="text-2xl font-bold mb-6">{newEvent.id ? 'Edit Event' : 'Create New Event'}</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSaveEvent} className="space-y-4">
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
                  <button type="submit" className="btn-primary flex-1">{newEvent.id ? 'Save Changes' : 'Create Event'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Main Event List View ---
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4 gap-4">
        <h2 className="text-3xl font-bold">Manage Events</h2>
        <button onClick={() => {
          setNewEvent({ name: '', description: '', eventDate: '', employeeIds: [] });
          setShowModal(true);
        }} className="btn-primary">
          + Create Event
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="glass p-6 hover:shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-all cursor-pointer relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            
            <div className="absolute top-4 right-4 bg-primary text-white font-mono text-sm px-3 py-1 rounded-full shadow-lg font-bold">
              {getTimeline(event.eventDate)}
            </div>
            
            <h3 className="text-xl font-bold mb-2 pr-24 group-hover:text-primary transition-colors">{event.name}</h3>
            <p className="opacity-70 mb-4 text-sm line-clamp-2">{event.description}</p>
            
            <div className="flex justify-between text-sm opacity-80 border-t border-black/10 dark:border-white/10 pt-4 mt-4">
              <span className="font-medium">Date:</span>
              <span>{event.eventDate?.toDate().toLocaleDateString()}</span>
            </div>
            
            <div className="flex justify-between text-sm opacity-80 mt-2">
              <span className="font-medium">Invites:</span>
              <span>{(event.invitees || []).length} clients</span>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="opacity-70">No events found. Create one to get started!</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold mb-6">{newEvent.id ? 'Edit Event' : 'Create New Event'}</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSaveEvent} className="space-y-4">
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
                <button type="submit" className="btn-primary flex-1">{newEvent.id ? 'Save Changes' : 'Create Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEvents;
