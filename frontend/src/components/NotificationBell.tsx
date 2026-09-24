'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, Trash2, ExternalLink, X, CheckCheck,
  Sparkles, RefreshCw, AlertCircle, Info, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

import { emitNotificationSync, NOTIFICATION_SYNC_EVENT, NotificationSyncPayload } from '@/lib/notificationState';

export interface InAppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'single' | 'selected';
  link?: string;
  createdAt: string;
  isRead: boolean;
}

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/notifications');
      const list: InAppNotification[] = res.data.notifications || [];
      const count = typeof res.data.unreadCount === 'number'
        ? res.data.unreadCount
        : list.filter(n => !n.isRead).length;
      setNotifications(list);
      setUnreadCount(count);
      emitNotificationSync({ type: 'set_count', unreadCount: count });
    } catch (err) {
      // Ignore if unauthenticated or offline
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen for global notification sync events from other pages/components
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationSyncPayload>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === 'set_count' && typeof detail.unreadCount === 'number') {
        setUnreadCount(detail.unreadCount);
        if (detail.unreadCount === 0) {
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        }
      } else if (detail.type === 'clear') {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } else if (detail.type === 'decrement') {
        setUnreadCount(prev => Math.max(0, prev - (detail.delta || 1)));
      } else if (detail.type === 'refetch') {
        fetchNotifications(true);
      }
    };

    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleSync);

    // Periodic light polling (every 45s) when window is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    }, 45000);

    // Close on click outside (desktop)
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleSync);
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mark single notification as read (Instant Optimistic UI update)
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Immediate UI update so the red dot updates or vanishes instantly
    setNotifications(prev => {
      const updated = prev.map(n => (n._id === id ? { ...n, isRead: true } : n));
      const remaining = updated.filter(n => !n.isRead).length;
      setUnreadCount(remaining);
      emitNotificationSync({ type: 'set_count', unreadCount: remaining });
      return updated;
    });

    try {
      await api.put(`/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all as read (Instant Optimistic UI update)
  const handleMarkAllAsRead = async () => {
    setActionLoading('read-all');
    
    // Immediate UI update so red dot is removed instantly
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    emitNotificationSync({ type: 'set_count', unreadCount: 0 });

    try {
      await api.put('/notifications/read-all');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Dismiss / delete notification (Instant Optimistic UI update)
  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(id);

    // Immediate UI update
    setNotifications(prev => {
      const updated = prev.filter(n => n._id !== id);
      const remaining = updated.filter(n => !n.isRead).length;
      setUnreadCount(remaining);
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

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / (60 * 1000));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(true);
        }}
        className="relative p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm"
        aria-label="Notifications"
        title="View Notifications"
      >
        <Bell className="w-4 h-4" />

        {/* Red Unread Notification Badge / Dot */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-[#080711] shadow-md animate-fade-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notifications Drawer / Tray */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[190] bg-black/40 sm:bg-transparent"
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 max-h-[80vh] sm:max-h-[500px] z-[210] bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={actionLoading === 'read-all'}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Read all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors sm:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notification List Container */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 max-h-[380px]">
                {loading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
                    <span className="text-xs">Loading updates...</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <Bell className="w-4 h-4 opacity-50" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                      No notifications right now
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      You are all caught up! New announcements will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map(item => (
                    <div
                      key={item._id}
                      onClick={() => {
                        if (!item.isRead) handleMarkAsRead(item._id);
                        setIsOpen(false);
                        router.push(`/user/notifications?id=${item._id}`);
                      }}
                      className={`p-3.5 transition-all text-left relative group cursor-pointer ${
                        item.isRead
                          ? 'bg-transparent hover:bg-slate-50/60 dark:hover:bg-white/[0.02]'
                          : 'bg-purple-50/40 dark:bg-purple-500/10 hover:bg-purple-50/70 dark:hover:bg-purple-500/15'
                      }`}
                    >
                      {/* Unread Left Border Highlight */}
                      {!item.isRead && (
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-r" />
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {!item.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                          )}
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate leading-tight">
                            {item.title}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      {/* Optional Action Link / Buttons */}
                      <div className="mt-2 flex items-center justify-between gap-2 pt-1">
                        <span className="inline-flex items-center text-[10px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
                          View details
                          <ChevronRight className="w-3 h-3 ml-0.5" />
                        </span>

                        {/* Dismiss / Delete Button */}
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(item._id, e);
                            }}
                            disabled={actionLoading === item._id}
                            className="p-1 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-center">
                <Link
                  href="/user/notifications"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline py-1 w-full"
                >
                  <span>View All Notifications Screen</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
