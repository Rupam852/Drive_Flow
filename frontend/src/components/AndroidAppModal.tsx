'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles, QrCode, Scan } from 'lucide-react';
import QRCode from 'qrcode';

interface AndroidAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl?: string;
}

const DEFAULT_DOWNLOAD_URL = 'https://neofilestransfer.site/download/723586892fd0';

export default function AndroidAppModal({
  isOpen,
  onClose,
  downloadUrl = DEFAULT_DOWNLOAD_URL
}: AndroidAppModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(downloadUrl, {
        width: 256,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then((url: string) => setQrCodeUrl(url))
        .catch((err: any) => console.error('Failed to generate QR code:', err));
    }
  }, [isOpen, downloadUrl]);

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
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
            className="bg-white/95 dark:bg-[#0f172a]/95 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 w-full max-w-sm p-6 relative overflow-hidden text-center group"
          >
            {/* Close X Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all z-10 cursor-pointer"
              aria-label="Close popup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* QR Code Container - Positioned right above Title */}
            <div className="flex flex-col items-center mb-3">
              <div className="relative p-2.5 rounded-2xl bg-white border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10 mb-2.5 group/qr">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Scan to Download DriveFlow Android App"
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl object-contain block mx-auto"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-100 rounded-xl">
                    <QrCode className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                )}
                {/* Scan Pill Tag */}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1 whitespace-nowrap">
                  <Scan className="w-3 h-3" />
                  <span>Scan to Download</span>
                </div>
              </div>

              {/* Official Android App Badge */}
              <span className="mt-3 px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Official Android App
              </span>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
              DriveFlow Android App Available
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed mb-6">
              Scan this QR code with your phone camera or click below to open our official download page.
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
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
