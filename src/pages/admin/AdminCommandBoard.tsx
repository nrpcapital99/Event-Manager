import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import './AdminCommandBoard.css';

const AdminCommandBoard = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Levers
  const [yesRate, setYesRate] = useState(65);
  const [likelyRate, setLikelyRate] = useState(30);
  const [callYes, setCallYes] = useState(40);
  const [party, setParty] = useState(1.8);
  // const [newFaceTarget, setNewFaceTarget] = useState(30);

  // Data for the board
  const [attendees, setAttendees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const eventsSnap = await getDocs(collection(db, 'events'));
      const evs = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(evs);
      if (evs.length > 0 && !selectedEventId) {
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
  }, []);

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
  // const pc = prospects.filter(p => ['Confirmed', 'Came'].includes(p.stage)).length;

  const daysToEvent = selectedEvent?.eventDate ? 
    Math.ceil((selectedEvent.eventDate.toDate().getTime() - new Date().getTime()) / 86400000) : 0;

  const tminusText = daysToEvent > 0 ? `T-${daysToEvent}` : (daysToEvent === 0 ? 'TODAY' : 'DONE');
  const tlabText = daysToEvent > 1 ? 'days to doors' : (daysToEvent === 1 ? 'day to doors' : 'the room is live');

  // Render the seat grid
  const renderRoomGrid = () => {
    let seats = [];
    for (let i = 1; i <= CAP; i++) {
      let cssClass = '';
      if (i <= expected) cssClass = 'show';
      else if (i <= Math.min(CAP, firmYes + likely)) cssClass = 'risk';
      
      seats.push(<div key={i} className={`seat ${cssClass}`}></div>);
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
    <div className="command-board-wrap command-board-theme animate-in fade-in duration-500">
      
      <div className="mb-6 flex items-center justify-between">
        <div className="eyebrow !text-[var(--cb-ink)] font-bold text-lg">Event Selection</div>
        <select 
          className="cb-select"
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
        >
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      <header>
        <div className="hrow">
          <div>
            <div className="eyebrow">NRP Capitals &nbsp;/&nbsp; flagship event &nbsp;/&nbsp; chairman command board</div>
            <h1>{selectedEvent?.name || 'Select an Event'}</h1>
            <div className="when">
              {selectedEvent?.eventDate ? selectedEvent.eventDate.toDate().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase() : 'NO DATE'} 
              &nbsp;/&nbsp; CAPACITY {CAP}
            </div>
          </div>
          <div className="clock">
            <div className="num">{tminusText}</div>
            <div className="lab">{tlabText}</div>
          </div>
        </div>
      </header>

      <div className="rule-box">
        <b>Operating rule.</b> The database contains names, numbers, and private RSVP notes. This board is the war room screen: counts, owners and decisions only. Nothing on this screen identifies a client or carries a portfolio value, making it safe for the team group.
      </div>

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
            <div className="rates">
              <label>Firm yes shows up <input type="range" min="45" max="95" step="5" value={yesRate} onChange={e => setYesRate(Number(e.target.value))} /><b>{yesRate}%</b></label>
              <label>Likely shows up <input type="range" min="10" max="60" step="5" value={likelyRate} onChange={e => setLikelyRate(Number(e.target.value))} /><b>{likelyRate}%</b></label>
            </div>
          </div>
          <div className="seat-grid">{renderRoomGrid()}</div>
          <div className="legend">
            <span><i className="sw a"></i>expected to walk in</span>
            <span><i className="sw b"></i>confirmed but discounted for no shows</span>
            <span><i className="sw"></i>empty chair</span>
          </div>
          {gap === 0 ? (
            <div className="alert ok">Projected at or above {CAP}. Stop adding volume, start a waitlist, and check that the room can take the overshoot.</div>
          ) : (
            <div className="alert short">Gap of {gap} people. That needs about {Math.ceil(gap / (yesRate / 100))} more firm yes seats at the show rate you have set.</div>
          )}
        </div>
      </section>

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
              <div className="row"><b style={{fontSize: '26px', fontFamily: 'var(--cb-display)', color: ceiling >= CAP ? 'var(--cb-pine)' : 'var(--cb-red)'}}>{ceiling}</b></div>
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
                {o.tasks.slice(0, 5).map((t, i) => (
                  <li key={i} className={t.status === 'completed' ? 'done' : ''}>
                    <input type="checkbox" readOnly checked={t.status === 'completed'} />
                    <span>{t.title}</span>
                  </li>
                ))}
                {o.tasks.length > 5 && <li className="small italic text-gray-500">+{o.tasks.length - 5} more tasks</li>}
              </ul>
            </div>
          ))}
          {owners.length === 0 && <div className="text-sm opacity-50 p-4 italic">No team members assigned to this event yet.</div>}
        </div>
      </section>

    </div>
  );
};

export default AdminCommandBoard;
