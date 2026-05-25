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

    // 2. Prefetch the target path immediately in the background to eliminate redirection lag
    router.prefetch(targetPath);

    // 3. Animate progress bar smoothly from 0 to 100 in 800ms
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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-dynamic p-6"
        >
          {/* Glowing Logo Icon directly on the clean background */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="w-24 h-24 bg-sky-100/90 dark:bg-slate-900/95 rounded-[2rem] flex items-center justify-center mb-6 border border-sky-200/30 dark:border-slate-800/30 shadow-[0_15px_35px_rgba(0,0,0,0.15)] relative"
          >
            <CloudLogo size={52} />
          </motion.div>

          {/* Title with sleek, clean text */}
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl font-extrabold tracking-wider text-white mb-2"
          >
            DriveFlow
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm text-sky-200/50 mb-12 font-medium tracking-wide"
          >
            Securing Your Digital Workspace
          </motion.p>

          {/* Sleek, simple progress indicator */}
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "240px", opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col items-center"
          >
            {/* Progress Bar Container */}
            <div className="w-60 bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5 relative shadow-inner">
              <motion.div
                style={{ width: `${Math.min(progress, 100)}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-sky-400"
              />
            </div>

            {/* Progress Percentage */}
            <div className="mt-3 text-xs font-bold text-white/30 tracking-widest">
              {Math.min(Math.floor(progress), 100)}%
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
