import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import './AdminCommandBoard.css';

const AdminCommandBoard = ({ 
  isEmployeeMode = false, 
  employeeData = null,
  syncEventId = null,
  renderHeaderActions,
  children
}: { 
  isEmployeeMode?: boolean, 
  employeeData?: any,
  syncEventId?: string | null,
  renderHeaderActions?: () => React.ReactNode,
  children?: React.ReactNode
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  useEffect(() => {
    if (syncEventId) {
      setSelectedEventId(syncEventId);
    }
  }, [syncEventId]);
  
  // Levers
  const [yesRate, setYesRate] = useState(65);
  const [likelyRate, setLikelyRate] = useState(30);
  const [callYes, setCallYes] = useState(40);
  const [party, setParty] = useState(1.8);

  // Data for the board
  const [attendees, setAttendees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Seat Map Modal State
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const eventsSnap = await getDocs(collection(db, 'events'));
      const evs = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(evs);
      
      // If employee mode, auto-select their first event if any
      if (isEmployeeMode && employeeData && !selectedEventId) {
        const myEvs = evs.filter((e: any) => e.employeeIds?.includes(employeeData.id));
        if (myEvs.length > 0) setSelectedEventId(myEvs[0].id);
      } else if (evs.length > 0 && !selectedEventId) {
        setSelectedEventId(evs[0].id);
      }

      const attSnap = await getDocs(collection(db, 'attendees'));
      setAttendees(attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const taskSnap = await getDocs(collection(db, 'tasks'));
      setTasks(taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const empSnap = await getDocs(collection(db, 'codes'));
      setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isEmployeeMode, employeeData]);

  const toggleTaskStatus = async (taskId: string, currentStatus: string, taskEmployeeIds?: string[], taskCompletedBy?: string[]) => {
    try {
      if (isEmployeeMode && employeeData) {
        // Employee logic: track partial completions
        const isCompletedByMe = taskCompletedBy?.includes(employeeData.id);
        let newCompletedBy = taskCompletedBy || [];
        if (isCompletedByMe) {
          newCompletedBy = newCompletedBy.filter(id => id !== employeeData.id);
        } else {
          newCompletedBy = [...newCompletedBy, employeeData.id];
        }
        
        const assignedIds = taskEmployeeIds || [];
        const allDone = assignedIds.length > 0 && assignedIds.every(id => newCompletedBy.includes(id));
        const newStatus = allDone ? 'completed' : 'pending';
        
        await updateDoc(doc(db, 'tasks', taskId), {
          completedBy: newCompletedBy,
          status: newStatus
        });
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus, completedBy: newCompletedBy } : t));
      } else {
        // Admin logic: force toggle
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      console.error("Error updating task", err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (isEmployeeMode) return;
    if (!window.confirm('Delete this task forever?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Error deleting task", err);
    }
  };

  const quickAddTask = async (title: string, employeeId: string) => {
    if (!selectedEventId || isEmployeeMode) return;
    try {
      const newTask = {
        title,
        eventId: selectedEventId,
        employeeIds: [employeeId],
        status: 'pending',
        category: 'General',
        dueDate: new Date().toISOString().split('T')[0],
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, 'tasks'), newTask);
      setTasks([...tasks, { id: docRef.id, ...newTask }]);
    } catch (err) {
      console.error(err);
    }
  };

  const assignSeatToAttendee = async (attendeeId: string) => {
    if (selectedSeat === null) return;
    
    // Unassign this seat from anyone else first
    const existingOccupant = attendees.find(a => a.eventId === selectedEventId && a.seatNumber === selectedSeat);
    if (existingOccupant) {
      await updateDoc(doc(db, 'attendees', existingOccupant.id), { seatNumber: null });
    }

    // Assign to new attendee
    if (attendeeId) {
      await updateDoc(doc(db, 'attendees', attendeeId), { seatNumber: selectedSeat });
    }
    
    setShowSeatModal(false);
    setSelectedSeat(null);
    fetchData(); // Refresh all attendees to get updated seats
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventAttendees = attendees.filter(a => a.eventId === selectedEventId);
  const eventTasks = tasks.filter(t => t.eventId === selectedEventId);

  // Calculate totals
  const firmYes = eventAttendees.filter(a => a.rsvpStatus === 'Confirmed').length;
  const likely = eventAttendees.filter(a => a.rsvpStatus === 'Maybe').length;
  const contacted = eventAttendees.filter(a => a.status !== 'Not Sent').length;
  
  const expected = Math.round(firmYes * (yesRate / 100) + likely * (likelyRate / 100));
  
  // Use event capacity or default to 200
  const CAP = selectedEvent?.capacity || 200;
  const LIST = eventAttendees.length > 0 ? eventAttendees.length : 270; 
  
  const ceiling = Math.round(LIST * (callYes / 100) * party * (yesRate / 100));
  const gap = Math.max(0, CAP - expected);
  
  const needSeats = Math.ceil(CAP / (yesRate / 100));
  const needNames = Math.ceil(CAP / ((callYes / 100) * party * (yesRate / 100)));
  const shortNames = Math.max(0, needNames - LIST);

  const daysToEvent = selectedEvent?.eventDate ? 
    Math.ceil((selectedEvent.eventDate.toDate().getTime() - new Date().getTime()) / 86400000) : 0;

  const tminusText = daysToEvent > 0 ? `T-${daysToEvent}` : (daysToEvent === 0 ? 'TODAY' : 'DONE');
  const tlabText = daysToEvent > 1 ? 'days to doors' : (daysToEvent === 1 ? 'day to doors' : 'the room is live');

  // Render the seat grid (Interactive)
  const renderRoomGrid = () => {
    let seats = [];
    for (let i = 1; i <= CAP; i++) {
      // Find if anyone is assigned to this specific seat
      const occupant = eventAttendees.find(a => a.seatNumber === i);
      
      let cssClass = 'cursor-pointer hover:scale-125 transition-transform';
      if (occupant) {
        cssClass += ' show'; // Green if explicitly assigned
      } else if (i <= expected) {
        cssClass += ' risk'; // Light green if projected
      }
      
      seats.push(
        <div 
          key={i} 
          className={`seat ${cssClass}`}
          title={occupant ? `Seat ${i}: ${occupant.name}` : `Seat ${i} (Available)`}
          onClick={() => {
            if (!isEmployeeMode) {
              setSelectedSeat(i);
              setShowSeatModal(true);
            }
          }}
        ></div>
      );
    }
    return seats;
  };

  // Group tasks by employee (simulating the 'owners' logic)
  const owners = employees.filter(emp => selectedEvent?.employeeIds?.includes(emp.id)).map(emp => {
    const empTasks = eventTasks.filter(t => t.employeeIds?.includes(emp.id));
    const doneTasks = empTasks.filter(t => t.status === 'completed');
    const pct = empTasks.length > 0 ? Math.round((doneTasks.length / empTasks.length) * 100) : 0;
    
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      tasks: empTasks,
      doneTasks,
      pct
    };
  });

  return (
    <div className="command-board-wrap command-board-theme animate-in fade-in duration-500 relative">
      
      {/* Seat Assignment Modal */}
      {showSeatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--chalk)] p-6 rounded-[4px] border border-[var(--rule)] shadow-2xl max-w-md w-full">
            <h3 className="disp text-xl mb-4">Assign Seat {selectedSeat}</h3>
            <p className="text-[var(--soft)] mb-4 font-mono text-sm">Select an attendee to reserve this seat.</p>
            
            <select 
              className="glass-input mb-6"
              onChange={(e) => assignSeatToAttendee(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Select an Attendee...</option>
              {eventAttendees.map(att => (
                <option key={att.id} value={att.id}>
                  {att.name} {att.seatNumber ? `(Currently Seat ${att.seatNumber})` : ''}
                </option>
              ))}
            </select>
            
            <div className="flex gap-4">
              <button className="btn-secondary flex-1" onClick={() => setShowSeatModal(false)}>Cancel</button>
              <button className="btn-primary bg-[var(--red)] flex-1" onClick={() => assignSeatToAttendee('')}>Clear Seat</button>
            </div>
          </div>
        </div>
      )}

      {!isEmployeeMode && (
        <div className="mb-6 flex items-center justify-between">
          <div className="eyebrow !text-[var(--ink)] font-bold text-lg">Event Selection</div>
          <select 
            className="cb-select"
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
          >
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
      )}

      <header>
        <div className="hrow">
          <div>
            <div className="eyebrow">NRP Capitals &nbsp;/&nbsp; flagship event &nbsp;/&nbsp; {isEmployeeMode ? `employee workspace: ${employeeData?.name}` : 'chairman command board'}</div>
            <h1>{selectedEvent?.name || 'Select an Event'}</h1>
            <div className="when">
              {selectedEvent?.eventDate ? selectedEvent.eventDate.toDate().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase() : 'NO DATE'} 
              &nbsp;/&nbsp; CAPACITY {CAP}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="clock">
              <div className="num">{tminusText}</div>
              <div className="lab">{tlabText}</div>
            </div>
            {renderHeaderActions && renderHeaderActions()}
          </div>
        </div>
      </header>

      {!isEmployeeMode && (
        <div className="rule-box">
          <b>Operating rule.</b> The database contains names, numbers, and private RSVP notes. This board is the war room screen: counts, owners and decisions only. Nothing on this screen identifies a client or carries a portfolio value, making it safe for the team group.
        </div>
      )}

      <section>
        <div className="shead">
          <h2>The room, live</h2>
          <span className="note">built from firm yes and likely, never from invites sent</span>
        </div>
        <div className="panel">
          <div className="mhead">
            <div className="stats">
              <div className="stat"><div className="v mono">{contacted}</div><div className="k">Personally contacted</div></div>
              <div className="stat good"><div className="v mono">{firmYes}</div><div className="k">Firm yes seats</div></div>
              <div className="stat warn"><div className="v mono">{likely}</div><div className="k">Likely seats</div></div>
              <div className={`stat ${expected >= CAP ? 'good' : 'bad'}`}><div className="v mono">{expected}</div><div className="k">Expected in room</div></div>
              <div className="stat gap"><div className="v mono">{gap}</div><div className="k">Gap to {CAP}</div></div>
            </div>
            {!isEmployeeMode && (
              <div className="rates">
                <label>Firm yes shows up <input type="range" min="45" max="95" step="5" value={yesRate} onChange={e => setYesRate(Number(e.target.value))} /><b>{yesRate}%</b></label>
                <label>Likely shows up <input type="range" min="10" max="60" step="5" value={likelyRate} onChange={e => setLikelyRate(Number(e.target.value))} /><b>{likelyRate}%</b></label>
              </div>
            )}
          </div>
          <div className="seat-grid">{renderRoomGrid()}</div>
          <div className="legend">
            <span><i className="sw a"></i>assigned manually</span>
            <span><i className="sw b"></i>projected from conversion levers</span>
            <span><i className="sw"></i>empty chair</span>
          </div>
          {gap === 0 ? (
            <div className="alert ok">Projected at or above {CAP}. Stop adding volume, start a waitlist, and check that the room can take the overshoot.</div>
          ) : (
            <div className="alert short">Gap of {gap} people. That needs about {Math.ceil(gap / (yesRate / 100))} more firm yes seats at the show rate you have set.</div>
          )}
        </div>
      </section>

      {!isEmployeeMode && (
        <section>
          <div className="shead">
            <h2>Can {LIST} names even fill {CAP} chairs</h2>
            <span className="note">the question nobody asked before the target was set</span>
          </div>
          <div className="panel">
            <div className="levers">
              <div className="lever">
                <label>Yes rate on a personal call</label>
                <div className="row"><input type="range" min="20" max="70" step="5" value={callYes} onChange={e => setCallYes(Number(e.target.value))} /><b>{callYes}%</b></div>
                <div className="hint">Warm client, voice call, 35 to 45. A broadcast message, roughly half that.</div>
              </div>
              <div className="lever">
                <label>Seats per family that says yes</label>
                <div className="row"><input type="range" min="1" max="3" step="0.2" value={party} onChange={e => setParty(Number(e.target.value))} /><b>{party}</b></div>
                <div className="hint">Your cheapest lever. Moving this from 1.8 to 2.4 is worth about 115 extra names, and it costs one sentence in the script.</div>
              </div>
              <div className="lever">
                <label>Ceiling from the current list</label>
                <div className="row"><b style={{fontSize: '26px', fontFamily: 'var(--display)', color: ceiling >= CAP ? 'var(--pine)' : 'var(--red)'}}>{ceiling}</b></div>
                <div className="hint">People in the room if every one of the {LIST} is called and the levers hold.</div>
              </div>
            </div>
            {ceiling >= CAP ? (
              <div className="alert ok">At these levers the {LIST} names can produce {ceiling} people. It works, but only if every name is actually called.</div>
            ) : (
              <div className="alert short">
                At these levers {LIST} names produce {ceiling} people in the room, not {CAP}.<br/>
                {CAP} needs roughly {needSeats} confirmed seats, which needs about {needNames} names on the list.
                You are short by roughly {shortNames} names.<br/>
                Three ways out and you need at least two: add names this week, lift seats per family by asking for the spouse and children by name, or accept a room of {ceiling} and make it a good one.
              </div>
            )}
          </div>
        </section>
      )}

      <section>
          <div className="shead">
            <h2>Task Completion by Team</h2>
            <span className="note">Live task metrics for this event</span>
          </div>
          <div className="cards">
            {owners.map(o => (
              <div key={o.id} className="cb-card">
                <div className="who"><div className="nm">{o.name}</div><div className="eyebrow">{o.role}</div></div>
                <div className="metrics">
                  <div className="metric"><div className="lab">Assigned</div><div className="cb-select">{o.tasks.length}</div></div>
                  <div className="metric"><div className="lab">Done</div><div className="cb-select">{o.doneTasks.length}</div></div>
                </div>
                <div className="bar"><i className={o.pct < 34 && o.tasks.length > 0 ? 'hot' : ''} style={{width: `${o.pct}%`}}></i></div>
                <div className="targetrow" style={{marginTop: '5px'}}>{o.pct}% of tasks completed</div>
                <ul className="tasks">
                  {o.tasks.map((t, i) => {
                    const isMyTask = isEmployeeMode && t.employeeIds?.includes(employeeData?.id);
                    const iHaveCompleted = isEmployeeMode && t.completedBy?.includes(employeeData?.id);
                    // A task is shown as 'done' visually if it's fully completed OR if I've completed my part
                    const isVisuallyDone = t.status === 'completed' || iHaveCompleted;

                    return (
                      <li key={i} className={`flex justify-between items-start gap-2 ${isVisuallyDone ? 'done' : ''}`}>
                        <div className="flex items-start gap-2 flex-1">
                          <input 
                            type="checkbox" 
                            checked={isVisuallyDone} 
                            onChange={() => toggleTaskStatus(t.id, t.status, t.employeeIds, t.completedBy)}
                            className="cursor-pointer mt-1"
                            disabled={isEmployeeMode && !isMyTask}
                          />
                          <span 
                            className="cursor-pointer leading-tight pt-0.5" 
                            onClick={() => {
                              if (!isEmployeeMode || isMyTask) {
                                toggleTaskStatus(t.id, t.status, t.employeeIds, t.completedBy);
                              }
                            }}
                          >
                            {t.title}
                          </span>
                        </div>
                        {!isEmployeeMode && (
                          <button 
                            onClick={() => deleteTask(t.id)} 
                            className="text-[var(--red)] opacity-30 hover:opacity-100 font-mono text-[10px] px-1 pb-1"
                            title="Delete task"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!isEmployeeMode && (
                  <div className="mt-3 border-t border-[var(--rule)] pt-2">
                    <input 
                      type="text" 
                      placeholder={`Assign to ${o.name}... (Press Enter)`} 
                      className="cb-select w-full"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          quickAddTask(e.currentTarget.value.trim(), o.id);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {owners.length === 0 && <div className="text-sm opacity-50 p-4 italic">No team members assigned to this event yet.</div>}
          </div>
        </section>

      {isEmployeeMode && children && (
        <section className="mt-8 border-t-2 border-[var(--ink)] pt-8">
          {children}
        </section>
      )}
    </div>
  );
};

export default AdminCommandBoard;
