'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, File, Folder, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const StatCard = ({ icon: Icon, label, value, color, href }: any) => {
  const content = (
    <motion.div whileHover={{ y: -4 }} className="glass-card p-6 rounded-2xl h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value ?? '...'}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
};

const fmt = (bytes?: string) => {
  if (!bytes || bytes === '0' || isNaN(parseInt(bytes))) return '0 B';
  const b = parseInt(bytes);
  if (b <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  if (i < 0) return '0 B';
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function UserDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const role = localStorage.getItem('role');
        if (role !== 'user') {
          router.replace('/login');
          return;
        }
        setMounted(true);
        
        const statsRes = await api.get('/files/stats').catch(e => {
          console.error('Stats fetch failed:', e);
          return { data: null, error: e };
        });

        if (!statsRes.data && (statsRes as any).error) {
          setError(`Connection Error: ${api.defaults.baseURL}`);
        }

        if (statsRes.data) setStats(statsRes.data);
      } catch (e: any) { 
        console.error(e); 
        setError('System Error: ' + (e.message || 'Unknown failure'));
      }
      finally { setLoading(false); }
    };
    load();
  }, [router]);

  if (!mounted) return null;

  let rawPct = 0;
  if (stats?.used && stats?.limit) {
    const used = parseInt(stats.used);
    const limit = parseInt(stats.limit);
    if (!isNaN(used) && !isNaN(limit) && limit > 0) {
      rawPct = (used / limit) * 100;
    }
  }

  let usedPct = '0';
  if (rawPct > 0) {
    if (rawPct < 0.01) usedPct = '<0.01';
    else if (rawPct < 0.1) usedPct = rawPct.toFixed(2);
    else usedPct = rawPct.toFixed(1);
  }

  const cards = [
    { icon: HardDrive, label: 'Storage Used', value: fmt(stats?.used), color: 'bg-purple-500/30' },
    { icon: File, label: 'Total Files', value: stats?.totalFiles, color: 'bg-blue-500/30', href: '/user/files' },
    { icon: Folder, label: 'Total Folders', value: stats?.totalFolders, color: 'bg-emerald-500/30', href: '/user/files' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">My Dashboard</h2>
          <p className="text-gray-400 text-sm">Welcome back to DriveFlow</p>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold uppercase tracking-wider hover:underline">Retry</button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <StatCard {...c} />
          </motion.div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Storage Bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-medium">Storage Progress</span>
            <span className="text-gray-400 text-sm">{usedPct}% Used</span>
          </div>
          <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden p-1 border border-white/5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${rawPct > 0 ? Math.max(rawPct, 1) : 0}%` }} transition={{ duration: 1 }}
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
          </div>
          <div className="mt-4 flex justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            <span>{fmt(stats?.used)}</span>
            <span>{fmt(stats?.limit)} Limit</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/user/files" className="glass-card p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/5 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <File className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-white text-sm font-semibold">Documents</span>
          </Link>
          <Link href="/user/files" className="glass-card p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/5 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Folder className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-white text-sm font-semibold">Folders</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
