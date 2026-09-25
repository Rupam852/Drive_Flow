'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Mail, Send, Users, User, CheckCircle2, AlertTriangle,
  Search, X, Sparkles, RefreshCw, Eye, Edit3, ArrowRight,
  ShieldCheck, Info, Check, AlertCircle, ChevronDown,
  Trash2, ExternalLink, Link2, CheckCheck, Smartphone, FileText
} from 'lucide-react';
import api from '@/lib/api';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  profilePic?: string;
  createdAt: string;
}

interface AdminNotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'broadcast' | 'single' | 'selected';
  link?: string;
  createdAt: string;
  readCount: number;
  targetCount: number;
  seenPercentage: number;
  senderName: string;
}

const TEMPLATES = [
  {
    name: '📄 File Upload Notification',
    subject: 'New file uploaded to your account',
    message: `Hello,\n\nA new file has been uploaded to your DriveFlow account.\n\nFile Details:\n• File Name: [File Name]\n• Uploaded By: DriveFlow Administration\n• Status: Ready to view and download\n\nYou can access, view, or download this file directly from your DriveFlow workspace.\n\nBest regards,\nDriveFlow Team`,
  },
  {
    name: '🚀 App Update Announcement',
    subject: 'New App Update Available: Download Latest Version',
    message: `Hello,\n\nA brand new update for the DriveFlow Android App is now available for download!\n\nWhat's New in This Version:\n• Smart Offline Detection: Instant internet connection monitoring with auto-recovery\n• Ultra-Smooth 120Hz Display Support: Unlocked high refresh-rate animations and navigation\n• Cloud Sync & Transfer Upgrades: Faster, more reliable uploads and downloads\n• Dark & Light Mode Polish: Clean and comfortable viewing experience across all screens\n\nHow to Get the Update:\n1. If you have the app installed: Open DriveFlow, open the sidebar menu, and tap 'App Update'.\n2. Direct APK Download: You can download the latest official APK directly from:\nhttps://neo-files-transfer.pages.dev/download/723586892fd0\n\nUpdate now to enjoy the fastest and smoothest cloud experience.\n\nBest regards,\nDriveFlow Operations Team`,
  },
  {
    name: '📢 New Feature',
    subject: 'Exciting New Features Are Live on DriveFlow!',
    message: `Hello,\n\nWe are thrilled to announce that brand new enhancements and performance upgrades have just rolled out to DriveFlow!\n\nWhat's new:\n• Faster upload speeds and enhanced cloud stability\n• Improved file preview and search capabilities\n• Seamless mobile app performance\n\nLog in now to explore the latest updates.\n\nBest regards,\nDriveFlow Team`,
  },
  {
    name: '⚠️ Scheduled Maintenance',
    subject: 'Scheduled System Maintenance Notice',
    message: `Hello,\n\nPlease be advised that DriveFlow will undergo scheduled server maintenance to improve security, infrastructure resilience, and cloud performance.\n\n• Date: This weekend\n• Duration: Approximately 30-45 minutes\n\nDuring this brief window, file synchronization may experience temporary delays. Your data remains fully secure and encrypted.\n\nThank you for your patience and support.\n\nBest regards,\nDriveFlow Operations Team`,
  },
  {
    name: '🔒 Security Advisory',
    subject: 'Important Security Update',
    message: `Hello,\n\nAt DriveFlow, your privacy and data security are our top priorities. We regularly review our safety protocols to ensure complete protection for all stored files.\n\nSecurity Reminders:\n• Never share your account password or verification codes with anyone.\n• Ensure you download the official DriveFlow application from trusted sources.\n• Review your active login sessions if you access your account on shared devices.\n\nIf you notice any unusual activity, please contact support immediately.\n\nBest regards,\nDriveFlow Security Operations`,
  },
  {
    name: '📁 Storage Notice',
    subject: 'Cloud Storage & File Optimization Notice',
    message: `Hello,\n\nWe wanted to share an update regarding cloud storage and system optimizations on DriveFlow. Our team has tuned storage performance to make your uploads, sharing, and downloads smoother than ever.\n\nFeel free to organize your folders, review shared items, and enjoy high-speed cloud access across all your devices.\n\nBest regards,\nDriveFlow Team`,
  },
];

