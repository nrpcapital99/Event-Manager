import { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface EventInvitesManagerProps {
  event: any;
  clients: any[];
  onUpdate: () => void;
}

const EventInvitesManager = ({ event, clients, onUpdate }: EventInvitesManagerProps) => {
  const [clientSearch, setClientSearch] = useState('');
  const [inviteTab, setInviteTab] = useState<'all' | 'invited' | 'rsvp' | 'attended' | 'declined'>('all');
  const [inviteSort, setInviteSort] = useState<'priority' | 'alphabetical' | 'rm'>('priority');

  const sortClients = (clientList: any[]) => {
    return [...clientList].sort((a, b) => {
      if (inviteSort === 'priority') {
        const priorityScore: Record<string, number> = { 'VVIP': 4, 'VIP': 3, 'Important': 2, 'Normal': 1 };
        const scoreA = priorityScore[a.priority] || 0;
        const scoreB = priorityScore[b.priority] || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      if (inviteSort === 'rm') {
        const rmA = a.rm || '';
        const rmB = b.rm || '';
        if (rmA !== rmB) return rmA.localeCompare(rmB);
      }
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  };

  const handleInviteClient = async (clientId: string) => {
    const currentInvitees = event.invitees || [];
    if (currentInvitees.find((i: any) => i.clientId === clientId)) return;
    const newInvitees = [...currentInvitees, { clientId, status: 'invited', guestCount: 0 }];
    await updateDoc(doc(db, 'events', event.id), { invitees: newInvitees });
    onUpdate();
  };

  const handleUpdateRSVP = async (clientId: string, status: string, guestCount: number) => {
    const newInvitees = (event.invitees || []).map((inv: any) => 
      inv.clientId === clientId ? { ...inv, status, guestCount } : inv
    );
    await updateDoc(doc(db, 'events', event.id), { invitees: newInvitees });
    onUpdate();
  };

  const handleRemoveInvitee = async (clientId: string) => {
    const newInvitees = (event.invitees || []).filter((inv: any) => inv.clientId !== clientId);
    await updateDoc(doc(db, 'events', event.id), { invitees: newInvitees });
    onUpdate();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold">Client Invite List</h3>
          <p className="opacity-70 text-sm">Manage invites, RSVPs, and headcounts.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <input type="text" placeholder="Search clients..." className="glass-input text-sm py-1.5 min-w-[200px]" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
          <select className="glass-input text-sm py-1.5" value={inviteSort} onChange={e => setInviteSort(e.target.value as any)}>
            <option value="priority">Sort: Importance</option>
            <option value="alphabetical">Sort: A-Z</option>
            <option value="rm">Sort: RM</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-black/10 dark:border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'all', label: `All Clients (${clients.length})` },
          { id: 'invited', label: `Invited (${(event.invitees || []).filter((i: any) => i.status === 'invited').length})` },
          { id: 'rsvp', label: `RSVP Accepted (${(event.invitees || []).filter((i: any) => i.status === 'rsvp_accepted').length})` },
          { id: 'attended', label: `Attended (${(event.invitees || []).filter((i: any) => i.status === 'attended').length})` },
          { id: 'declined', label: `Declined (${(event.invitees || []).filter((i: any) => i.status === 'declined').length})` }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setInviteTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-t-lg text-sm font-bold whitespace-nowrap transition-colors ${inviteTab === tab.id ? 'bg-primary text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-sm opacity-70">
              <th className="pb-2">Client Details</th>
              <th className="pb-2">Importance</th>
              {inviteTab === 'rsvp' || inviteTab === 'attended' ? (
                <th className="pb-2">Guests</th>
              ) : null}
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const searched = clients.filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()));
              const sorted = sortClients(searched);
              
              let displayed = [];
              if (inviteTab === 'all') {
                displayed = sorted;
              } else {
                const targetStatus = inviteTab === 'rsvp' ? 'rsvp_accepted' : inviteTab;
                displayed = sorted.filter(c => {
                  const inv = (event.invitees || []).find((i: any) => i.clientId === c.id);
                  return inv && inv.status === targetStatus;
                });
              }

              if (displayed.length === 0) {
                return <tr><td colSpan={5} className="py-8 text-center opacity-50">No clients found in this category.</td></tr>;
              }

              return displayed.map(client => {
                const inv = (event.invitees || []).find((i: any) => i.clientId === client.id);
                
                const rowClass = inviteTab === 'all' && inv 
                  ? 'border-b border-black/5 dark:border-white/5 bg-green-500/5 dark:bg-green-500/10 hover:bg-green-500/10 dark:hover:bg-green-500/20 transition-colors'
                  : 'border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors';
                  
                return (
                  <tr key={client.id} className={rowClass}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{client.name}</p>
                        {inviteTab === 'all' && inv && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase tracking-wider">
                            {inv.status === 'rsvp_accepted' ? 'RSVP' : inv.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-70">RM: {client.rm || 'None'}</p>
                    </td>
                    <td className="py-3">
                      <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded font-bold">{client.priority}</span>
                    </td>
                    {inviteTab === 'rsvp' || inviteTab === 'attended' ? (
                      <td className="py-3">
                        <input 
                          type="number" 
                          min="0" 
                          className="w-16 bg-black/5 dark:bg-white/5 rounded px-2 py-1 text-sm border border-black/10" 
                          value={inv?.guestCount || 0}
                          onChange={(e) => handleUpdateRSVP(client.id, inv.status, parseInt(e.target.value) || 0)}
                        />
                      </td>
                    ) : null}
                    <td className="py-3 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {inviteTab === 'all' && !inv && (
                          <button onClick={() => handleInviteClient(client.id)} className="btn-primary text-xs py-1 px-3">Invite</button>
                        )}
                        {inviteTab === 'all' && inv && (
                          <button onClick={() => handleRemoveInvitee(client.id)} className="text-red-500 text-xs hover:underline font-bold">Remove</button>
                        )}
                        {inviteTab === 'invited' && (
                          <>
                            <button onClick={() => handleUpdateRSVP(client.id, 'rsvp_accepted', 1)} className="bg-yellow-500 text-white font-bold rounded text-xs py-1 px-3 hover:bg-yellow-600">RSVP</button>
                            <button onClick={() => handleUpdateRSVP(client.id, 'declined', 0)} className="bg-red-500 text-white font-bold rounded text-xs py-1 px-3 hover:bg-red-600">Decline</button>
                            <button onClick={() => handleRemoveInvitee(client.id)} className="text-red-500 text-xs hover:underline font-bold ml-2">Remove</button>
                          </>
                        )}
                        {inviteTab === 'rsvp' && (
                          <>
                            <button onClick={() => handleUpdateRSVP(client.id, 'attended', inv.guestCount)} className="bg-green-500 text-white font-bold rounded text-xs py-1 px-3 hover:bg-green-600">Present</button>
                            <button onClick={() => handleRemoveInvitee(client.id)} className="text-red-500 text-xs hover:underline font-bold ml-2">Remove</button>
                          </>
                        )}
                        {(inviteTab === 'attended' || inviteTab === 'declined') && (
                          <button onClick={() => handleRemoveInvitee(client.id)} className="text-red-500 text-xs hover:underline font-bold">Remove</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventInvitesManager;
