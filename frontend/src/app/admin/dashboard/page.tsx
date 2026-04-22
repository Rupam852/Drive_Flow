'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, File, Folder, Users, TrendingUp, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const StatCard = ({ icon: Icon, label, value, color, href }: any) => (
  <Link href={href || '#'}>
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="glass-card p-6 rounded-2xl cursor-pointer group"
    >
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
  </Link>
);

const formatBytes = (bytes?: string) => {
  if (!bytes || bytes === '0' || isNaN(parseInt(bytes))) return '0 B';
  const b = parseInt(bytes);
  if (b <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  if (i < 0) return '0 B';
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const load = async (cleanup = false) => {
    if (cleanup) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        api.get(`/files/admin-stats${cleanup ? '?cleanup=true' : ''}`).catch(e => {
          console.error('Stats fetch failed:', e);
          return { data: null };
        }),
        api.get('/files/admin-users').catch(e => {
          console.error('Users fetch failed:', e);
          return { data: [] };
        }),
        api.get('/files/admin-logs').catch(e => {
          console.error('Logs fetch failed:', e);
          return { data: [] };
        }),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data) setUserCount(usersRes.data.length);
      if (logsRes.data) setLogs(logsRes.data.slice(0, 5));
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    try {
      const role = localStorage.getItem('role');
      if (role !== 'admin') {
        router.replace('/login');
      } else {
        setMounted(true);
        load();
      }
    } catch (e) {
      router.replace('/login');
    }
  }, [router]);

  if (!mounted) return null;

  const rawPct = stats && parseInt(stats.limit) > 0
    ? (parseInt(stats.used) / parseInt(stats.limit)) * 100
    : 0;
  
  let usedPct = '0';
  if (stats && rawPct > 0) {
    if (rawPct < 0.01) usedPct = '<0.01';
    else if (rawPct < 0.1) usedPct = rawPct.toFixed(2);
    else usedPct = rawPct.toFixed(1);
  }

  const cards = [
    { icon: HardDrive, label: 'Storage Used', value: formatBytes(stats?.used), color: 'bg-purple-500/30', href: '/admin/files' },
    { icon: File, label: 'Total Files', value: stats?.totalFiles, color: 'bg-blue-500/30', href: '/admin/files' },
    { icon: Folder, label: 'Total Folders', value: stats?.totalFolders, color: 'bg-emerald-500/30', href: '/admin/files' },
    { icon: Users, label: 'Total Users', value: userCount, color: 'bg-pink-500/30', href: '/admin/users' },
  ];

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload': return '↑';
      case 'delete': return '×';
      case 'download': return '↓';
      default: return '•';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'upload': return 'bg-emerald-500';
      case 'delete': return 'bg-red-500';
      case 'download': return 'bg-blue-500';
      default: return 'bg-purple-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Overview</h2>
          <p className="text-gray-400 text-sm">Welcome back, Admin</p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <button onClick={() => load(true)} disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl transition-all text-sm font-medium ${refreshing ? 'opacity-50' : 'hover:bg-white/10 active:scale-95'}`}>
            <RefreshCw className={`w-4 h-4 text-purple-400 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Cleaning...' : 'Deep Refresh'}
          </button>
          <Link href="/admin/files" className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-sm font-medium">
            Manage Files
          </Link>
          <Link href="/admin/users" className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all text-sm font-medium">
            View Users
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <StatCard {...c} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Storage Allocation</span>
              </div>
              <span className="text-gray-400 text-sm">{formatBytes(stats?.used)} / {formatBytes(stats?.limit)}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative w-40 h-40 shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                  <motion.circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={440}
                    initial={{ strokeDashoffset: 440 }}
                    animate={{ strokeDashoffset: 440 - (440 * Math.min(rawPct, 100)) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="text-purple-500" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{usedPct}%</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Used</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                {(() => {
                  if (!stats?.types) return null;
                  
                  const formatMimeType = (mime: string) => {
                    if (!mime) return null;
                    const m = mime.toLowerCase();
                    if (m.includes('document') || m.includes('word') || m.includes('text') || m.includes('plain')) return 'DOCUMENT';
                    if (m.includes('spreadsheet') || m.includes('excel')) return 'SPREADSHEET';
                    if (m.includes('presentation') || m.includes('powerpoint')) return 'PRESENTATION';
                    if (m.includes('pdf')) return 'PDF';
                    if (m.includes('image')) return 'IMAGE';
                    if (m.includes('video')) return 'VIDEO';
                    if (m.includes('zip') || m.includes('rar') || m.includes('tar') || m.includes('compressed')) return 'ARCHIVE';
                    return null;
                  };

                  const grouped: Record<string, number> = {};
                  stats.types.forEach((t: any) => {
                    const label = formatMimeType(t._id);
                    if (label) {
                      grouped[label] = (grouped[label] || 0) + t.count;
                    }
                  });

                  const sortedTypes = Object.entries(grouped)
                    .map(([label, count]) => ({ label, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 4);

                  const totalDisplayed = sortedTypes.reduce((sum, t) => sum + t.count, 0);
                  const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-pink-400', 'bg-amber-400'];

                  return sortedTypes.map((t, i) => {
                    const pct = ((t.count / Math.max(1, totalDisplayed)) * 100).toFixed(1);
                    return (
                      <div key={t.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 truncate max-w-[150px] font-bold">{t.label}</span>
                          <span className="text-gray-500 font-medium">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            className={`h-full ${colors[i % colors.length]}`} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-2xl flex flex-col h-full border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-bold">Recent Activity</h3>
            <Link href="/admin/files" className="text-purple-400 text-xs hover:underline">View All</Link>
          </div>
          <div className="flex-1 space-y-6 relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-white/5" />
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : logs.length === 0 ? (
              <div className="py-20 text-center text-gray-500 italic text-sm">No recent activity</div>
            ) : (
              logs.map((log, i) => (
                <div key={log._id} className="relative flex gap-4 group">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 text-[10px] font-bold text-white shadow-lg ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium leading-tight mb-0.5 truncate">
                      <span className="text-purple-400">{log.user?.name || 'User'}</span>
                      {' '}{log.action === 'upload' ? 'uploaded' : log.action === 'delete' ? 'deleted' : 'accessed'}
                    </p>
                    <p className="text-gray-500 text-[10px] truncate">{log.details}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
