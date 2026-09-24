'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, Trash2, ExternalLink, CheckCheck,
  RefreshCw, Filter, ArrowLeft, Sparkles, Inbox
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

import { emitNotificationSync, NOTIFICATION_SYNC_EVENT, NotificationSyncPayload } from '@/lib/notificationState';

interface InAppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'single' | 'selected';
  link?: string;
  createdAt: string;
  isRead: boolean;
}

export default function UserNotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      const list: InAppNotification[] = res.data.notifications || [];
      const unread = list.filter(n => !n.isRead).length;
      setNotifications(list);
      emitNotificationSync({ type: 'set_count', unreadCount: unread });
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationSyncPayload>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === 'clear' || (detail.type === 'set_count' && detail.unreadCount === 0)) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } else if (detail.type === 'refetch') {
        fetchNotifications();
      }
    };

    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleSync);
  }, []);

  // Mark as seen immediately (optimistic UI update)
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Instant update so red dot is removed or decremented immediately without page reload
    setNotifications(prev => {
      const updated = prev.map(n => (n._id === id ? { ...n, isRead: true } : n));
      const remaining = updated.filter(n => !n.isRead).length;
      emitNotificationSync({ type: 'set_count', unreadCount: remaining });
      return updated;
    });

    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Mark all as seen immediately
  const handleMarkAllAsRead = async () => {
    setActionLoading('read-all');
    // Instant update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    emitNotificationSync({ type: 'set_count', unreadCount: 0 });

    try {
      await api.put('/notifications/read-all');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Dismiss notification
  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionLoading(id);
    // Instant update
    setNotifications(prev => {
      const updated = prev.filter(n => n._id !== id);
      const remaining = updated.filter(n => !n.isRead).length;
      emitNotificationSync({ type: 'set_count', unreadCount: remaining });
      return updated;
    });

    try {
      await api.delete(`/notifications/${id}/dismiss`);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const unreadTotal = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Link
              href="/user/dashboard"
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Notifications
            </h1>
            {unreadTotal > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {unreadTotal} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Important updates, app news, and system announcements from DriveFlow.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end flex-wrap">
          {unreadTotal > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={actionLoading === 'read-all'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all as read</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filter === 'unread'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          Unread ({unreadTotal})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
            <p className="text-xs">Loading your notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 px-4 text-center bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">
              {filter === 'unread' ? 'No unread notifications' : 'Inbox is empty'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filter === 'unread'
                ? 'All notifications have been reviewed.'
                : 'Whenever the admin sends official updates, they will appear right here.'}
            </p>
          </div>
        ) : (
          filtered.map(item => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => !item.isRead && handleMarkAsRead(item._id)}
              className={`p-4 sm:p-5 rounded-2xl border transition-all relative group cursor-pointer ${
                item.isRead
                  ? 'bg-white dark:bg-[#0f111a] border-slate-200 dark:border-white/10'
                  : 'bg-red-50/20 dark:bg-purple-950/20 border-red-200/60 dark:border-purple-500/30 shadow-sm'
              }`}
            >
              {/* Left Accent indicator for unread */}
              {!item.isRead && (
                <span className="absolute left-0 top-3 bottom-3 w-1 bg-red-500 rounded-r" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-300 whitespace-pre-line leading-relaxed mt-2">
                    {item.message}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0">
                  <span className="text-[11px] font-medium text-slate-400">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item._id, e)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:bg-purple-50 dark:hover:bg-purple-500/20 transition-all flex items-center gap-1 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Seen</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(item._id, e)}
                      disabled={actionLoading === item._id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete from my inbox"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Link button if present */}
              {item.link && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-start">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => !item.isRead && handleMarkAsRead(item._id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
                  >
                    <span>Open Attached Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
