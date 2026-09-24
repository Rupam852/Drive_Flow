'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertTriangle } from 'lucide-react';
import CloudLogo from './CloudLogo';
import api from '@/lib/api';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { App } from '@capacitor/app';

// Current Hardcoded Version of the Client APK
const CURRENT_APP_VERSION = '1.0.4';

interface AppUpdateContextType {
  currentVersion: string;
}

const AppUpdateContext = createContext<AppUpdateContextType | null>(null);

const compareVersions = (current: string, required: string) => {
  const currParts = current.split('.').map(Number);
  const reqParts = required.split('.').map(Number);
  for (let i = 0; i < Math.max(currParts.length, reqParts.length); i++) {
    const curr = currParts[i] || 0;
    const req = reqParts[i] || 0;
    if (curr < req) return -1;
    if (curr > req) return 1;
  }
  return 0;
};

export default function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  // Intercept physical Back button on Android to prevent bypassing the forced-update screen
  useAndroidBack(() => {
    if (updateRequired) {
      try {
        App.exitApp();
      } catch (err) {
        console.error('Failed to exit app on back press:', err);
      }
      return true; // Stop event propagation
    }
    return false; // Let normal back actions proceed
  }, 100, [updateRequired]);

  useEffect(() => {
    const checkAppVersion = async () => {
      // 1. Detect if running inside Capacitor Android APK vs Live Web Browser
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor;

      // Only check version inside the native app / test emulator
      if (!isNative) return;

      try {
        const response = await api.get('/auth/app-version');
        const { minRequiredVersion, latestVersion: serverLatest, downloadUrl: serverUrl } = response.data;

        // 2. If the current version is less than the minimum required version, trigger force-update
        if (compareVersions(CURRENT_APP_VERSION, minRequiredVersion) < 0) {
          setLatestVersion(serverLatest);
          setDownloadUrl(serverUrl);
          setUpdateRequired(true);
        }
      } catch (error) {
        console.error('Failed to verify app version with Render:', error);
      }
    };

    checkAppVersion();
  }, []);

  const handleUpdate = (e: React.MouseEvent) => {
    if (!downloadUrl) return;
    
    // Prevent double triggers from concurrent native opens
    e.preventDefault();
    
    // Safely trigger external system browser launch
    try {
      window.open(downloadUrl, '_system');
    } catch (err) {
      console.error('Failed to trigger native update launch:', err);
      // Fallback
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <AppUpdateContext.Provider value={{ currentVersion: CURRENT_APP_VERSION }}>
      {children}

      {/* Force Update Non-Dismissible Overlay Modal */}
      <AnimatePresence>
        {updateRequired && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-gradient-dynamic backdrop-blur-md select-none touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="glass-card max-w-md w-full p-8 rounded-[2.5rem] border border-white/10 text-center flex flex-col items-center shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              {/* Decorative radial glows */}
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

              {/* Logo Badge */}
              <div className="w-20 h-20 bg-sky-100/90 dark:bg-slate-900/95 rounded-[2rem] flex items-center justify-center mb-6 border border-sky-200/30 dark:border-slate-800/30 shadow-lg relative">
                <CloudLogo size={42} />
              </div>

              {/* Warning/Alert Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">Mandatory Update</span>
              </div>

              {/* Title & Subtext */}
              <h2 className="text-2xl font-extrabold text-white tracking-wide mb-2">New Update Available</h2>
              <p className="text-sm text-sky-200/50 mb-6 leading-relaxed">
                You are currently running an outdated version. Please download the latest update to keep your files secure and functional.
              </p>

              {/* Version Comparison Info */}
              <div className="w-full flex items-center justify-around py-3 px-4 bg-white/5 rounded-2xl border border-white/5 mb-8 text-xs font-semibold text-white/60">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-white/30 tracking-wider mb-1">Your Version</span>
                  <span className="text-white text-sm font-bold bg-white/10 px-2.5 py-1 rounded-lg">v{CURRENT_APP_VERSION}</span>
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-sky-300/30 tracking-wider mb-1">Required Version</span>
                  <span className="text-sky-300 text-sm font-bold bg-sky-500/10 px-2.5 py-1 rounded-lg">v{latestVersion}</span>
                </div>
              </div>

              {/* Action Link Button */}
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={downloadUrl}
                target="_system"
                rel="noopener noreferrer"
                onClick={handleUpdate}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-sky-400 hover:from-blue-700 hover:to-sky-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(37,99,235,0.3)] cursor-pointer no-underline"
              >
                <Download className="w-5 h-5" />
                <span>Update Now</span>
              </motion.a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppUpdateContext.Provider>
  );
}

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext);
  if (!context) throw new Error('useAppUpdate must be used within AppUpdateProvider');
  return context;
};
