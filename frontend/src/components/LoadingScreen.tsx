'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Connecting to Server...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-dynamic">
      <div className="glass-card p-10 rounded-3xl flex flex-col items-center max-w-sm w-full text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="mb-6"
        >
          <Loader2 className="w-16 h-16 text-[var(--color-primary)]" />
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl font-semibold mb-2 text-white"
        >
          {message}
        </motion.h2>
        <motion.div 
          className="w-full bg-white/10 h-2 rounded-full mt-4 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
        </motion.div>
      </div>
    </div>
  );
}
