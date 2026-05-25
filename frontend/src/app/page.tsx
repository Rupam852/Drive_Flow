'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Download, ArrowRight, HardDrive, Cpu, Users, Eye, Sparkles } from 'lucide-react';
import CloudLogo from '@/components/CloudLogo';

export default function Home() {
  const router = useRouter();
  
  // Detection and state manager
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSplashExiting, setIsSplashExiting] = useState(false);

  useEffect(() => {
    // 1. Detect if running inside Capacitor Android APK vs Live Web Browser
    const isWeb = typeof window !== 'undefined' && (
      window.location.hostname.includes('driveflowrupam') ||
      window.location.hostname.includes('vercel.app')
    );
    const isNative = !isWeb;
    setIsNativeApp(isNative);

    // 2. Auth Persistence and Target Pre-fetching
    const role = localStorage.getItem('role');
    const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
    const targetPath = (role && token) ? (role === 'admin' ? '/admin/dashboard' : '/user/dashboard') : '/login';

    router.prefetch(targetPath);

    // 3. If running inside the Mobile APK, run splash timer for instant redirection
    if (isNative) {
      const duration = 800; // ms
      const intervalTime = 16;
      const step = 100 / (duration / intervalTime);
      
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setIsSplashExiting(true);
            setTimeout(() => {
              router.replace(targetPath);
            }, 300);
            return 100;
          }
          return prev + step;
        });
      }, intervalTime);

      return () => clearInterval(timer);
    }
  }, [router]);

  // APK Mobile Splash Screen Render (Fast & Clean)
  if (isNativeApp) {
    return (
      <AnimatePresence>
        {!isSplashExiting && (
          <motion.div
            key="mobile-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-dynamic p-6 select-none touch-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="w-24 h-24 bg-sky-100/90 dark:bg-slate-900/95 rounded-[2rem] flex items-center justify-center mb-6 border border-sky-200/30 dark:border-slate-800/30 shadow-lg"
            >
              <CloudLogo size={52} />
            </motion.div>

            <h1 className="text-4xl font-extrabold tracking-wider text-white mb-2">DriveFlow</h1>
            <p className="text-sm text-sky-200/50 mb-12 font-medium tracking-wide">Securing Your Digital Workspace</p>

            <div className="w-60 bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div
                style={{ width: `${Math.min(progress, 100)}%` }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-sky-400"
              />
            </div>
            <div className="mt-3 text-xs font-bold text-white/30 tracking-widest">
              {Math.min(Math.floor(progress), 100)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Web Browser / Website Promotional Landing Page (Premium design)
  return (
    <div className="min-h-screen bg-[#070913] text-white overflow-x-hidden selection:bg-blue-600/30 relative">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[45%] h-[45%] bg-sky-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* HEADER / NAVIGATION */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
            <CloudLogo size={24} />
          </div>
          <span className="text-xl font-extrabold tracking-wide text-white">DriveFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all text-sm cursor-pointer"
          >
            Sign In
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/register')}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-sm shadow-[0_10px_20px_rgba(37,99,235,0.2)] cursor-pointer"
          >
            Register
          </motion.button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center relative z-10 flex flex-col items-center">
        
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-8"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Modern Cloud Storage Workspace</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-5xl md:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.1] mb-6"
        >
          The Secure Hub for <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">Digital Files</span>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed mb-12"
        >
          Manage your cloud assets securely, track login histories, receive real-time notifications, and perform seamless file actions inside the sleekest workspace yet.
        </motion.p>

        {/* Call to Actions (CTAs) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md"
        >
          <motion.a
            href="https://drive.google.com/file/d/1WvMSCKstDyINwRP51YlUh1F2RSKDUg5h/view?usp=drivesdk"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-sky-400 hover:from-blue-700 hover:to-sky-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 shadow-[0_15px_30px_rgba(37,99,235,0.3)] cursor-pointer"
          >
            <Download className="w-5 h-5" />
            <span>Download Android App</span>
          </motion.a>
          
          <motion.button
            onClick={() => router.push('/login')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Web Portal</span>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </motion.button>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="w-full max-w-5xl mt-20 relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] aspect-[16/9] bg-[#0c1022]"
        >
          {/* Mockup Top Header bar */}
          <div className="absolute top-0 inset-x-0 h-10 bg-white/5 border-b border-white/5 flex items-center px-6 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <div className="h-4 w-48 bg-white/5 rounded-full mx-auto" />
          </div>
          
          {/* Glass Overlay Glow inside mockup */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 via-transparent to-purple-600/10 pointer-events-none" />
          
          <div className="absolute inset-0 pt-10 flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <CloudLogo size={70} />
              <h3 className="text-xl font-bold text-white">Interactive Digital Workspace</h3>
              <p className="text-xs text-gray-500 max-w-sm">Access your encrypted files, monitor logs, and trigger administrative welcome triggers seamlessly.</p>
            </div>
          </div>
        </motion.div>

      </section>

      {/* CORE FEATURES SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5 relative z-10">
        
        <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
          <h2 className="text-3xl font-extrabold text-white">Engineered For Performance</h2>
          <p className="text-sm text-gray-400 leading-relaxed">Built from the ground up to ensure robust cloud operations, native Android compatibility, and premium client features.</p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card p-8 rounded-[2rem] border border-white/5 space-y-6 relative overflow-hidden bg-[#0c0f1d]/50"
          >
            <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Robust Encrypted Storage</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Ensure maximum confidentiality with bank-grade encryption protocols protecting your files from end to end.
              </p>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card p-8 rounded-[2rem] border border-white/5 space-y-6 relative overflow-hidden bg-[#0c0f1d]/50"
          >
            <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center text-sky-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Automatic Version Sync</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Auto-update checks natively trigger to deliver safety patches instantly without manual server configs.
              </p>
            </div>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="glass-card p-8 rounded-[2rem] border border-white/5 space-y-6 relative overflow-hidden bg-[#0c0f1d]/50"
          >
            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Asynchronous Relays</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                All background approval welcome dispatches operate asynchronously, avoiding interface latency and lagging.
              </p>
            </div>
          </motion.div>

        </div>

      </section>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 relative z-10 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
        <div className="flex items-center gap-2">
          <CloudLogo size={16} />
          <span className="font-bold text-white">DriveFlow</span>
          <span>© {new Date().getFullYear()} All Rights Reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
          <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
          <span className="hover:text-white transition-colors cursor-pointer">Contact Support</span>
        </div>
      </footer>

    </div>
  );
}
