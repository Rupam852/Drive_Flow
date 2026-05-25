'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CloudLogo from '@/components/CloudLogo';

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 1. Check Auth persistence
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    // 2. Animate progress bar smoothly from 0 to 100 in 800ms
    const duration = 800; // ms
    const intervalTime = 16; // ~60fps
    const step = 100 / (duration / intervalTime);
    
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Start exit animation
          setIsExiting(true);
          setTimeout(() => {
            router.replace(targetPath);
          }, 400); // Wait for fade out animation
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-dynamic"
        >
          {/* Glassmorphic Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="glass-card p-10 rounded-[2.5rem] flex flex-col items-center max-w-sm w-[90vw] text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 relative overflow-hidden"
          >
            {/* Ambient Background Glow inside the card */}
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Glowing Logo Icon */}
            <motion.div
              animate={{ 
                boxShadow: ["0 0 15px rgba(168,85,247,0.2)", "0 0 30px rgba(236,72,153,0.4)", "0 0 15px rgba(168,85,247,0.2)"] 
              }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-3xl flex items-center justify-center mb-6 border border-white/20 shadow-lg relative"
            >
              <CloudLogo size={42} />
            </motion.div>

            {/* Title with Gradient Text */}
            <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-pink-200 mb-2">
              DriveFlow
            </h1>
            <p className="text-sm text-purple-300/80 mb-8 font-medium">Securing Your Digital Workspace</p>

            {/* Progress Bar Container */}
            <div className="w-full bg-black/35 h-2 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div
                style={{ width: `${Math.min(progress, 100)}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
              />
            </div>

            <div className="mt-4 text-xs font-bold text-white/50 tracking-widest">
              {Math.min(Math.floor(progress), 100)}%
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
