'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Waking up server...');

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    interval = setInterval(() => {
      setProgress(p => {
        if (p < 90) return p + Math.random() * 5;
        return p;
      });
    }, 1000);

    const pingServer = async () => {
      try {
        await api.get('/auth/health'); 
        setProgress(100);
        setMessage('Server is awake!');
        clearInterval(interval);
        
        setTimeout(() => {
          const token = localStorage.getItem('token');
          const role = localStorage.getItem('role');
          const name = localStorage.getItem('name');

          if (token && role) {
            setUserData({ name: name || 'User', role });
            setShowSwitcher(true);
          } else {
            router.push('/login');
          }
        }, 800);
        
      } catch (e: any) {
        setTimeout(pingServer, 3000);
      }
    };

    pingServer();
    return () => clearInterval(interval);
  }, [router]);

  const handleLogoutAndSwitch = () => {
    localStorage.clear();
    router.push('/login');
  };

  const goToDashboard = () => {
    router.push(userData.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-dynamic">
      <div className="glass-card p-10 rounded-[40px] flex flex-col items-center max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-white/10 relative overflow-hidden group">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-1000" />
        
        {!showSwitcher ? (
          <>
            <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl flex items-center justify-center mb-8 shadow-2xl border border-white/10">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white mb-6 tracking-tighter">DriveFlow</h1>
            <h2 className="text-sm font-bold mb-2 text-purple-300 uppercase tracking-widest">
              {message}
            </h2>
            <p className="text-[10px] text-gray-500 mb-10 px-4 leading-relaxed font-medium">
              Connecting to secure nodes. Please wait while we initialize your workspace.
            </p>
            
            <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min(progress, 100)}%`, backgroundSize: '200% 100%', animation: 'gradientMove 2s linear infinite' }}
              />
            </div>
            <div className="mt-4 text-[11px] font-black text-white/40 tracking-[0.3em] uppercase">
              {Math.floor(Math.min(progress, 100))}% Loading
            </div>
          </>
        ) : (
          <div className="w-full animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-6 p-1 shadow-2xl">
              <div className="w-full h-full rounded-full bg-[#0a0a0c] flex items-center justify-center text-3xl font-black text-white">
                {userData.name[0].toUpperCase()}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back,</h2>
            <h3 className="text-lg font-medium text-purple-400 mb-8">{userData.name}</h3>
            
            <div className="space-y-3 w-full">
              <button
                onClick={goToDashboard}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm hover:bg-purple-100 active:scale-95 transition-all shadow-xl"
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleLogoutAndSwitch}
                className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/10 active:scale-95 transition-all"
              >
                Log in as different account
              </button>
            </div>
            
            <p className="mt-8 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              Signed in as {userData.role}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes gradientMove {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
