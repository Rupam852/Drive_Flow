'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Zap,
} from 'lucide-react';
import CloudLogo from '@/components/CloudLogo';
import { useAndroidBack } from '@/hooks/useAndroidBack';

interface AppUpdaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl: string;
  isChecking: boolean;
  statusMessage: string | null;
  autoCheckEnabled: boolean;
  onCheckForUpdates: () => Promise<void>;
  onToggleAutoCheck: (enabled: boolean) => void;
}

export default function AppUpdaterModal({
  isOpen,
  onClose,
  currentVersion,
  latestVersion,
  hasUpdate,
  downloadUrl,
  isChecking,
  statusMessage,
  autoCheckEnabled,
  onCheckForUpdates,
  onToggleAutoCheck,
}: AppUpdaterModalProps) {
  // Allow Android hardware back button to dismiss the updater modal
  useAndroidBack(() => {
    if (isOpen) {
      onClose();
      return true; // Handled
    }
    return false;
  }, 20, [isOpen, onClose]);

  const handleDownloadAndInstall = () => {
    const url = downloadUrl || 'https://neo-files-transfer.pages.dev/download/723586892fd0';
    try {
      window.open(url, '_system');
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none touch-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[2.5rem] bg-white/95 dark:bg-[#0c101c]/95 border border-slate-200/90 dark:border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden text-center relative"
          >
            {/* Ambient Background Glows */}
            {hasUpdate ? (
              <>
                <div className="absolute -top-16 -left-10 w-44 h-44 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -right-10 w-44 h-44 bg-teal-500/15 dark:bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
              </>
            ) : (
              <>
                <div className="absolute -top-16 -left-10 w-44 h-44 bg-blue-500/15 dark:bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -right-10 w-44 h-44 bg-indigo-500/15 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              </>
            )}

            {/* Close Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all z-10 cursor-pointer shadow-sm"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Modal Header */}
            <div className="pt-8 pb-3 px-6 flex flex-col items-center">
              <div className="relative mb-3.5 flex items-center justify-center">
                <div className="w-20 h-20 rounded-[1.75rem] bg-gradient-to-tr from-slate-100 via-sky-50/70 to-blue-50 dark:from-sky-500/10 dark:via-blue-900/20 dark:to-slate-900 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shadow-lg shadow-slate-200/60 dark:shadow-slate-950/40 relative">
                  <CloudLogo size={46} />
                </div>

                {hasUpdate && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 ring-2 ring-white dark:ring-[#0c101c]"></span>
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border mb-2.5 transition-colors ${
                  hasUpdate
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-sky-300'
                }`}
              >
                {hasUpdate ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">
                      New Release Available
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest">
                      System Up to Date
                    </span>
                  </>
                )}
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                App Updates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                DriveFlow Mobile APK System
              </p>
            </div>

            {/* Version Badges Card */}
            <div className="px-6 py-2">
              <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 flex items-center justify-between">
                <div className="flex-1 text-center">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                    Installed
                  </span>
                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200/80 dark:border-transparent text-xs font-extrabold text-slate-800 dark:text-white shadow-xs">
                    {currentVersion}
                  </span>
                </div>

                <div className="px-2 text-slate-400 dark:text-white/20">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="flex-1 text-center">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                    Target
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg border text-xs font-extrabold shadow-xs ${
                      hasUpdate
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-white/10 border-slate-200/80 dark:border-transparent text-slate-800 dark:text-white'
                    }`}
                  >
                    {latestVersion}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Message Info Banner */}
            <div className="px-6 py-3">
              {hasUpdate ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/25 text-left flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Performance & Security Update
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                      Version {latestVersion} is ready with speed improvements, offline intelligence & fixes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/70 dark:border-white/5 text-left flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                      You are on the latest release
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Your app is secured with all the latest features and optimizations.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-4 space-y-2.5">
              {hasUpdate && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownloadAndInstall}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download & Install v{latestVersion}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onCheckForUpdates()}
                disabled={isChecking}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-sky-400 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Checking Server...' : 'Check for Updates'}</span>
              </motion.button>
            </div>

            {/* Auto Check Setting Toggle */}
            <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 flex items-center justify-between">
              <div className="text-left pr-2">
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  Auto check updates
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Notify automatically on app launch
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={autoCheckEnabled}
                onClick={() => onToggleAutoCheck(!autoCheckEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                  autoCheckEnabled
                    ? 'bg-blue-600 dark:bg-sky-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`bg-white w-4 h-4 rounded-full shadow-md ${
                    autoCheckEnabled ? 'ml-5' : 'ml-0'
                  }`}
                />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
