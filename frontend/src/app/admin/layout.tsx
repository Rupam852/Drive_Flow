'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, FolderOpen, LogOut, Menu, X,
  HardDrive, File, Folder, BarChart3
} from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Files', href: '/admin/files', icon: FolderOpen },
  { label: 'Users', href: '/admin/users', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') router.replace('/login');
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || true) && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30 }}
              className={`fixed lg:relative z-30 h-full w-64 glass border-r border-white/10 flex flex-col
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
              {/* Logo */}
              <Link href="/admin/dashboard" className="p-6 border-b border-white/10 hover:bg-white/5 transition-colors block">
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group border
                      ${pathname === href
                        ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white border-transparent'}`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium leading-none mb-[0.5px]">{label}</span>
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="h-16 glass border-b border-white/10 flex items-center px-4 lg:px-6 gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white">
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
