'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HardDrive } from 'lucide-react';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    // 1. Prefetch destination page in background
    router.prefetch(targetPath);

    // 2. Perform non-blocking background ping (silent warm-up)
    api.get('/auth/ping').catch(() => {});

    // 3. Smooth 600ms splash display then seamless transition
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => {
        router.replace(targetPath);
      }, 200);
    }, 600);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className={`min-h-screen w-full bg-[#080711] flex flex-col items-center justify-center relative overflow-hidden transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      {/* Soft Ambient Background Orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-60 h-60 bg-violet-600/15 rounded-full blur-[90px] pointer-events-none" />

      {/* Center Glass Card Container */}
      <div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-3xl soft-glass-card border border-white/10 shadow-2xl animate-fade-in max-w-xs w-full text-center">
        {/* App Logo Badge */}
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 via-purple-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <HardDrive className="w-10 h-10 text-white animate-pulse" />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">DriveFlow</h1>
          <p className="text-xs text-purple-300/70 font-medium">Securing Workspace...</p>
        </div>

        {/* Soft Glowing Spinner */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
