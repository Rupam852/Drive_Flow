'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { emitNotificationSync, NOTIFICATION_SYNC_EVENT, NotificationSyncPayload } from '@/lib/notificationState';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications');
      const list = res.data.notifications || [];
      const count = typeof res.data.unreadCount === 'number'
        ? res.data.unreadCount
        : list.filter((n: any) => !n.isRead).length;
      setUnreadCount(count);
      emitNotificationSync({ type: 'set_count', unreadCount: count });
    } catch {
      // Ignore if unauthenticated or offline
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Listen for global notification sync events from other pages/components
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationSyncPayload>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === 'set_count' && typeof detail.unreadCount === 'number') {
        setUnreadCount(detail.unreadCount);
      } else if (detail.type === 'clear') {
        setUnreadCount(0);
      } else if (detail.type === 'decrement') {
        setUnreadCount(prev => Math.max(0, prev - (detail.delta || 1)));
      } else if (detail.type === 'refetch') {
        fetchUnreadCount();
      }
    };

    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleSync);

    // Periodic light polling (every 45s) when window is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    }, 45000);

    return () => {
      window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleSync);
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/user/notifications"
      className="relative p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center group"
      aria-label="Notifications"
      title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
    >
      <Bell className="w-4 h-4 group-hover:scale-105 transition-transform" />

      {/* Red Unread Notification Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-[#080711] shadow-md animate-fade-in">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
