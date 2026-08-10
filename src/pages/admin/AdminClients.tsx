import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { LayoutGrid, List } from 'lucide-react';

const AdminClients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    priority: 'Normal',
    office: '',
    rm: ''
  });
  
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'priority'
  const [viewMode, setViewMode] = useState<'tiles' | 'list'>('tiles');

  const fetchData = async () => {
    try {
      const [clientsSnap, eventsSnap] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'events'))
      ]);
      setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setEvents(eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), newClient);
      } else {
        await addDoc(collection(db, 'clients'), newClient);
      }
      setShowModal(false);
      setEditingClient(null);
      setNewClient({ name: '', email: '', phone: '', dob: '', priority: 'Normal', office: '', rm: '' });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to save client.");
    }
  };

  const openEditModal = (client: any) => {
    setEditingClient(client);
    setNewClient({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      dob: client.dob || '',
      priority: client.priority || 'Normal',
      office: client.office || '',
      rm: client.rm || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      await deleteDoc(doc(db, 'clients', id));
      fetchData();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        let importedCount = 0;
        // Skip first row (index 0)
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;

          const name = row[1] ? String(row[1]).trim() : '';
          const email = row[2] ? String(row[2]).trim() : '';
          const mobile = row[3] ? String(row[3]).trim() : '';
          const rm = row[4] ? String(row[4]).trim() : '';

          if (name) {
            await addDoc(collection(db, 'clients'), {
              name,
              email,
              phone: mobile,
              rm,
              priority: 'Normal',
              office: '',
              dob: ''
            });
            importedCount++;
          }
        }
        
        alert(`Successfully imported ${importedCount} clients!`);
        fetchData();
      } catch (err: any) {
        alert("Error parsing file: " + err.message);
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.rm?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.office?.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (sortBy === 'priority') {
      const priorityWeights: Record<string, number> = { 'VVIP': 4, 'VIP': 3, 'Important': 2, 'Normal': 1 };
      const weightA = priorityWeights[a.priority] || 0;
      const weightB = priorityWeights[b.priority] || 0;
      return weightB - weightA; // Descending order
    } else if (sortBy === 'rm') {
      return (a.rm || '').localeCompare(b.rm || '');
    }
    return 0;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-black/10 dark:border-white/20 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Client Directory</h2>
          <p className="opacity-70 mt-1">Manage client profiles, priorities, and Relationship Managers.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <select 
            className="glass-input !w-auto"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name" className="bg-white dark:bg-slate-900 text-black dark:text-white">Sort by Name</option>
            <option value="priority" className="bg-white dark:bg-slate-900 text-black dark:text-white">Sort by Priority</option>
            <option value="rm" className="bg-white dark:bg-slate-900 text-black dark:text-white">Sort by RM</option>
          </select>
          <div className="flex bg-black/5 dark:bg-white/10 rounded-lg p-1">
            <button onClick={() => setViewMode('tiles')} className={`p-2 rounded transition-colors ${viewMode === 'tiles' ? 'bg-white dark:bg-black/40 shadow text-primary' : 'opacity-50 hover:opacity-100'}`} title="Tile View">
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-black/40 shadow text-primary' : 'opacity-50 hover:opacity-100'}`} title="List View">
              <List size={18} />
            </button>
          </div>
          <input 
            type="text" 
            placeholder="Search clients..." 
            className="glass-input !w-auto flex-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="btn-secondary whitespace-nowrap cursor-pointer">
            + Import Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={() => {
            setEditingClient(null);
            setNewClient({ name: '', email: '', phone: '', dob: '', priority: 'Normal', office: '', rm: '' });
            setShowModal(true);
          }} className="btn-primary whitespace-nowrap">
            + Add Client
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="glass overflow-x-auto rounded-xl">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-sm opacity-70">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Priority</th>
                <th className="p-4 font-medium">Office</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">RM</th>
                <th className="p-4 font-medium">Events (I/R/A)</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const invitedEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id));
                const registeredEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id && (inv.status === 'rsvp_accepted' || inv.status === 'attended')));
                const attendedEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id && inv.status === 'attended'));
                
                return (
                  <tr key={client.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">{client.name}</td>
                    <td className="p-4">
                      <span className={`font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded ${
                        client.priority === 'VVIP' ? 'bg-red-500/20 text-red-500' :
                        client.priority === 'VIP' ? 'bg-purple-500/20 text-purple-500' :
                        client.priority === 'Important' ? 'bg-blue-500/20 text-blue-500' :
                        'bg-black/5 dark:bg-white/10'
                      }`}>{client.priority || 'Normal'}</span>
                    </td>
                    <td className="p-4 text-sm">{client.office || 'N/A'}</td>
                    <td className="p-4 text-sm">{client.phone || 'N/A'}</td>
                    <td className="p-4 text-sm"><span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-xs">{client.rm || 'Unassigned'}</span></td>
                    <td className="p-4 text-sm">
                      <span className="text-yellow-500 font-bold" title="Invited">{invitedEvents.length}</span> / <span className="text-primary font-bold" title="Registered">{registeredEvents.length}</span> / <span className="text-green-500 font-bold" title="Attended">{attendedEvents.length}</span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEditModal(client)} className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded hover:bg-black/20 dark:hover:bg-white/20 transition-colors mr-2">Edit</button>
                      <button onClick={() => handleDelete(client.id)} className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500/20 transition-colors">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map(client => {
          // Calculate event stats for this client
          // We need to look through all events to see where this client is in the invite list
          const invitedEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id));
          const registeredEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id && (inv.status === 'rsvp_accepted' || inv.status === 'attended')));
          const attendedEvents = events.filter(e => e.invitees?.some((inv: any) => inv.clientId === client.id && inv.status === 'attended'));

          return (
            <div key={client.id} className="glass p-6 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all relative flex flex-col h-full">
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => openEditModal(client)} className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded hover:bg-black/20 dark:hover:bg-white/20 transition-colors">Edit</button>
                <button onClick={() => handleDelete(client.id)} className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500/20 transition-colors">Delete</button>
              </div>
              
              <h3 className="text-xl font-bold mb-1 pr-24 text-blue-600 dark:text-blue-400">{client.name}</h3>
              
              <div className="space-y-2 mt-4 flex-1">
                <div className="flex justify-between items-center text-sm border-b border-black/5 dark:border-white/5 pb-2">
                  <span className="opacity-70">Priority:</span>
                  <span className={`font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded ${
                    client.priority === 'VVIP' ? 'bg-red-500/20 text-red-500' :
                    client.priority === 'VIP' ? 'bg-purple-500/20 text-purple-500' :
                    client.priority === 'Important' ? 'bg-blue-500/20 text-blue-500' :
                    'bg-black/5 dark:bg-white/10'
                  }`}>{client.priority || 'Normal'}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-black/5 dark:border-white/5 pb-2">
                  <span className="opacity-70">Office:</span>
                  <span className="font-medium">{client.office || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-black/5 dark:border-white/5 pb-2">
                  <span className="opacity-70">Phone:</span>
                  <span className="font-medium">{client.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-black/5 dark:border-white/5 pb-2">
                  <span className="opacity-70">DOB:</span>
                  <span className="font-medium">{client.dob || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm pb-2">
                  <span className="opacity-70">RM:</span>
                  <span className="font-medium bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-xs">{client.rm || 'Unassigned'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 rounded-lg">
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Event History</h4>
                <div className="flex justify-between text-sm">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-yellow-500">{invitedEvents.length}</span>
                    <span className="text-[10px] uppercase opacity-70">Invited</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-primary">{registeredEvents.length}</span>
                    <span className="text-[10px] uppercase opacity-70">Registered</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-green-500">{attendedEvents.length}</span>
                    <span className="text-[10px] uppercase opacity-70">Attended</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      {filteredClients.length === 0 && <p className="opacity-70 col-span-full text-center py-8">No clients found.</p>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold mb-6">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Client Name</label>
                <input type="text" required className="glass-input" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block opacity-80">Email</label>
                  <input type="email" placeholder="e.g. email@example.com" className="glass-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block opacity-80">Phone No</label>
                  <input type="text" placeholder="e.g. +1 234 567 890" className="glass-input" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block opacity-80">Date of Birth</label>
                  <input type="date" className="glass-input" value={newClient.dob} onChange={e => setNewClient({...newClient, dob: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block opacity-80">Priority</label>
                  <select className="glass-input appearance-none bg-white dark:bg-black/20" value={newClient.priority} onChange={e => setNewClient({...newClient, priority: e.target.value})}>
                    <option value="VVIP" className="bg-white dark:bg-slate-900 text-black dark:text-white">VVIP</option>
                    <option value="VIP" className="bg-white dark:bg-slate-900 text-black dark:text-white">VIP</option>
                    <option value="Important" className="bg-white dark:bg-slate-900 text-black dark:text-white">Important</option>
                    <option value="Normal" className="bg-white dark:bg-slate-900 text-black dark:text-white">Normal</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Office</label>
                <input type="text" placeholder="e.g. New York" className="glass-input" value={newClient.office} onChange={e => setNewClient({...newClient, office: e.target.value})} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block opacity-80">Relationship Manager (RM)</label>
                <input type="text" placeholder="e.g. John Doe" className="glass-input" value={newClient.rm} onChange={e => setNewClient({...newClient, rm: e.target.value})} />
              </div>
              
              <div className="flex gap-4 mt-6 pt-4 border-t border-black/10 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editingClient ? 'Save Changes' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
