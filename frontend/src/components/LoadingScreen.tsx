'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function LoadingScreen({ 
  message = 'Connecting to Server...', 
  progress: customProgress,
  showSubtext = true
}: { 
  message?: string, 
  progress?: number,
  showSubtext?: boolean
}) {
  const [internalProgress, setInternalProgress] = useState(0);

  useEffect(() => {
    if (customProgress !== undefined) return;
    
    const interval = setInterval(() => {
      setInternalProgress(p => {
        if (p < 90) return p + Math.random() * 5;
        return p;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [customProgress]);

  const displayProgress = customProgress !== undefined ? customProgress : internalProgress;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-dynamic">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-10 rounded-3xl flex flex-col items-center max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
      >
        {/* Logo / Icon */}
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/10">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-6 tracking-wider">DriveFlow</h1>
        
        <h2 className="text-sm font-medium mb-2 text-purple-300">
          {message}
        </h2>

        {showSubtext && (
          <p className="text-[10px] text-gray-500 mb-8 px-2 leading-relaxed">
            Free servers may take 30-50 seconds to wake up from sleep mode. Please hold on while we connect!
          </p>
        )}
        
        {/* Progress Bar Container */}
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(displayProgress, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
            style={{ backgroundSize: '200% 100%', animation: 'gradientMove 2s linear infinite' }}
          />
        </div>

        <div className="mt-4 text-[10px] font-black text-white/50 tracking-widest">
          {Math.floor(Math.min(displayProgress, 100))}%
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes gradientMove {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}
