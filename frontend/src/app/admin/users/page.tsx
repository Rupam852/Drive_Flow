'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Mail, Trash2, Search, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string; icon: any; label: string }> = {
    approved: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: CheckCircle2, label: 'Approved' },
    rejected: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: XCircle, label: 'Rejected' },
    pending: { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: Clock, label: 'Pending' },
  };
  const { color, icon: Icon, label } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </span>
  );
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.filter((u: User) => u.role !== 'admin'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action);
    try {
      await api.put(`/users/${id}/${action}`);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, status: action === 'approve' ? 'approved' : 'rejected' } : u));
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setActionLoading(id + 'delete');
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-gray-400 text-sm">{users.length} registered users</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-gray-300 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {['Name', 'Email', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {loading ? (
                  <tr><td colSpan={5} className="py-16 text-center text-gray-500">Loading users...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-gray-500">No users found</td></tr>
                ) : (
                  filtered.map((user, i) => (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                            {user.name[0].toUpperCase()}
                          </div>
                          <span className="text-white font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.status !== 'approved' && (
                            <button
                              onClick={() => updateStatus(user._id, 'approve')}
                              disabled={!!actionLoading}
                              className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
                            >
                              {actionLoading === user._id + 'approve' ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : <CheckCircle2 className="w-3 h-3" />}
                              Approve
                            </button>
                          )}
                            {user.status !== 'rejected' && (
                              <button
                                onClick={() => updateStatus(user._id, 'reject')}
                                disabled={!!actionLoading}
                                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1"
                              >
                                {actionLoading === user._id + 'reject' ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : <XCircle className="w-3 h-3" />}
                                Reject
                              </button>
                            )}
                            <button
                              onClick={() => deleteUser(user._id)}
                              disabled={!!actionLoading}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              {actionLoading === user._id + 'delete' ? <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
