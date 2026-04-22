'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, FolderOpen, LogOut, Menu, X,
  HardDrive,
} from 'lucide-react';
import Link from 'next/link';
import { useAndroidBack } from '@/hooks/useAndroidBack';


const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Files', href: '/admin/files', icon: FolderOpen },
  { label: 'Users', href: '/admin/users', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Phase 1: Mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Phase 2: Auth Check (Client only, after mount)
  useEffect(() => {
    if (!mounted) return;
    
    try {
      const token = localStorage.getItem('token_admin');
      if (token) {
        setAuthorized(true);
      } else {
        router.replace('/login');
      }
    } catch (e) {
      router.replace('/login');
    }
  }, [mounted, router]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Android back gesture handling (priority 0)
  useAndroidBack(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      return true; // handled
    }
    
    // Check if we are on dashboard. If so, return false to let Capacitor exit app.
    // If not on dashboard, navigate to dashboard
    if (pathname === '/admin/dashboard') {
      import('@capacitor/app').then(({ App }) => App.exitApp());
      return true;
    } else {
      router.push('/admin/dashboard');
      return true;
    }
  }, 0, [sidebarOpen, pathname, router]);



  const handleLogout = () => {
    localStorage.removeItem('token_admin');
    // Only remove generic role if it matches admin
    if (localStorage.getItem('role') === 'admin') {
      localStorage.removeItem('role');
      localStorage.removeItem('token');
    }
    router.push('/login');
  };

  // While mounting or verifying, show a stable loading screen
  if (!mounted || !authorized) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium animate-pulse">Checking Permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-20 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — hidden off-screen on mobile, always visible on lg+ */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 glass border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <Link href="/admin/dashboard" className="p-6 border-b border-white/10 hover:bg-white/5 transition-colors block"
          onClick={() => setSidebarOpen(false)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-none">DriveFlow</h1>
              <span className="text-xs text-purple-400">Admin Panel</span>
            </div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border
                ${pathname === href
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border-transparent'}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium leading-none">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content — offset on desktop to account for fixed sidebar */}
      <div className="flex flex-col min-h-screen lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-16 glass border-b border-white/10 flex items-center px-4 lg:px-6 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white p-1">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h2 className="text-white font-semibold">
            {navItems.find(n => n.href === pathname)?.label || 'Dashboard'}
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
