'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, FolderOpen, LogOut, Menu, X, HardDrive } from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { label: 'Dashboard', href: '/user/dashboard', icon: LayoutDashboard },
  { label: 'My Files', href: '/user/files', icon: FolderOpen },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const role = localStorage.getItem('role');
      if (role !== 'user') {
        router.replace('/login');
      } else {
        setMounted(true);
      }
    } catch (e) {
      router.replace('/login');
    }
  }, [router]);

  if (!mounted) return null;

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    router.push('/login');
  };

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
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-none">DriveFlow</h1>
              <span className="text-xs text-purple-400">My Storage</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                ${pathname === href
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium leading-none">{label}</span>
            </Link>
          ))}
        </nav>

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
        <header className="sticky top-0 z-10 h-16 glass border-b border-white/10 flex items-center px-4 lg:px-6 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white p-1">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h2 className="text-white font-semibold">{navItems.find(n => n.href === pathname)?.label || 'DriveFlow'}</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
