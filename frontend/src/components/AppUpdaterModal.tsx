'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import CloudLogo from '@/components/CloudLogo';

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
  const handleDownloadAndInstall = () => {
    const url = downloadUrl || 'https://neo-files-transfer.pages.dev/download/723586892fd0';
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 dark:bg-[#0f172a]/95 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center relative"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/15 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all z-10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="pt-7 pb-4 px-6 flex flex-col items-center">
              <div className="relative mb-3">
                <CloudLogo size={56} />
                {hasUpdate && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-2 ring-white dark:ring-[#0f172a]"></span>
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                App Updates
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                DriveFlow Mobile APK Updater
              </p>
            </div>

            {/* Version Badges */}
            <div className="px-6 py-2">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Current Version
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">
                    {currentVersion}
                  </span>
                </div>
                <div className="flex flex-col items-center border-l border-slate-200 dark:border-white/10">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Latest Version
                  </span>
                  <span
                    className={`text-xs font-bold mt-0.5 ${
                      hasUpdate
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-800 dark:text-white'
                    }`}
                  >
                    {latestVersion}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Message Card */}
            <div className="px-6 py-3">
              {hasUpdate ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      New Update Available!
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-0.5 leading-snug">
                      Version {latestVersion} is ready to install with fresh features & optimizations.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-left flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                      You are up to date!
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 leading-snug">
                      You are running the latest version of DriveFlow Android app.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-4 space-y-2">
              {hasUpdate && (
                <button
                  onClick={handleDownloadAndInstall}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download & Update</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                </button>
              )}

              <button
                onClick={() => onCheckForUpdates()}
                disabled={isChecking}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Checking Server...' : 'Check for Updates'}</span>
              </button>
            </div>

            {/* Auto Check Setting Toggle */}
            <div className="px-6 py-3 border-t border-slate-200/60 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 flex items-center justify-between">
              <div className="text-left pr-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-white">
                  Auto check updates
                </p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">
                  Check automatically on app open
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                role="switch"
                aria-checked={autoCheckEnabled}
                onClick={() => onToggleAutoCheck(!autoCheckEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                  autoCheckEnabled ? 'bg-blue-600 dark:bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
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
