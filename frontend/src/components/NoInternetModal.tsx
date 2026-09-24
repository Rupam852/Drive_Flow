'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Settings2, AlertCircle, Radio, LogOut } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { App } from '@capacitor/app';
import { notifyNetworkReconnected } from '@/lib/api';

export default function NoInternetModal() {
  const {
    isOffline,
    isChecking,
    isNativeAndroid,
    checkConnection,
    openSettings,
  } = useNetworkStatus();

  const [hasTriedOnce, setHasTriedOnce] = useState(false);

  // Intercept Android hardware back button when no-internet modal is active
  useAndroidBack(() => {
    if (isOffline && isNativeAndroid) {
      try {
        App.exitApp();
      } catch (err) {
        console.error('Failed to exit app on back press:', err);
      }
      return true; // Stop event propagation
    }
    return false;
  }, 100, [isOffline, isNativeAndroid]);

  const handleRetry = async () => {
    setHasTriedOnce(true);
    const online = await checkConnection();
    if (online) {
      notifyNetworkReconnected();
    }
  };

  const handleOpenSettings = async () => {
    await openSettings();
  };

  const handleExitApp = () => {
    try {
      App.exitApp();
    } catch (e) {
      console.error('Error exiting app:', e);
    }
  };

  // Only render on native Android app when offline
  if (!isNativeAndroid) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="no-internet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-5 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md select-none touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ scale: 0.92, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm p-6 sm:p-7 rounded-[2rem] bg-white/95 dark:bg-[#0c101c]/95 border border-slate-200/90 dark:border-white/10 text-center flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] relative overflow-hidden backdrop-blur-xl"
          >
            {/* Subtle, Calm Background Accent (Non-Distracting) */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-slate-500/5 dark:bg-slate-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/5 dark:bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Normal-sized, Clean Wifi Icon Container (No Heavy Animation) */}
            <div className="mb-3.5 flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 flex items-center justify-center shadow-sm text-rose-600 dark:text-rose-400">
                <WifiOff className="w-7 h-7 stroke-[2]" />
              </div>
            </div>

            {/* Status Chip / Badge (Clean & Normal) */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200/70 dark:border-rose-500/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Offline
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-1.5">
              No Internet Connection
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300/80 leading-relaxed mb-4 px-2">
              Your device is currently disconnected. Please turn on Wi-Fi or Mobile Data to continue using DriveFlow.
            </p>

            {/* Live Monitoring Info Pill (Clean & Calm) */}
            <div className="w-full mb-4 py-2 px-3 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                <span>Auto-reconnect</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Active</span>
              </div>
            </div>

            {/* Feedback notice when user retried but still offline */}
            {hasTriedOnce && !isChecking && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mb-3.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Still offline. Please check your network.</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-2">
              {/* Primary Retry Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleRetry}
                disabled={isChecking}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Checking Connection...' : 'Retry Connection'}</span>
              </motion.button>

              {/* Secondary Internet Settings Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleOpenSettings}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Settings2 className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                <span>Internet Settings</span>
              </motion.button>
            </div>

            {/* Footer Exit App Option */}
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Auto-closes when connection restores
              </p>

              <button
                onClick={handleExitApp}
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors pt-0.5 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit App</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
