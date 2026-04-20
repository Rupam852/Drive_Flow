'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, File, Folder } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

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
  if (!bytes || bytes === '0') return '0 B';
  const b = parseInt(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  if (i < 0) return '0 B';
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function UserDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          api.get('/files/stats'),
          api.get('/files/user-logs'),
        ]);
        setStats(statsRes.data);
        setLogs(logsRes.data.slice(0, 5));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <StatCard {...c} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Bar */}
        <div className="lg:col-span-2 space-y-6">
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

          <div className="grid grid-cols-2 gap-4">
            <Link href="/user/files" className="glass-card p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <File className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-white text-xs font-medium">Documents</span>
            </Link>
            <Link href="/user/files" className="glass-card p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Folder className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-white text-xs font-medium">Folders</span>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-2xl flex flex-col border border-white/5 h-full">
          <h3 className="text-white font-bold mb-6">Recent Activity</h3>
          <div className="flex-1 space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
              ))
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-gray-500 italic text-sm">No recent activity</div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="flex gap-3 items-start group">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 group-hover:scale-150 transition-transform" />
                  <div className="min-w-0">
                    <p className="text-gray-300 text-xs leading-tight mb-0.5 capitalize">{log.action}: {log.details.split(' ').slice(0, 3).join(' ')}...</p>
                    <p className="text-[10px] text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
