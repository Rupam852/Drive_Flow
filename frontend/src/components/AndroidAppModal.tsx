'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';

interface AndroidAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AndroidAppModal({ isOpen, onClose }: AndroidAppModalProps) {
  const handleDownload = () => {
    window.open('https://neo-files-transfer.pages.dev/download/723586892fd0', '_blank');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a]/95 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.15)] w-full max-w-md p-6 relative overflow-hidden text-center group"
          >
            {/* Close X Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all z-10"
              aria-label="Close popup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon Header */}
            <div className="flex flex-col items-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner mb-3">
                <Smartphone className="w-8 h-8" />
              </div>
              <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Official Android App
              </span>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
              DriveFlow Android App Available
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Download our official native Android app for faster file access and seamless file management.
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
              >
                Close
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download App</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
