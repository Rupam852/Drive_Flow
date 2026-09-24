'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, Trash2, ExternalLink, CheckCheck,
  RefreshCw, Filter, ArrowLeft, Sparkles, Inbox,
  X, Copy, CheckCircle2, ChevronRight, Calendar, Megaphone
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

function UserNotificationsContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<InAppNotification | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      let list: InAppNotification[] = res.data.notifications || [];

      // If targeted notification ID is present in query parameters, mark it as read immediately
      if (targetId) {
        const found = list.find(n => n._id === targetId);
        if (found) {
          setSelectedNotification({ ...found, isRead: true });
          if (!found.isRead) {
            list = list.map(n => n._id === targetId ? { ...n, isRead: true } : n);
            api.put(`/notifications/${targetId}/read`).catch(console.error);
          }
        }
      }

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
  }, [targetId]);

  // Mark as seen immediately (optimistic UI update)
  const handleMarkAsRead = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => (n._id === id ? { ...n, isRead: true } : n));
      const remaining = updated.filter(n => !n.isRead).length;
      emitNotificationSync({ type: 'set_count', unreadCount: remaining });
      return updated;
    });

    setSelectedNotification(prev => (prev && prev._id === id ? { ...prev, isRead: true } : prev));

    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Open Full Notification modal and AUTOMATICALLY mark it as seen
  const openFullNotification = (item: InAppNotification) => {
    setSelectedNotification({ ...item, isRead: true });
    if (!item.isRead) {
      handleMarkAsRead(item._id);
    }
  };

  // Mark all as seen immediately
  const handleMarkAllAsRead = async () => {
    setActionLoading('read-all');
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
    if (selectedNotification?._id === id) {
      setSelectedNotification(null);
    }

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

  const handleCopyMessage = () => {
    if (!selectedNotification) return;
    navigator.clipboard.writeText(`${selectedNotification.title}\n\n${selectedNotification.message}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Click any notification to read the full message. It will automatically be marked as seen.
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
              onClick={() => openFullNotification(item)}
              className={`p-4 sm:p-5 rounded-2xl border transition-all relative group cursor-pointer hover:shadow-md ${
                item.isRead
                  ? 'bg-white dark:bg-[#0f111a] border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40'
                  : 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/30 shadow-sm hover:border-purple-400'
              }`}
            >
              {/* Unread Left Border Highlight */}
              {!item.isRead && (
                <span className="absolute left-0 top-3 bottom-3 w-1 bg-purple-600 rounded-r" />
              )}

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {!item.isRead ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        New
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        <Check className="w-3 h-3 text-emerald-500" />
                        Seen
                      </span>
                    )}

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
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

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
                      Read full
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleDismiss(item._id, e)}
                      disabled={actionLoading === item._id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete from inbox"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Full Notification Detail Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-[#12141f] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Marked as Seen
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedNotification.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {selectedNotification.title}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Full Complete Message */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5">
                  <p className="text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line leading-relaxed selection:bg-purple-500 selection:text-white">
                    {selectedNotification.message}
                  </p>
                </div>

                {/* Attached Link */}
                {selectedNotification.link && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 block truncate">
                        Attached Resource
                      </span>
                      <span className="text-xs text-slate-600 dark:text-gray-300 truncate block">
                        {selectedNotification.link}
                      </span>
                    </div>
                    <a
                      href={selectedNotification.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDismiss(selectedNotification._id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedNotification(null)}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-gray-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UserNotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
          <p className="text-xs">Loading notifications...</p>
        </div>
      }
    >
      <UserNotificationsContent />
    </Suspense>
  );
}
