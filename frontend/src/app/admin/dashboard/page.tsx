'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, File, Folder, Users, TrendingUp, RefreshCw, AlertCircle, CheckCircle, AlertTriangle, Info, X, Activity, Search, Trash2 } from 'lucide-react';
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
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'info' | 'warning' }[]>([]);
  const router = useRouter();

  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const addToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
  };

  const confirmClearLogs = async () => {
    setShowClearConfirmModal(false);
    try {
      await api.delete('/files/admin-logs');
      addToast('All activity logs cleared successfully!', 'success');
      setAllLogs([]);
      setLogs([]);
      load();
    } catch (err: any) {
      console.error('Failed to clear activity logs:', err);
      addToast('Failed to clear activity logs', 'error');
    }
  };

  const load = async (cleanup = false) => {
    if (cleanup) {
      setRefreshing(true);
      addToast('Cleaning and syncing files...', 'info');
    }
    else setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        api.get(`/files/admin-stats${cleanup ? '?cleanup=true' : ''}`).catch(e => {
          console.error('Stats fetch failed:', e);
          return { data: null, error: e };
        }),
        api.get('/files/admin-users').catch(e => {
          console.error('Users fetch failed:', e);
          return { data: [], error: e };
        }),
        api.get('/files/admin-logs').catch(e => {
          console.error('Logs fetch failed:', e);
          return { data: [], error: e };
        }),
      ]);

      if (!statsRes.data && (statsRes as any).error) {
        setError(`Connection Error: ${api.defaults.baseURL}`);
        addToast('Connection to server failed', 'error');
      }

      if (statsRes.data) setStats(statsRes.data);
      if (usersRes.data) {
        setUserCount(usersRes.data.filter((u: any) => u.role !== 'admin').length);
      }
      if (logsRes.data && Array.isArray(logsRes.data)) {
        setAllLogs(logsRes.data);
        setLogs(logsRes.data.slice(0, 5));
      }

      if (cleanup) {
        addToast('Deep refresh completed successfully!', 'success');
      }
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError('System Error: ' + (e.message || 'Unknown failure'));
      addToast('Deep refresh failed', 'error');
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
      case 'download': return '↓';
      case 'preview': return '👁';
      case 'delete':
      case 'trash':
      case 'delete_user':
      case 'delete_permanent': return '×';
      case 'restore':
      case 'bulk_restore':
      case 'restore_all': return '↺';
      case 'create_folder':
      case 'create_doc':
      case 'register': return '+';
      case 'login': return '→';
      case 'rename': return '✎';
      case 'move': return '⇄';
      case 'hide_file': return '👁';
      case 'unhide_file': return '👁';
      default: return '•';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'upload': return 'bg-emerald-500';
      case 'download': return 'bg-blue-500';
      case 'preview': return 'bg-cyan-500';
      case 'delete':
      case 'trash':
      case 'delete_permanent':
      case 'delete_user': return 'bg-red-500';
      case 'restore':
      case 'bulk_restore':
      case 'restore_all': return 'bg-teal-500';
      case 'create_folder':
      case 'create_doc':
      case 'register': return 'bg-pink-500';
      case 'login': return 'bg-purple-500';
      case 'rename': return 'bg-amber-500';
      case 'move': return 'bg-indigo-500';
      case 'hide_file': return 'bg-gray-600';
      case 'unhide_file': return 'bg-slate-500';
      default: return 'bg-purple-500';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'upload': return 'uploaded';
      case 'download': return 'downloaded';
      case 'preview': return 'previewed';
      case 'delete': return 'deleted';
      case 'trash': return 'moved to trash';
      case 'delete_permanent': return 'permanently deleted';
      case 'restore':
      case 'bulk_restore':
      case 'restore_all': return 'restored';
      case 'create_folder': return 'created folder';
      case 'create_doc': return 'created document';
      case 'register': return 'registered';
      case 'login': return 'logged in';
      case 'rename': return 'renamed';
      case 'move': return 'moved';
      case 'hide_file': return 'hid';
      case 'unhide_file': return 'unhid';
      case 'delete_user': return 'deleted user';
      case 'update_user_status': return 'updated user status';
      case 'clear_logs': return 'cleared logs';
      case 'empty_trash': return 'emptied trash';
      default: return action.replace('_', ' ');
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Overview</h2>
          <p className="text-gray-400 text-sm">Welcome back, Admin</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <button onClick={() => load(true)} disabled={refreshing}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-white rounded-xl transition-all text-xs sm:text-sm font-medium ${refreshing ? 'opacity-50' : 'hover:bg-white/10 active:scale-95'}`}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Cleaning...' : 'Deep Refresh'}</span>
          </button>
          <Link href="/admin/files" className="px-3 py-2 sm:px-4 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all text-xs sm:text-sm font-medium">
            Manage Files
          </Link>
          <Link href="/admin/users" className="px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-all text-xs sm:text-sm font-medium">
            View Users
          </Link>
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
          <button onClick={() => load()} className="text-xs font-bold uppercase tracking-wider hover:underline">Retry</button>
        </motion.div>
      )}

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
                  const colorsMap: Record<string, string> = {
                    PDF: 'bg-blue-500',
                    DOCUMENT: 'bg-emerald-500',
                    SPREADSHEET: 'bg-teal-500',
                    PRESENTATION: 'bg-amber-500',
                    IMAGE: 'bg-pink-500',
                    VIDEO: 'bg-purple-500',
                    ARCHIVE: 'bg-indigo-500',
                    OTHER: 'bg-gray-500'
                  };

                  return sortedTypes.map((t, i) => {
                    const pct = ((t.count / Math.max(1, totalDisplayed)) * 100).toFixed(1);
                    const color = colorsMap[t.label] || 'bg-gray-500';
                    return (
                      <div key={t.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 truncate max-w-[150px] font-bold">{t.label}</span>
                          <span className="text-gray-500 font-medium">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            className={`h-full ${color}`} />
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
            <button
              onClick={() => setShowLogsModal(true)}
              className="text-purple-400 text-xs font-medium hover:text-purple-300 hover:underline transition-colors flex items-center gap-1"
            >
              View All
            </button>
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
                    <p className="text-white text-xs font-medium leading-tight mb-0.5 break-words">
                      <span className="text-purple-400">{log.user?.name || 'User'}</span>
                      {' '}{getActionText(log.action)}
                    </p>
                    <p className="text-gray-500 text-[10px] break-words">{log.details}</p>
                    <p className="text-[9px] text-gray-600 mt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>

    {/* All Activity Logs Modal Popup */}
    <AnimatePresence>
      {showLogsModal && (
        <div 
          className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowLogsModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a]/95 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">System Activity Logs</h3>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
                      {allLogs.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Real-time audit trail of all user and admin activities</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {allLogs.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirmModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 text-xs font-semibold transition-all active:scale-95"
                    title="Clear all activity logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Logs</span>
                  </button>
                )}
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Filter Bar */}
            <div className="p-4 border-b border-white/5 bg-white/[0.01]">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by user, action or file name..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                />
                {logSearch && (
                  <button 
                    onClick={() => setLogSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Logs List Container */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 max-h-[60vh]">
              {allLogs.filter(log => {
                if (!logSearch.trim()) return true;
                const q = logSearch.toLowerCase();
                const userName = (log.user?.name || 'User').toLowerCase();
                const actionText = getActionText(log.action).toLowerCase();
                const details = (log.details || '').toLowerCase();
                return userName.includes(q) || actionText.includes(q) || details.includes(q);
              }).length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <p className="text-gray-400 text-sm font-medium">No activity logs found</p>
                  <p className="text-gray-600 text-xs">{logSearch ? 'Try searching with a different keyword' : 'No activity recorded yet'}</p>
                </div>
              ) : (
                allLogs.filter(log => {
                  if (!logSearch.trim()) return true;
                  const q = logSearch.toLowerCase();
                  const userName = (log.user?.name || 'User').toLowerCase();
                  const actionText = getActionText(log.action).toLowerCase();
                  const details = (log.details || '').toLowerCase();
                  return userName.includes(q) || actionText.includes(q) || details.includes(q);
                }).map((log) => (
                  <div
                    key={log._id}
                    className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-lg ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-white break-words">
                          <span className="text-purple-400 font-bold">{log.user?.name || 'User'}</span>
                          {' '}{getActionText(log.action)}
                        </p>
                        <span className="text-[10px] text-gray-500 font-mono shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs break-words leading-relaxed mb-1">{log.details}</p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {new Date(log.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Total {allLogs.length} activity logs recorded
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Custom Glassmorphic Clear Logs Confirmation Modal */}
    <AnimatePresence>
      {showClearConfirmModal && (
        <div 
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowClearConfirmModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0f172a]/95 border border-red-500/30 rounded-3xl shadow-2xl w-full max-w-md p-6 text-center relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4 shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Clear All Activity Logs?</h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Are you sure you want to permanently clear all system activity logs? This action cannot be undone.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearLogs}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear All</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Toasts - Centered at top of screen below header */}
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-3 pointer-events-none w-[90vw] max-w-sm">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} 
            initial={{ y: -40, opacity: 0, scale: 0.9 }} 
            animate={{ y: 0, opacity: 1, scale: 1 }} 
            exit={{ y: -40, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`pointer-events-auto px-5 py-3.5 rounded-[20px] shadow-2xl backdrop-blur-xl border flex items-center gap-4 min-w-[280px] max-w-sm relative overflow-hidden group
              ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 
                t.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/10' : 
                t.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10' :
                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-indigo-500/10'}`}>
            
            <div className={`absolute -right-4 -top-4 w-16 h-16 blur-2xl opacity-20 transition-opacity group-hover:opacity-40
              ${t.type === 'success' ? 'bg-emerald-400' : 
                t.type === 'error' ? 'bg-rose-400' : 
                t.type === 'warning' ? 'bg-amber-400' :
                'bg-indigo-400'}`} 
            />

            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner
              ${t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30' : 
                t.type === 'error' ? 'bg-rose-500/20 border-rose-500/30' : 
                t.type === 'warning' ? 'bg-amber-500/20 border-amber-500/30' :
                'bg-indigo-500/20 border-indigo-500/30'}`}>
              {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {t.type === 'info' && <Info className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold tracking-tight leading-tight mb-0.5 uppercase opacity-50">
                {t.type}
              </p>
              <p className="text-sm font-medium text-white/90 truncate">{t.msg}</p>
            </div>

            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="p-1 hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
    </>
  );
}
