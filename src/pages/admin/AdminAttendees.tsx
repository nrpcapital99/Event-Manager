import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import EventInvitesManager from '../../components/EventInvitesManager';
import { Calendar, Users } from 'lucide-react';
import { groupEvents } from '../../lib/utils';

const AdminAttendees = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [eventsSnap, clientsSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'clients'))
      ]);
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendees & Invites</h1>
          <p className="opacity-70">Manage client invitations and attendance across all events.</p>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="space-y-8">
          {(() => {
            const { upcoming, past } = groupEvents(events);
            return (
              <>
                {upcoming.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4 opacity-80 uppercase tracking-wider text-sm">Upcoming Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {upcoming.map(event => (
                        <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="glass p-6 cursor-pointer hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] group">
                          <div className="bg-primary/20 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Calendar className="text-primary" size={24} />
                          </div>
                          <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                          <div className="flex items-center gap-2 text-sm opacity-70 mb-4">
                            <Users size={14} />
                            <span>{(event.invitees || []).length} Invited Clients</span>
                          </div>
                          <button className="text-primary text-sm font-bold w-full text-left">Manage Attendees →</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4 opacity-80 uppercase tracking-wider text-sm mt-8">Past Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                      {past.map(event => (
                        <div key={event.id} onClick={() => setSelectedEventId(event.id)} className="glass p-6 cursor-pointer hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] group">
                          <div className="bg-primary/20 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Calendar className="text-primary" size={24} />
                          </div>
                          <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                          <div className="flex items-center gap-2 text-sm opacity-70 mb-4">
                            <Users size={14} />
                            <span>{(event.invitees || []).length} Invited Clients</span>
                          </div>
                          <button className="text-primary text-sm font-bold w-full text-left">Manage Attendees →</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          {events.length === 0 && (
            <div className="col-span-full py-12 text-center opacity-50">
              No events found. Create one in the Events tab first!
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => setSelectedEventId(null)}
            className="mb-6 text-sm font-bold opacity-70 hover:opacity-100 flex items-center gap-2"
          >
            ← Back to Events
          </button>
          
          <div className="glass p-8 mb-6">
            <h2 className="text-2xl font-bold mb-2">{selectedEvent?.name} - Attendee Management</h2>
            <p className="opacity-70 mb-8">Manage the guest list and RSVP status for this event.</p>
            
            {selectedEvent && (
              <EventInvitesManager 
                event={selectedEvent} 
                clients={clients} 
                onUpdate={fetchData} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAttendees;