const getAvatarGradient = (name: string = '') => {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  const charCode = (name.charCodeAt(0) || 0) % gradients.length;
  return gradients[charCode];
};

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [recipientMode, setRecipientMode] = useState<'all' | 'single' | 'selected'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachedLink, setAttachedLink] = useState('');
  const [linkInserted, setLinkInserted] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
  
  // Channels
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // Active in-app notifications
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);
  const [loadingAdminNotifs, setLoadingAdminNotifs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // UI Controls
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking or tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userDropdownOpen]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resultStatus, setResultStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    details?: string;
  } | null>(null);

  // Fetch users for targeting
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      const filtered = Array.isArray(res.data)
        ? res.data.filter((u: UserItem) => u.role !== 'admin')
        : [];
      setUsers(filtered);
    } catch (err: any) {
      console.error('Failed to fetch users list:', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch active in-app notifications for tracking
  const fetchAdminNotifications = async () => {
    setLoadingAdminNotifs(true);
    try {
      const res = await api.get('/notifications/admin');
      const list = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      setAdminNotifications(list);
    } catch (err: any) {
      console.error('Failed to fetch admin notifications:', err);
      setAdminNotifications([]);
    } finally {
      setLoadingAdminNotifs(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAdminNotifications();
  }, []);

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Selected Single User object
  const currentSingleUser = useMemo(() => {
    return users.find(u => u._id === selectedUserId) || null;
  }, [users, selectedUserId]);

  // Total recipient count
  const recipientCount = useMemo(() => {
    if (recipientMode === 'all') return users.length;
    if (recipientMode === 'single') return currentSingleUser ? 1 : 0;
    if (recipientMode === 'selected') return selectedUserIds.length;
    return 0;
  }, [recipientMode, users.length, currentSingleUser, selectedUserIds.length]);

  // Apply template preset
  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setSelectedTemplateName(tmpl.name);
    setSubject(tmpl.subject);
    setMessage(tmpl.message);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://driveflowrupam.vercel.app';
    if (tmpl.name.includes('App Update')) {
      setAttachedLink('https://neo-files-transfer.pages.dev/download/723586892fd0');
    } else if (tmpl.name.includes('File Upload')) {
      setAttachedLink(`${origin}/user/files`);
    } else {
      setAttachedLink('');
    }
    setResultStatus(null);
  };

  // Toggle user selection for multiple mode
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Recall / Delete notification from all users
  const handleDeleteAdminNotification = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/notifications/admin/${id}`);
      setAdminNotifications(prev => prev.filter(n => n._id !== id));
      setResultStatus({
        type: 'success',
        text: 'Notification recalled and deleted from all users successfully.',
      });
    } catch (err: any) {
      console.error('Failed to delete notification:', err);
      setResultStatus({
        type: 'error',
        text: 'Failed to recall notification.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Validate form
  const validateForm = () => {
    if (!subject.trim()) {
      setResultStatus({ type: 'error', text: 'Please enter a notification subject/title.' });
      return false;
    }
    if (!message.trim()) {
      setResultStatus({ type: 'error', text: 'Please write your message body.' });
      return false;
    }
    if (!sendInApp && !sendEmail) {
      setResultStatus({ type: 'error', text: 'Please select at least one delivery channel (In-App or Email).' });
      return false;
    }
    if (recipientMode === 'single' && !selectedUserId) {
      setResultStatus({ type: 'error', text: 'Please choose a specific user recipient.' });
      return false;
    }
    if (recipientMode === 'selected' && selectedUserIds.length === 0) {
      setResultStatus({ type: 'error', text: 'Please choose at least one user recipient.' });
      return false;
    }
    if (message.includes('[File Name]')) {
      const proceed = window.confirm("Notice: Your message still contains '[File Name]'. Would you like to update it with the actual file name before sending? Click 'Cancel' to edit, or 'OK' to send as is.");
      if (!proceed) {
        setResultStatus({ type: 'error', text: "Please replace '[File Name]' with the uploaded file name." });
        return false;
      }
    }
    return true;
  };

  // Submit dispatch handler
  const handleSendNotification = async () => {
    if (!validateForm()) return;

    if (recipientMode === 'all' && !showConfirmModal) {
      setShowConfirmModal(true);
      return;
    }

    setShowConfirmModal(false);
    setIsSubmitting(true);
    setResultStatus(null);

    try {
      let inAppSuccess = false;
      let emailSuccess = false;

      // 1. Dispatch In-App Notification (Phone/Web Bell)
      if (sendInApp) {
        await api.post('/notifications/admin', {
          title: subject.trim(),
          message: message.trim(),
          type: recipientMode === 'all' ? 'broadcast' : recipientMode,
          targetUsers: recipientMode === 'single' ? [selectedUserId] : selectedUserIds,
          link: attachedLink.trim() || undefined,
          sendEmail: false,
        });
        inAppSuccess = true;
      }

      // 2. Dispatch Email
      if (sendEmail) {
        const payload: any = {
          recipientType: recipientMode,
          subject: subject.trim(),
          message: message.trim(),
          link: attachedLink.trim() || undefined,
        };
        if (recipientMode === 'single') payload.userId = selectedUserId;
        else if (recipientMode === 'selected') payload.userIds = selectedUserIds;

        await api.post('/users/notify', payload);
        emailSuccess = true;
      }

      const channelsUsed: string[] = [];
      if (inAppSuccess) channelsUsed.push('🔔 In-App Bell');
      if (emailSuccess) channelsUsed.push('📧 Email');

      setResultStatus({
        type: 'success',
        text: `Successfully dispatched via ${channelsUsed.join(' and ')} to ${recipientCount} user(s)!`,
      });

      if (recipientMode === 'single') setSelectedUserId('');
      else if (recipientMode === 'selected') setSelectedUserIds([]);
      setSubject('');
      setMessage('');
      setAttachedLink('');

      fetchAdminNotifications();
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to dispatch notification.';
      setResultStatus({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Notification & Announcement Hub
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Dispatch announcements via In-App Bell Notification and Email to all users or individual recipients.
          </p>
        </div>

        {/* Quick User Counter Pill */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-300">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{loadingUsers ? 'Loading...' : `${users.length} Registered Users`}</span>
          </div>
          <button
            onClick={() => {
              fetchUsers();
              fetchAdminNotifications();
            }}
            disabled={loadingUsers}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin text-purple-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Feedback Banner */}
      <AnimatePresence>
        {resultStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
              resultStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
            }`}
          >
            {resultStatus.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <p className="font-semibold">{resultStatus.text}</p>
              {resultStatus.details && (
                <p className="text-xs opacity-90 mt-1">{resultStatus.details}</p>
              )}
            </div>
            <button
              onClick={() => setResultStatus(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dispatch Channels & Target Audience */}
      <div className="bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Step 1: Channels Selection */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            1. Select Delivery Channels
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSendInApp(!sendInApp)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                sendInApp
                  ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-slate-400'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                sendInApp ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 bg-white dark:border-gray-600 dark:bg-white/5'
              }`}>
                {sendInApp && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
              <Bell className={`w-4 h-4 ${sendInApp ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} />
              <span className={`font-semibold ${sendInApp ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-gray-400'}`}>
                In-App Bell Alert (Phone & Web)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSendEmail(!sendEmail)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                sendEmail
                  ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-slate-400'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                sendEmail ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 bg-white dark:border-gray-600 dark:bg-white/5'
              }`}>
                {sendEmail && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
              <Mail className={`w-4 h-4 ${sendEmail ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} />
              <span className={`font-semibold ${sendEmail ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-gray-400'}`}>
                Email Notification (Gmail/Inbox)
              </span>
            </button>
          </div>
        </div>

        {/* Step 2: Recipient Audience */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            2. Select Recipient Audience
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Option 1: Broadcast to All */}
            <button
              type="button"
              onClick={() => {
                setRecipientMode('all');
                setResultStatus(null);
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                recipientMode === 'all'
                  ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 hover:border-slate-400 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 border transition-colors ${
                recipientMode === 'all'
                  ? 'bg-emerald-100 dark:bg-emerald-500/25 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400'
              }`}>
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                  <span>All Users</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    recipientMode === 'all'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-white/10'
                  }`}>
                    Broadcast
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
                  Sends an official notice to all {users.length} verified users at once.
                </p>
              </div>
              {recipientMode === 'all' && (
                <span className="absolute top-3 right-3 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              )}
            </button>

            {/* Option 2: Single User */}
            <button
              type="button"
              onClick={() => {
                setRecipientMode('single');
                setResultStatus(null);
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                recipientMode === 'single'
                  ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 hover:border-slate-400 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 border transition-colors ${
                recipientMode === 'single'
                  ? 'bg-emerald-100 dark:bg-emerald-500/25 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400'
              }`}>
                <User className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                  <span>Specific User</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    recipientMode === 'single'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-white/10'
                  }`}>
                    Direct
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
                  Send a personalized direct message to one particular user.
                </p>
              </div>
              {recipientMode === 'single' && (
                <span className="absolute top-3 right-3 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              )}
            </button>

            {/* Option 3: Multiple Selected Users */}
            <button
              type="button"
              onClick={() => {
                setRecipientMode('selected');
                setResultStatus(null);
              }}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                recipientMode === 'selected'
                  ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 hover:border-slate-400 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 border transition-colors ${
                recipientMode === 'selected'
                  ? 'bg-emerald-100 dark:bg-emerald-500/25 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400'
              }`}>
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                  <span>Selected Users</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    recipientMode === 'selected'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-white/10'
                  }`}>
                    Custom ({selectedUserIds.length})
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-gray-400 mt-1 leading-relaxed">
                  Hand-pick multiple users to receive this notification.
                </p>
              </div>
              {recipientMode === 'selected' && (
                <span className="absolute top-3 right-3 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              )}
            </button>
          </div>

          {/* User Picker for Single User Mode */}
          {recipientMode === 'single' && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-2">
                Select Target Recipient:
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-left hover:border-purple-500/50 transition-colors cursor-pointer"
                >
                  {currentSingleUser ? (
                    <div className="flex items-center gap-3">
                      {currentSingleUser.profilePic ? (
                        <img
                          src={currentSingleUser.profilePic}
                          alt={currentSingleUser.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10 shrink-0 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(currentSingleUser.name)} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs`}>
                          {currentSingleUser.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                          {currentSingleUser.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {currentSingleUser.email}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-gray-500">
                      Click to choose a user from the list...
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {userDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl p-3 max-h-72 overflow-y-auto">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div className="space-y-1">
                      {filteredUsers.length === 0 ? (
                        <p className="text-xs text-center py-4 text-slate-400">No users found.</p>
                      ) : (
                        filteredUsers.map(u => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(u._id);
                              setUserDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                              selectedUserId === u._id
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {u.profilePic ? (
                                <img
                                  src={u.profilePic}
                                  alt={u.name}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-white/10 shrink-0 shadow-xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${getAvatarGradient(u.name)} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-xs`}>
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold leading-tight">{u.name}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{u.email}</p>
                              </div>
                            </div>
                            {selectedUserId === u._id && (
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Picker for Multi-Select Mode */}
          {recipientMode === 'selected' && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Choose Specific Recipients ({selectedUserIds.length} selected):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds(users.map(u => u._id))}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {filteredUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleSelectUser(u._id)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-white dark:bg-white/[0.02] border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-300 hover:border-slate-400 hover:bg-slate-50/70 shadow-xs'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 dark:border-gray-500 bg-white dark:bg-white/5'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3] text-white" />}
                      </div>
                      {u.profilePic ? (
                        <img
                          src={u.profilePic}
                          alt={u.name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-white/10 shrink-0 shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${getAvatarGradient(u.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-xs`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate flex-1">
                        <p className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-[10px] text-slate-600 dark:text-gray-400 truncate font-medium">{u.email}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Templates Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Quick Template Presets
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Click to fill instant draft</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TEMPLATES.map(tmpl => {
            const isSelected = selectedTemplateName === tmpl.name;
            return (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs transition-colors active:scale-95 cursor-pointer shadow-xs ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30 font-bold'
                    : 'bg-white dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-200 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 font-medium'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />}
                <span>{tmpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden bg-slate-100 dark:bg-white/10 p-1 rounded-xl w-full max-w-xs mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab('compose')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            activeTab === 'compose'
              ? 'bg-white dark:bg-purple-600 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400'
          }`}
        >
          Compose Form
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-white dark:bg-purple-600 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-gray-400'
          }`}
        >
          Live Preview
        </button>
      </div>

      {/* Main Compose & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Form (7 cols on lg) */}
        <div className={`lg:col-span-7 bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${
          activeTab === 'compose' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              3. Compose Message Content
            </h3>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-gray-200 mb-1.5">
              Subject / Notification Title:
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. Important Update regarding DriveFlow Storage..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={120}
                className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {subject.length}/120
              </span>
            </div>
          </div>

          {/* Attached Link Input (Optional) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-gray-200 mb-1.5">
              Attached Action Link (Optional):
            </label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                placeholder="https://... (e.g. APK download or announcement link)"
                value={attachedLink}
                onChange={e => setAttachedLink(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all"
              />
            </div>
          </div>

          {/* Message Body Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-gray-200">
                Message Body Text:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const fname = prompt('Enter the uploaded file name (e.g. Project_Report.pdf):');
                    if (fname && fname.trim()) {
                      const trimmed = fname.trim();
                      if (message.includes('[File Name]')) {
                        setMessage(prev => prev.replace(/\[File Name\]/g, trimmed));
                      } else {
                        setMessage(prev => prev + `\n\n• File: ${trimmed}`);
                      }
                      if (subject.includes('[File Name]')) {
                        setSubject(prev => prev.replace(/\[File Name\]/g, trimmed));
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 hover:bg-purple-100"
                  title="Insert or replace [File Name] in message draft"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>+ Set File Name</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const downloadUrl = 'https://neo-files-transfer.pages.dev/download/723586892fd0';
                    const downloadSnippet = `\n\n📲 Official DriveFlow Android App Download Link:\n${downloadUrl}`;

                    if (!message.includes(downloadUrl)) {
                      setMessage(prev => {
                        if (!prev.trim()) {
                          return `Hello,\n\nPlease download and install the official DriveFlow Android App for faster mobile file access, background uploads, and real-time alerts:\n${downloadUrl}`;
                        }
                        return prev + downloadSnippet;
                      });
                    }
                    setAttachedLink(downloadUrl);
                    setLinkInserted(true);
                    setTimeout(() => setLinkInserted(false), 2500);
                  }}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs ${
                    linkInserted
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100'
                  }`}
                  title="Insert official APK download link into message draft and attach link"
                >
                  {linkInserted ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>✓ APK Link Attached</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>+ Insert APK Link</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Formatted automatically
                </span>
              </div>
            </div>

            {message.includes('[File Name]') && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Notice: Please replace <strong>[File Name]</strong> with your uploaded file's actual name.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const fname = prompt('Enter your uploaded file name (e.g. Invoice_July.pdf):');
                    if (fname && fname.trim()) {
                      const trimmed = fname.trim();
                      setMessage(prev => prev.replace(/\[File Name\]/g, trimmed));
                      if (subject.includes('[File Name]')) {
                        setSubject(prev => prev.replace(/\[File Name\]/g, trimmed));
                      }
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0 text-[11px] shadow-xs cursor-pointer"
                >
                  Replace Now
                </button>
              </div>
            )}
            <textarea
              rows={9}
              placeholder="Write your announcement or direct message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-white dark:bg-black/30 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all leading-relaxed resize-none"
            />
          </div>

          {/* Action Dispatch Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-500 shrink-0" />
              <span>
                Target: <strong className="text-slate-900 dark:text-white font-bold">{recipientCount} user(s)</strong> via {sendInApp && sendEmail ? 'Bell & Email' : sendInApp ? 'In-App Bell' : 'Email'}.
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setSubject('');
                  setMessage('');
                  setAttachedLink('');
                  setSelectedTemplateName(null);
                  setResultStatus(null);
                }}
                disabled={isSubmitting || (!subject && !message)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:bg-slate-100 hover:text-slate-900 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleSendNotification}
                disabled={isSubmitting || recipientCount === 0 || !subject.trim() || !message.trim()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {recipientMode === 'all'
                        ? `Publish to All (${recipientCount})`
                        : recipientMode === 'single'
                        ? 'Send Direct Notice'
                        : `Publish to Selected (${recipientCount})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Interactive Preview (5 cols on lg) */}
        <div className={`lg:col-span-5 ${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          <div className="sticky top-20 bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Live Email Inbox Preview
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                100% Inbox Match
              </span>
            </div>

            {/* Email Container Mockup - Authentic Inbox Replica */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc] text-slate-800 overflow-hidden shadow-sm font-sans text-xs">
              {/* Fake Top Header */}
              <div className="bg-slate-100/90 border-b border-slate-200 p-2.5 flex items-center justify-between text-[11px] text-slate-700">
                <div className="truncate">
                  <span className="font-bold text-slate-900">Target: </span>
                  {recipientMode === 'single' && currentSingleUser
                    ? `${currentSingleUser.name} <${currentSingleUser.email}>`
                    : recipientMode === 'selected'
                    ? `${selectedUserIds.length} Selected Recipients`
                    : `All Verified Users (${users.length})`}
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 font-medium">Just now</span>
              </div>

              {/* Content Box */}
              <div className="p-3.5 bg-slate-100/50">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Authentic DriveFlow Email Header */}
                  <div
                    className="p-5 text-center text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' }}
                  >
                    <h4 className="text-xl font-extrabold text-white tracking-tight" style={{ color: '#ffffff', margin: 0 }}>
                      DriveFlow
                    </h4>
                    <p className="text-[12px] font-medium mt-1" style={{ color: '#e9d5ff', margin: 0 }}>
                      Secure Cloud Storage
                    </p>
                  </div>

                  {/* Email Body */}
                  <div className="p-5 space-y-3.5">
                    {/* Subject / Title */}
                    <h5 className="text-[15px] font-bold text-slate-900 leading-snug">
                      {subject.trim() || 'No Subject Specified'}
                    </h5>

                    {/* Greeting */}
                    <p className="text-slate-600 text-xs font-medium">
                      Hello {recipientMode === 'single' && currentSingleUser ? currentSingleUser.name : 'User'},
                    </p>

                    {/* Message Box */}
                    <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-line bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      {message.trim() ? (
                        message.split(/(\[File Name\])/g).map((part, i) =>
                          part === '[File Name]' ? (
                            <span key={i} className="inline-block bg-amber-100 border border-amber-300 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[11px]">
                              [File Name]
                            </span>
                          ) : (
                            part
                          )
                        )
                      ) : (
                        <span className="text-slate-400 italic">Your composed message content will appear formatted here...</span>
                      )}
                    </div>

                    {/* CTA Button */}
                    {attachedLink && (
                      <div className="pt-2 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md text-white"
                          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', color: '#ffffff' }}
                        >
                          <span style={{ color: '#ffffff', fontWeight: 700 }}>
                            {attachedLink.includes('/user/files')
                              ? 'View Files in Workspace'
                              : attachedLink.includes('/user/notifications')
                              ? 'Open App to Update'
                              : 'Open Attached Link'}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
                        </span>
                      </div>
                    )}

                    {/* Automated Notice Note */}
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      This automated notification was sent to your registered DriveFlow account.
                    </p>
                  </div>

                  {/* Email Footer */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
                    <p className="m-0 font-medium">&copy; {new Date().getFullYear()} DriveFlow. All rights reserved.</p>
                    <p className="m-0 mt-0.5 text-[10px]">Automated secure dispatch.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active In-App Announcements & Real-Time Seen Tracking */}
      <div className="bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Active In-App Announcements & Seen Tracking</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5 font-medium">
              Track how many users have seen your notifications or recall/delete them with one click.
            </p>
          </div>
          <button
            onClick={fetchAdminNotifications}
            disabled={loadingAdminNotifs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAdminNotifs ? 'animate-spin text-purple-500' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>

        {loadingAdminNotifs ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
            <p className="text-xs">Loading announcements...</p>
          </div>
        ) : adminNotifications.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Bell className="w-8 h-8 opacity-40 mx-auto mb-2" />
            <p className="text-xs font-medium">No active in-app announcements published yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5 space-y-1">
            {adminNotifications.map(item => (
              <div
                key={item._id}
                className="py-3 px-2 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/20 capitalize">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-1 line-clamp-1 leading-relaxed">
                    {item.message}
                  </p>
                </div>

                {/* Seen Progress Bar & Recall Button */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                  {/* Seen Stats */}
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.readCount} / {item.targetCount || 1} Seen ({item.seenPercentage}%)
                      </span>
                    </div>
                    <div className="w-32 h-2 bg-slate-200 dark:bg-white/10 border border-slate-300/60 dark:border-transparent rounded-full overflow-hidden mt-1 ml-auto shadow-inner">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.seenPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Recall / Delete from All Users */}
                  <button
                    onClick={() => handleDeleteAdminNotification(item._id)}
                    disabled={deletingId === item._id}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors border border-rose-200 dark:border-rose-900/30 cursor-pointer shadow-xs"
                    title="Recall & Delete from all users"
                  >
                    {deletingId === item._id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal for All-User Broadcast */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Confirm Broadcast to All Users?
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                  You are about to publish a notification to <strong>{users.length} verified users</strong> via {sendInApp && sendEmail ? 'In-App Bell & Email' : sendInApp ? 'In-App Bell' : 'Email'}.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white truncate">
                  Subject: {subject}
                </p>
                <p className="text-slate-500 dark:text-gray-400 line-clamp-2">
                  Body: {message}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendNotification}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Publish</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
