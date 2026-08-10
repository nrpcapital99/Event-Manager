import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const Login = () => {
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Wait to ensure auth state is updated, or just navigate
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // 1. Check if code exists and is active in Firestore
      const codesRef = collection(db, 'codes');
      const q = query(codesRef, where('code', '==', code), where('active', '==', true));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Invalid or inactive code.');
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = { id: codeDoc.id, ...codeDoc.data() };

      // 2. Sign in anonymously
      await signInAnonymously(auth);
      
      // We can pass state to router or let context handle it
      navigate('/employee', { state: { employeeData: codeData } });
      
    } catch (err: any) {
      setError(err.message || 'Failed to login with code');
    }
  };

  return (
    <div className="w-full max-w-md glass-panel relative overflow-hidden transition-all duration-500">
      {/* Decorative background elements inside the glass */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
        <h2 className="text-3xl font-light tracking-wider mb-6 text-center">
          NRP Event<span className="font-bold">Manager</span>
        </h2>
        
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setRole('employee')}
            className={`flex-1 py-2 rounded-lg transition-all duration-300 ${role === 'employee' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-primary/10'}`}
          >
            Employee Code
          </button>
          <button
            onClick={() => setRole('admin')}
            className={`flex-1 py-2 rounded-lg transition-all duration-300 ${role === 'admin' ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-primary/10'}`}
          >
            Admin Login
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm text-center backdrop-blur-md">
            {error}
          </div>
        )}

        {role === 'admin' ? (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                required
              />
            </div>
            <button type="submit" className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-lg hover:shadow-lg transition-all duration-300 font-medium">
              Access Dashboard
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Enter Access Code (e.g. EMP-XXXX)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="glass-input text-center text-lg tracking-widest uppercase"
                required
              />
            </div>
            <button type="submit" className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-lg hover:shadow-lg transition-all duration-300 font-medium">
              Join Event
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
