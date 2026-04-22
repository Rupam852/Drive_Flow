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
    
    // Simulate progress bar moving slowly up to 90% while waiting
    interval = setInterval(() => {
      setProgress(p => {
        if (p < 90) return p + Math.random() * 5;
        return p;
      });
    }, 1000);

    const pingServer = async () => {
      try {
        // Ping the health endpoint
        await api.get('/auth/health'); 
        
        // Success! Server is awake.
        setProgress(100);
        setMessage('Server is awake! Redirecting...');
        clearInterval(interval);
        
        setTimeout(() => {
          // Check if user is already logged in
          const token = localStorage.getItem('token');
          const role = localStorage.getItem('role');
          
          if (token && role) {
            router.push(role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
          } else {
            router.push('/login');
          }
        }, 800);
        
      } catch (e: any) {
        // If network error, it might still be waking up. Keep retrying.
        setTimeout(pingServer, 3000);
      }
    };

    pingServer();

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-dynamic">
      <div className="glass-card p-10 rounded-3xl flex flex-col items-center max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/10">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-6 tracking-wider">DriveFlow</h1>
        <h2 className="text-sm font-medium mb-2 text-purple-300">
          {message}
        </h2>
        <p className="text-[10px] text-gray-500 mb-8 px-2 leading-relaxed">
          Free servers may take 30-50 seconds to wake up from sleep mode. Please hold on while we connect!
        </p>
        
        {/* Progress Bar */}
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundSize: '200% 100%', animation: 'gradientMove 2s linear infinite' }}
          />
        </div>
        <div className="mt-4 text-[10px] font-black text-white/50 tracking-widest">
          {Math.floor(Math.min(progress, 100))}%
        </div>
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
