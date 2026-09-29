'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Mail, Send, Users, User, CheckCircle2, AlertTriangle,
  Search, X, Sparkles, RefreshCw, Eye, Edit3, ArrowRight,
  ShieldCheck, Info, Check, AlertCircle, ChevronDown,
  Trash2, ExternalLink, Link2, CheckCheck, Smartphone, FileText,
  Clock, EyeOff, Copy, XCircle, Lock, Unlock, Wand2, Download
} from 'lucide-react';
import Link from 'next/link';
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

export interface AuditUser {
  _id: string;
  name: string;
  email: string;
  role?: string;
  profilePic?: string;
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
  readUsers?: AuditUser[];
  targetUsers?: AuditUser[];
}

interface DeliveryReportData {
  isOpen: boolean;
  success: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  failedEmails?: string[];
  failedDetails?: Array<{ email: string; name?: string; reason: string }>;
  channels: string[];
  subject: string;
  recipientMode: string;
}

const TEMPLATES = [
  {
    name: '📄 File Sync Update',
    subject: 'DriveFlow: Workspace file sync update',
    message: `Hello,

Your DriveFlow cloud workspace has updated and synchronized your latest files.

• Status: Synchronization Complete
• File Name: 

You can access and organize your updated documents anytime from your DriveFlow dashboard.

Best regards,
DriveFlow Team`,
  },
  {
    name: '🚀 App Update Ready',
    subject: 'DriveFlow: New Android Update Available',
    message: `Hello,

A new version (Version [Version Name]) of DriveFlow is now available with enhancements to file transfer speed and platform stability.

Open your DriveFlow dashboard or mobile app to install the update and explore the latest improvements.

Best regards,
DriveFlow Team`,
  },
  {
    name: '📢 New Features Added',
    subject: 'DriveFlow: New features and platform improvements',
    message: `Hello,

We have added new capabilities and optimizations to provide you with a faster and smoother experience:

• High-speed file uploads and downloads
• Enhanced file preview and cloud organization

Open DriveFlow to explore the latest enhancements.

Best regards,
DriveFlow Team`,
  },
  {
    name: '⚙️ Service Notice',
    subject: 'DriveFlow: System performance and stability update',
    message: `Hello,

We are performing scheduled system optimizations to ensure fast and reliable cloud performance across DriveFlow.

• Schedule: Tonight, 11:00 PM – 11:30 PM
• Impact: Brief service delay of 10-15 minutes

All your stored files, folders, and account settings remain completely secure.

Best regards,
DriveFlow Team`,
  },
  {
    name: '🔒 Security Best Practices',
    subject: 'DriveFlow: Workspace safety and security recommendations',
    message: `Hello,

Here are a few recommended best practices for protecting your DriveFlow cloud workspace:

• Keep your account credentials confidential and use strong passwords.
• Sign out when accessing your account from shared or public computers.

Feel free to reach out if you have any questions regarding your account settings.

Best regards,
DriveFlow Team`,
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
  
  // Channels (Initially unselected by default)
  const [sendInApp, setSendInApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  // Active in-app notifications
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);
  const [loadingAdminNotifs, setLoadingAdminNotifs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Seen Audit Modal State
  const [auditingNotif, setAuditingNotif] = useState<AdminNotificationItem | null>(null);
  const [auditTab, setAuditTab] = useState<'seen' | 'unseen'>('seen');
  const [auditSearch, setAuditSearch] = useState('');

  // UI Controls
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const linkDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking or tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(event.target as Node)) {
        setLinkDropdownOpen(false);
      }
    };

    if (userDropdownOpen || linkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userDropdownOpen, linkDropdownOpen]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOverrides, setPendingOverrides] = useState<{ inApp: boolean; email: boolean } | null>(null);
  const [resultStatus, setResultStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    details?: string;
  } | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<DeliveryReportData | null>(null);
  const [copiedFailed, setCopiedFailed] = useState(false);
  const [showFileNameModal, setShowFileNameModal] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionInput, setVersionInput] = useState('');

  const handleOpenFileNameModal = () => {
    setFileNameInput('');
    setShowFileNameModal(true);
  };

  const handleApplyFileName = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = fileNameInput.trim();
    if (trimmed) {
      if (message.includes('• File Name:')) {
        setMessage(prev => prev.replace(/• File Name:([^\n]*)/, `• File Name: ${trimmed}`));
      } else if (message.includes('[File Name]')) {
        setMessage(prev => prev.replace(/\[File Name\]/g, trimmed));
      } else {
        setMessage(prev => prev + `\n\n• File Name: ${trimmed}`);
      }
      if (subject.includes('[File Name]')) {
        setSubject(prev => prev.replace(/\[File Name\]/g, trimmed));
      }
    }
    setShowFileNameModal(false);
    setFileNameInput('');
  };

  const handleOpenVersionModal = () => {
    setVersionInput('');
    setShowVersionModal(true);
  };

  const handleApplyVersion = (e?: React.FormEvent) => {
    e?.preventDefault();
    let trimmed = versionInput.trim();
    if (trimmed) {
      if (!trimmed.toLowerCase().startsWith('v') && /^\d/.test(trimmed)) {
        trimmed = `v${trimmed}`;
      }
      if (message.includes('[Version Name]')) {
        setMessage(prev => prev.replace(/\[Version Name\]/g, trimmed));
      } else {
        setMessage(prev => prev + `\n\n• Version: ${trimmed}`);
      }
      if (subject.includes('[Version Name]')) {
        setSubject(prev => prev.replace(/\[Version Name\]/g, trimmed));
      }
    }
    setShowVersionModal(false);
    setVersionInput('');
  };

  // Gemini AI Assistant State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiMode, setAiMode] = useState<'polish' | 'draft'>('polish');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    subject: string;
    message: string;
    model?: string;
    usedFallback?: boolean;
    originalModel?: string;
  } | null>(null);

  // AI Error Popup Modal State
  const [aiErrorModal, setAiErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    isApiKeyError?: boolean;
  } | null>(null);

  const handleOpenAiModal = (mode: 'polish' | 'draft' = 'polish') => {
    setAiMode(mode);
    setAiResult(null);
    setShowAiModal(true);
  };

  const handleRunAiAssist = async () => {
    if (aiMode === 'draft' && !aiPrompt.trim()) {
      setAiErrorModal({
        isOpen: true,
        title: 'Draft Prompt Required',
        message: 'Please write a brief description of what announcement or notification you want Gemini to draft.',
      });
      return;
    }

    if (aiMode === 'polish' && !message.trim()) {
      setAiErrorModal({
        isOpen: true,
        title: 'Empty Message Body',
        message: 'Your message body is currently empty. Please write some text first, or switch to "Draft with AI" to generate a complete draft.',
      });
      return;
    }

    setIsAiLoading(true);
    try {
      const payload: any = {
        mode: aiMode,
      };
      if (aiMode === 'draft') {
        payload.prompt = aiPrompt.trim();
      } else {
        payload.currentSubject = subject.trim();
        payload.currentMessage = message.trim();
      }

      const res = await api.post('/ai/assist', payload);
      if (res.data?.success) {
        let rawSubj = res.data.subject || '';
        let rawMsg = res.data.message || '';

        // Extra client-side safety: If message accidentally contains raw JSON structure
        if (rawMsg.trim().startsWith('{') && rawMsg.includes('"message"')) {
          try {
            const parsed = JSON.parse(rawMsg);
            if (parsed.subject) rawSubj = parsed.subject;
            if (parsed.message) rawMsg = parsed.message;
          } catch {
            const msgMatch = rawMsg.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/i);
            if (msgMatch && msgMatch[1]) {
              rawMsg = msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
            const subjMatch = rawMsg.match(/"subject"\s*:\s*"([^"\\]*)/i);
            if (subjMatch && subjMatch[1]) {
              rawSubj = subjMatch[1];
            }
          }
        }

        // Clean any markdown asterisks for human-readable email format
        const cleanSubj = rawSubj
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*/g, '')
          .trim();

        const cleanMsg = rawMsg
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/(^|[^\*])\*(?!\s)([^*]+)\*(?!\*)/g, '$1$2')
          .replace(/^[\*\-]\s+/gm, '• ')
          .replace(/\*{2,}/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        setAiResult({
          subject: cleanSubj,
          message: cleanMsg,
          model: res.data.model,
          usedFallback: res.data.usedFallback,
          originalModel: res.data.originalModel,
        });
      } else {
        throw new Error(res.data?.message || 'Gemini could not generate content.');
      }
    } catch (err: any) {
      console.error('AI Assist error:', err);
      const msg = err.response?.data?.message || err.message || 'Gemini AI request failed.';
      const isApiKeyErr = msg.toLowerCase().includes('key') || msg.toLowerCase().includes('api_key') || msg.toLowerCase().includes('not configured');

      setAiErrorModal({
        isOpen: true,
        title: 'Gemini AI Error',
        message: msg,
        details: err.response?.data?.details ? JSON.stringify(err.response.data.details, null, 2) : undefined,
        isApiKeyError: isApiKeyErr,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplyAiResult = () => {
    if (aiResult) {
      let finalSubject = aiResult.subject || '';
      let finalMessage = aiResult.message || '';

      // Final pass: clean any markdown asterisks and format bullets
      finalSubject = finalSubject
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*/g, '')
        .trim();

      finalMessage = finalMessage
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/(^|[^\*])\*(?!\s)([^*]+)\*(?!\*)/g, '$1$2')
        .replace(/^[\*\-]\s+/gm, '• ')
        .replace(/\*{2,}/g, '')
        .trim();

      if (finalSubject) setSubject(finalSubject);
      if (finalMessage) setMessage(finalMessage);
      setShowAiModal(false);
      setAiResult(null);
      setResultStatus({
        type: 'success',
        text: 'Gemini AI generated content successfully applied to notification form!',
      });
    }
  };

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

  // Target recipient emails resolved for Gmail batching
  const targetRecipientEmails = useMemo(() => {
    if (recipientMode === 'single') {
      return currentSingleUser && currentSingleUser.email && currentSingleUser.email.includes('@')
        ? [currentSingleUser.email.trim()]
        : [];
    }
    if (recipientMode === 'selected') {
      const selectedSet = new Set(selectedUserIds.map(String));
      return users
        .filter(u => selectedSet.has(String(u._id)) && u.email && u.email.includes('@'))
        .map(u => u.email.trim());
    }
    // 'all'
    return users
      .filter(u => u.role !== 'admin' && u.email && u.email.includes('@'))
      .map(u => u.email.trim());
  }, [recipientMode, currentSingleUser, selectedUserIds, users]);

  // Gmail batch size: 15 users per part for maximum safety & zero URL truncation
  const GMAIL_BATCH_SIZE = 15;

  const gmailBatches = useMemo(() => {
    const batches: Array<{
      batchIndex: number;
      partNumber: number;
      emails: string[];
    }> = [];

    for (let i = 0; i < targetRecipientEmails.length; i += GMAIL_BATCH_SIZE) {
      batches.push({
        batchIndex: Math.floor(i / GMAIL_BATCH_SIZE),
        partNumber: Math.floor(i / GMAIL_BATCH_SIZE) + 1,
        emails: targetRecipientEmails.slice(i, i + GMAIL_BATCH_SIZE),
      });
    }
    return batches;
  }, [targetRecipientEmails]);

  // Gmail Dispatcher Modal State
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [confirmedBatches, setConfirmedBatches] = useState<number[]>([]);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);
  const [senderAccount, setSenderAccount] = useState('0');
  const [customSenderEmail, setCustomSenderEmail] = useState('');
  const [loggedInAdminEmail, setLoggedInAdminEmail] = useState('');
  const [loggedInAdminName, setLoggedInAdminName] = useState('Rupam');
  const [savedSenderEmails, setSavedSenderEmails] = useState<string[]>([]);
  // Dual Email Provider State (Brevo vs Own Gmail SMTP)
  const [emailProvider, setEmailProvider] = useState<'brevo' | 'gmail'>('brevo');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const localUserStr = localStorage.getItem('user');
        if (localUserStr) {
          const u = JSON.parse(localUserStr);
          if (u.name) setLoggedInAdminName(u.name);
          if (u.email) setLoggedInAdminEmail(u.email);
        }
      } catch (e) {
        // ignore
      }

      try {
        const savedList = localStorage.getItem('admin_saved_sender_emails');
        if (savedList) {
          const parsed = JSON.parse(savedList);
          if (Array.isArray(parsed)) setSavedSenderEmails(parsed);
        }
      } catch (e) {
        // ignore
      }

      const savedAcc = localStorage.getItem('admin_gmail_sender');
      if (savedAcc) setSenderAccount(savedAcc);
      const savedCustom = localStorage.getItem('admin_gmail_sender_custom');
      if (savedCustom) setCustomSenderEmail(savedCustom);
    }
  }, []);

  const handleSaveSenderEmail = () => {
    const trimmed = customSenderEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    if (!savedSenderEmails.includes(trimmed)) {
      const updated = [...savedSenderEmails, trimmed];
      setSavedSenderEmails(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_saved_sender_emails', JSON.stringify(updated));
      }
    }
    setSenderAccount(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_gmail_sender', trimmed);
    }
    setCustomSenderEmail('');
  };

  const handleRemoveSenderEmail = (emailToRemove: string) => {
    const updated = savedSenderEmails.filter(e => e !== emailToRemove);
    setSavedSenderEmails(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_saved_sender_emails', JSON.stringify(updated));
    }
    if (senderAccount === emailToRemove) {
      setSenderAccount('0');
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_gmail_sender', '0');
      }
    }
  };

  const handleOpenGmailDispatcher = () => {
    setResultStatus(null);
    if (!subject.trim()) {
      setResultStatus({ type: 'error', text: 'Please enter a notification subject/title.' });
      return;
    }
    if (!message.trim()) {
      setResultStatus({ type: 'error', text: 'Please write your message body.' });
      return;
    }
    if (!sendEmail) {
      setResultStatus({ type: 'error', text: 'Please select Email Notification channel to dispatch via Gmail App.' });
      return;
    }
    if (recipientMode === 'single' && !selectedUserId) {
      setResultStatus({ type: 'error', text: 'Please choose a specific user recipient.' });
      return;
    }
    if (recipientMode === 'selected' && selectedUserIds.length === 0) {
      setResultStatus({ type: 'error', text: 'Please choose at least one user recipient.' });
      return;
    }
    if (message.includes('[File Name]')) {
      handleOpenFileNameModal();
      setResultStatus({ type: 'error', text: "Please set the uploaded file name before sending." });
      return;
    }
    if (message.includes('[Version Name]') || subject.includes('[Version Name]')) {
      handleOpenVersionModal();
      setResultStatus({ type: 'error', text: "Please set the release version name before sending." });
      return;
    }
    if (targetRecipientEmails.length === 0) {
      setResultStatus({ type: 'error', text: 'No valid recipient emails found for the selected mode.' });
      return;
    }

    setConfirmedBatches([]);
    setShowGmailModal(true);
  };

  const handleToggleBatchConfirmed = (batchIndex: number) => {
    setConfirmedBatches(prev => 
      prev.includes(batchIndex) ? prev.filter(i => i !== batchIndex) : [...prev, batchIndex]
    );
  };

  const handleLaunchGmailBatch = (emails: string[], preferMailto = false) => {
    if (!emails || emails.length === 0) return;

    let fullBody = message.trim();
    if (attachedLink.trim()) {
      fullBody += `\n\nDirect Link:\n${attachedLink.trim()}`;
    }

    const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSingle = emails.length === 1;

    let mailtoUrl = '';
    if (isSingle) {
      mailtoUrl = `mailto:${encodeURIComponent(emails[0])}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(fullBody)}`;
    } else {
      mailtoUrl = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(fullBody)}`;
    }

    if (isMobile || preferMailto) {
      const a = document.createElement('a');
      a.href = mailtoUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const effectiveAccount = senderAccount === 'custom' && customSenderEmail.trim()
        ? customSenderEmail.trim()
        : senderAccount;

      // Construct Gmail URL targeting the chosen account session
      const baseUrl = effectiveAccount
        ? `https://mail.google.com/mail/u/${encodeURIComponent(effectiveAccount)}/`
        : `https://mail.google.com/mail/`;

      const params = new URLSearchParams({
        view: 'cm',
        fs: '1',
        su: subject.trim(),
        body: fullBody,
      });

      if (effectiveAccount) {
        params.set('authuser', effectiveAccount);
      }

      if (isSingle) {
        params.set('to', emails[0]);
      } else {
        params.set('bcc', emails.join(','));
      }

      const gmailWebUrl = `${baseUrl}?${params.toString()}`;
      
      const newWin = window.open(gmailWebUrl, '_blank', 'noopener,noreferrer');
      // If browser blocked the popup, fall back to mailto: anchor click
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = mailtoUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const handleCopyBatchEmails = (emails: string[], batchIndex: number) => {
    navigator.clipboard.writeText(emails.join(', '));
    setCopiedBatchIndex(batchIndex);
    setTimeout(() => setCopiedBatchIndex(null), 2500);
  };

  // Derived audit lists for active modal
  const { seenUsersList, unseenUsersList, auditSeenPercent } = useMemo(() => {
    if (!auditingNotif) return { seenUsersList: [], unseenUsersList: [], auditSeenPercent: 0 };

    let targetPool: AuditUser[] = [];
    if (auditingNotif.type === 'broadcast') {
      targetPool = users
        .filter(u => u.role !== 'admin')
        .map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          profilePic: u.profilePic,
        }));
    } else {
      targetPool = (auditingNotif.targetUsers || []).filter(u => u && u.role !== 'admin');
    }

    const targetIds = new Set(targetPool.map(u => String(u._id)));
    const seen = (auditingNotif.readUsers || [])
      .filter(u => u && u.role !== 'admin' && (auditingNotif.type === 'broadcast' || targetIds.has(String(u._id))));

    const seenIds = new Set(seen.map(u => String(u._id)));
    const unseen = targetPool.filter(u => !seenIds.has(String(u._id)));

    const percent = targetPool.length > 0 
      ? Math.min(100, Math.round((seen.length / targetPool.length) * 100))
      : 0;

    return { seenUsersList: seen, unseenUsersList: unseen, auditSeenPercent: percent };
  }, [auditingNotif, users]);

  const displayedAuditUsers = useMemo(() => {
    const list = auditTab === 'seen' ? seenUsersList : unseenUsersList;
    if (!auditSearch.trim()) return list;
    const q = auditSearch.toLowerCase();
    return list.filter(
      u => (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q))
    );
  }, [auditTab, seenUsersList, unseenUsersList, auditSearch]);

  // Apply or toggle template preset
  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    if (selectedTemplateName === tmpl.name) {
      setSelectedTemplateName(null);
      setSubject('');
      setMessage('');
      setAttachedLink('');
      return;
    }
    const adminName = loggedInAdminName || 'Rupam';
    setSelectedTemplateName(tmpl.name);
    setSubject(tmpl.subject);
    setMessage(tmpl.message.replace(/\[Admin Name\]/g, adminName));
    // As requested: Choosing any template will NEVER auto-attach a link.
    // Admin manually clicks "Insert Link" to decide whether to attach None, Dashboard, or Download URL.
    setAttachedLink('');
    setResultStatus(null);

    // Prompt admin for File Name if selecting File Sync template
    if (tmpl.name.includes('File Sync')) {
      setFileNameInput('');
      setShowFileNameModal(true);
    } else if (tmpl.name.includes('App Update')) {
      setVersionInput('');
      setShowVersionModal(true);
    }
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
      setResultStatus({ type: 'error', text: 'Please select a delivery channel: In-App Bell Alert (for Phone & App) or Email Notification (for Gmail App).' });
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
      handleOpenFileNameModal();
      setResultStatus({ type: 'error', text: "Please set the uploaded file name before sending." });
      return false;
    }
    if (message.includes('[Version Name]') || subject.includes('[Version Name]')) {
      handleOpenVersionModal();
      setResultStatus({ type: 'error', text: "Please set the release version name before sending." });
      return false;
    }
    return true;
  };

  // Submit dispatch handler (Phone & App Notification + Brevo or Gmail SMTP)
  const handleSendNotification = async (
    overrideInApp?: boolean,
    overrideEmail?: boolean,
    overrideProvider?: 'brevo' | 'gmail'
  ) => {
    if (!validateForm()) return;

    const finalSendInApp = typeof overrideInApp === 'boolean' ? overrideInApp : (pendingOverrides ? pendingOverrides.inApp : sendInApp);
    const finalSendEmail = typeof overrideEmail === 'boolean' ? overrideEmail : (pendingOverrides ? pendingOverrides.email : sendEmail);
    const finalEmailProvider = overrideProvider || emailProvider;

    if (!finalSendInApp && !finalSendEmail) {
      setResultStatus({ type: 'error', text: "Please select at least one delivery channel." });
      return;
    }

    if (recipientMode === 'all' && !showConfirmModal) {
      setPendingOverrides({ inApp: finalSendInApp, email: finalSendEmail });
      setShowConfirmModal(true);
      return;
    }

    setShowConfirmModal(false);
    setPendingOverrides(null);
    setIsSubmitting(true);
    setResultStatus(null);

    try {
      // 1. Dispatch Notification (In-App Push & Direct 1-to-1 Server Email via selected provider)
      await api.post('/notifications/admin', {
        title: subject.trim(),
        message: message.trim(),
        type: recipientMode === 'all' ? 'broadcast' : recipientMode,
        targetUsers: recipientMode === 'single' ? [selectedUserId] : selectedUserIds,
        link: attachedLink.trim() || undefined,
        sendInApp: finalSendInApp,
        sendEmail: finalSendEmail,
        emailProvider: finalEmailProvider,
        senderName: loggedInAdminName || '',
      });

      const channelsUsed: string[] = [];
      if (finalSendInApp) channelsUsed.push('🔔 In-App Bell & Phone Alert');
      if (finalSendEmail) {
        channelsUsed.push(
          finalEmailProvider === 'gmail'
            ? '✉️ Email via Own Gmail SMTP (bott27124@gmail.com)'
            : '✉️ Email via Brevo (notifications@driveflow.neofilestransfer.site)'
        );
      }

      // Launch detailed Delivery Confirmation Popup
      setDeliveryReport({
        isOpen: true,
        success: true,
        totalRecipients: recipientCount,
        sentCount: recipientCount,
        failedCount: 0,
        channels: channelsUsed,
        subject: subject.trim(),
        recipientMode,
      });

      const successMsg = finalSendInApp && finalSendEmail
        ? `Successfully dispatched to ${recipientCount} user phone(s) and sent official email directly to their inbox!`
        : finalSendInApp
        ? `Successfully sent In-App notification & alert to ${recipientCount} user phone(s)!`
        : `Successfully sent direct email to ${recipientCount} user inbox(es) via official server!`;

      setResultStatus({
        type: 'success',
        text: successMsg,
      });

      if (recipientMode === 'single') setSelectedUserId('');
      else if (recipientMode === 'selected') setSelectedUserIds([]);
      setSubject('');
      setMessage('');
      setAttachedLink('');
      setSelectedTemplateName(null);

      fetchAdminNotifications();
    } catch (err: any) {
      console.error('Failed to send in-app notification:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to dispatch in-app notification to phones.';
      setResultStatus({ type: 'error', text: msg });

      setDeliveryReport({
        isOpen: true,
        success: false,
        totalRecipients: recipientCount,
        sentCount: 0,
        failedCount: recipientCount,
        channels: ['🔔 In-App Bell & Phone Alert'],
        subject: subject.trim(),
        recipientMode,
        failedDetails: [
          {
            email: 'Broadcast / In-App Service',
            name: 'Device Network',
            reason: msg,
          },
        ],
      });
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

          {/* Email Provider Selector when sendEmail is enabled */}
          {sendEmail && (
            <div className="mt-3 p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Select Email Dispatch Provider:
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/40">
                  🛡️ 100% Spam-Free • Primary Inbox Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Brevo Provider Option */}
                <button
                  type="button"
                  onClick={() => setEmailProvider('brevo')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    emailProvider === 'brevo'
                      ? 'bg-white dark:bg-[#1a1528] border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    emailProvider === 'brevo' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 dark:border-gray-600'
                  }`}>
                    {emailProvider === 'brevo' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Via Brevo</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                        100% Spam-Free
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-gray-300 truncate mt-0.5 font-medium">
                      notifications@driveflow.neofilestransfer.site
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-semibold">
                      DKIM & SPF Verified • 100% Primary Inbox Guaranteed
                    </p>
                  </div>
                </button>

                {/* Own Gmail SMTP Option */}
                <button
                  type="button"
                  onClick={() => setEmailProvider('gmail')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    emailProvider === 'gmail'
                      ? 'bg-white dark:bg-[#1a1528] border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    emailProvider === 'gmail' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 dark:border-gray-600'
                  }`}>
                    {emailProvider === 'gmail' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Via Own Gmail SMTP</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                        100% Spam-Free
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-gray-300 truncate mt-0.5 font-medium">
                      bott27124@gmail.com
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-semibold">
                      Direct Google Transport • 100% Primary Inbox Guaranteed
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Recipient Audience */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            2. Select Recipient Audience
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Option 1: Broadcast to All */}
            <button
              type="button"
              onClick={() => {
                setRecipientMode('all');
                setResultStatus(null);
              }}
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
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
              <div className="min-w-0 flex-1 pr-7">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                  <span>All Users</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
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
                <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
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
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
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
              <div className="min-w-0 flex-1 pr-7">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                  <span>Specific User</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
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
                <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
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
              className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
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
              <div className="min-w-0 flex-1 pr-7">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                  <span>Selected Users</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
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
                <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
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
                className="w-full pl-10 pr-14 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {subject.length}/120
              </span>
            </div>
          </div>

          {/* Attached Link Input (Delivered in Email Only) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-purple-500" />
                <span>Email Action Link (Included in Email delivery only):</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mr-1">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => setAttachedLink('')}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    !attachedLink
                      ? 'bg-slate-200 dark:bg-white/20 text-slate-900 dark:text-white border-slate-300 dark:border-white/30 font-bold'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60'
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://driveflowrupam.vercel.app';
                    setAttachedLink(`${origin}/user/dashboard`);
                  }}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    attachedLink.includes('/user/dashboard')
                      ? 'bg-purple-100 dark:bg-purple-500/25 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 font-bold'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedLink('https://neofilestransfer.site/download/723586892fd0');
                  }}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    attachedLink.includes('download') || attachedLink.includes('neofilestransfer.site')
                      ? 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 font-bold'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60'
                  }`}
                >
                  Download URL
                </button>
              </div>
            </div>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                placeholder="No action link attached (Choose None, Dashboard, Download URL, or paste URL)"
                value={attachedLink}
                onChange={e => setAttachedLink(e.target.value)}
                className="w-full pl-10 pr-16 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all font-mono"
              />
              {attachedLink && (
                <button
                  type="button"
                  onClick={() => setAttachedLink('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 cursor-pointer"
                  title="Remove attached link"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Message Body Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-gray-200">
                Message Body Text:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Gemini AI Assistant Button */}
                <button
                  type="button"
                  onClick={() => handleOpenAiModal(message.trim() ? 'polish' : 'draft')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-purple-400/40 ring-2 ring-purple-500/20"
                  title="Draft or Polish notification with Gemini AI"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                  <span>✨ Gemini AI</span>
                </button>

                {(selectedTemplateName?.includes('File Upload') || message.includes('[File Name]') || subject.includes('[File Name]')) && (
                  <button
                    type="button"
                    onClick={handleOpenFileNameModal}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 hover:bg-purple-100"
                    title="Set or replace [File Name] in message draft"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>+ Set File Name</span>
                  </button>
                )}

                {(selectedTemplateName?.includes('App Update') || selectedTemplateName?.includes('New Feature') || message.includes('[Version Name]') || subject.includes('[Version Name]')) && (
                  <button
                    type="button"
                    onClick={handleOpenVersionModal}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30 hover:bg-indigo-100"
                    title="Set or replace [Version Name] in message draft and subject"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>+ Set Version Name</span>
                  </button>
                )}

                {/* Interactive Link Selector Dropdown */}
                <div className="relative" ref={linkDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setLinkDropdownOpen(!linkDropdownOpen)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-95 shadow-xs ${
                      attachedLink
                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 ring-1 ring-purple-500/20'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border-slate-300 dark:border-white/10 hover:bg-slate-200/70'
                    }`}
                    title="Choose an action link option (None, Dashboard, or Download URL)"
                  >
                    <Link2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>
                      {attachedLink.includes('/user/dashboard')
                        ? '✓ Dashboard Link'
                        : attachedLink.includes('download') || attachedLink.includes('neofilestransfer.site')
                        ? '✓ Download URL'
                        : attachedLink
                        ? '✓ Custom Link'
                        : '+ Insert Link'}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${linkDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {linkDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-xl bg-white dark:bg-[#161a2b] border border-slate-200 dark:border-white/15 shadow-xl p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                        Choose Action Link (Email)
                      </div>
                      
                      {/* Option 1: None */}
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedLink('');
                          setLinkDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          !attachedLink
                            ? 'bg-slate-100 dark:bg-white/10 font-bold text-slate-900 dark:text-white'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <X className="w-3.5 h-3.5 text-slate-400" />
                          <span>None (No Link)</span>
                        </div>
                        {!attachedLink && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />}
                      </button>

                      {/* Option 2: Dashboard */}
                      <button
                        type="button"
                        onClick={() => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://driveflowrupam.vercel.app';
                          setAttachedLink(`${origin}/user/dashboard`);
                          setLinkDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          attachedLink.includes('/user/dashboard')
                            ? 'bg-purple-50 dark:bg-purple-500/15 font-bold text-purple-900 dark:text-purple-300'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                          <span>Dashboard Portal</span>
                        </div>
                        {attachedLink.includes('/user/dashboard') && <Check className="w-3.5 h-3.5 text-purple-600 stroke-[3]" />}
                      </button>

                      {/* Option 3: Download URL */}
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedLink('https://neofilestransfer.site/download/723586892fd0');
                          setLinkDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          attachedLink.includes('download') || attachedLink.includes('neofilestransfer.site')
                            ? 'bg-indigo-50 dark:bg-indigo-500/15 font-bold text-indigo-900 dark:text-indigo-300'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-indigo-500" />
                          <span>App Download URL</span>
                        </div>
                        {(attachedLink.includes('download') || attachedLink.includes('neofilestransfer.site')) && (
                          <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
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
                  onClick={handleOpenFileNameModal}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0 text-[11px] shadow-xs cursor-pointer"
                >
                  Set File Name
                </button>
              </div>
            )}

            {(message.includes('[Version Name]') || subject.includes('[Version Name]')) && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Notice: Please replace <strong>[Version Name]</strong> with your release version (e.g. vx.0.x).</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenVersionModal}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors shrink-0 text-[11px] shadow-xs cursor-pointer"
                >
                  Set Version Name
                </button>
              </div>
            )}
            <textarea
              rows={9}
              placeholder="Write your announcement or direct message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs transition-all leading-relaxed resize-none"
            />
          </div>

          {/* Action Dispatch Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-500 shrink-0" />
              <span>
                Target: <strong className="text-slate-900 dark:text-white font-bold">{recipientCount} user(s)</strong> via {
                  sendInApp && sendEmail
                    ? 'Both Selected'
                    : sendInApp
                    ? 'Phone & In-App Alert'
                    : sendEmail
                    ? 'Email (Gmail App)'
                    : 'No Channel Selected'
                }.
              </span>
            </div>

            {!sendInApp && !sendEmail ? (
              /* When NEITHER is selected: show guidance message */
              <div className="w-full p-3 rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/[0.02] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Please select a delivery channel above: <strong>In-App Bell Alert</strong> (for Phone & App) or <strong>Email Notification</strong> (for Gmail App).</span>
              </div>
            ) : (
              /* When AT LEAST ONE channel is selected (or BOTH) */
              <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
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

                {/* Master Dispatch Button (Smart Route Dispatcher) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSendNotification(sendInApp, sendEmail, emailProvider);
                  }}
                  disabled={isSubmitting || recipientCount === 0 || !subject.trim() || !message.trim()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-xs shadow-md shadow-purple-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  title="Direct delivery via DriveFlow official server"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {sendInApp && sendEmail
                          ? `Send Both (Phones & Inbox • ${recipientCount} Users)`
                          : sendEmail
                          ? `Send Email to Inboxes (${recipientCount} Users)`
                          : `Send to Phones & App (${recipientCount} Users)`}
                      </span>
                    </>
                  )}
                </button>




              </div>
            )}
          </div>
        </div>

        {/* Right: Live Interactive Preview (5 cols on lg) */}
        <div className={`lg:col-span-5 ${activeTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          <div className="sticky top-20 bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                Live Gmail Inbox & App Preview
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                100% Real Email Match
              </span>
            </div>

            {/* Email Container Mockup - Authentic Gmail App & Inbox Replica */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc] text-slate-800 overflow-hidden shadow-sm font-sans text-xs">
              {/* Authentic Gmail Top Header */}
              <div className="bg-[#c5221f] text-white p-2.5 px-3 flex items-center justify-between text-[11px] font-medium shadow-xs">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white shrink-0" />
                  <span className="font-bold tracking-wide">Gmail</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.2 rounded-full font-normal">
                    {sendEmail ? 'Email Channel Active' : 'Preview'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-white/90">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Verified Safe</span>
                </div>
              </div>

              {/* Recipient Target Meta Bar */}
              <div className="bg-slate-100/90 border-b border-slate-200 p-2.5 flex items-center justify-between text-[11px] text-slate-700">
                <div className="truncate">
                  <span className="font-bold text-slate-900">Target: </span>
                  {recipientMode === 'single' && currentSingleUser
                    ? `${currentSingleUser.name} <${currentSingleUser.email}>`
                    : recipientMode === 'selected'
                    ? `${selectedUserIds.length} Selected Recipients`
                    : `All Verified Users (${users.length})`}
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 font-medium">Safe 15/Batch</span>
              </div>

              {/* Gmail Reading Pane */}
              <div className="p-3.5 bg-slate-100/60">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  {/* Subject & Inbox Tags */}
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[15px] font-bold text-slate-900 leading-snug">
                        {subject.trim() || 'No Subject Specified'}
                      </h4>
                      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        Inbox
                      </span>
                    </div>

                    {/* Sender Details */}
                    <div className="flex items-center gap-2.5 mt-3 pt-2 border-t border-slate-100/80">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
                        {loggedInAdminName ? loggedInAdminName.charAt(0).toUpperCase() : 'R'}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 truncate">
                            {loggedInAdminName || 'Rupam'} (Admin)
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">Just now</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          From: {
                            senderAccount === 'custom' && customSenderEmail.trim()
                              ? customSenderEmail.trim()
                              : senderAccount && senderAccount.includes('@')
                              ? senderAccount
                              : loggedInAdminEmail || 'admin@gmail.com'
                          }
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          To: {recipientMode === 'single' && currentSingleUser ? currentSingleUser.email : 'me (BCC Private)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Email Body: Authentic DriveFlow HTML Email Card */}
                  <div className="p-3.5 bg-slate-100/70">
                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                      {/* Gradient Header */}
                      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white p-4 text-center shadow-xs">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-base font-extrabold tracking-tight">DriveFlow</span>
                          <span className="text-[9px] bg-white/20 text-white font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                            Verified
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-100 font-medium mt-0.5">
                          {loggedInAdminName ? `Message from ${loggedInAdminName}` : 'Official System Notification'}
                        </p>
                      </div>

                      {/* Content Area */}
                      <div className="p-4 space-y-3">
                        <h5 className="text-[14px] font-bold text-slate-900 leading-snug">
                          {subject.trim() || 'No Subject Specified'}
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Hello {recipientMode === 'single' && currentSingleUser ? currentSingleUser.name : 'User'},
                        </p>

                        {/* Formatted Message Content */}
                        <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-sans py-1">
                          {message.trim() ? (
                            message.split(/(\[File Name\]|\[Version Name\])/g).map((part, i) =>
                              part === '[File Name]' ? (
                                <span key={i} className="inline-block bg-amber-100 border border-amber-300 text-amber-900 font-bold px-1.5 py-0.5 rounded text-[11px]">
                                  [File Name]
                                </span>
                              ) : part === '[Version Name]' ? (
                                <span key={i} className="inline-block bg-purple-100 border border-purple-300 text-purple-900 font-bold px-1.5 py-0.5 rounded text-[11px]">
                                  [Version Name]
                                </span>
                              ) : (
                                part
                              )
                            )
                          ) : (
                            <span className="text-slate-400 italic">Your composed message content will appear formatted here...</span>
                          )}
                        </div>

                        {/* Styled Action Button (if link attached) */}
                        {attachedLink && (
                          <div className="py-2 text-center">
                            <a
                              href={attachedLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/25 transition-all no-underline"
                            >
                              <span>
                                {attachedLink.includes('download') || attachedLink.includes('neofilestransfer.site')
                                  ? 'Download Update →'
                                  : attachedLink.includes('dashboard')
                                  ? 'Open Dashboard →'
                                  : 'View Details →'}
                              </span>
                            </a>
                            <div className="mt-1.5 text-[10px] text-slate-400 font-mono truncate max-w-xs mx-auto">
                              {attachedLink}
                            </div>
                          </div>
                        )}

                        {/* Notice Box */}
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 leading-relaxed">
                          This automated notification was sent to your registered DriveFlow account.
                        </div>

                        {/* Sign-off */}
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
                          <p className="font-semibold text-slate-600">Regards,</p>
                          <p className="font-bold text-slate-800">{loggedInAdminName || 'Rupam'} (Operations)</p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
                        <p>© {new Date().getFullYear()} DriveFlow Operations. All rights reserved.</p>
                      </div>
                    </div>
                  </div>

                  {/* Gmail Reply Bar Mockup */}
                  <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>End-to-End SSL & SPF Verified</span>
                    </span>
                    <span className="text-[10px]">Gmail Standard View</span>
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
                  {/* Seen Stats (Clickable) */}
                  <button
                    type="button"
                    onClick={() => {
                      setAuditingNotif(item);
                      setAuditTab('seen');
                      setAuditSearch('');
                    }}
                    className="group text-right cursor-pointer p-2 -my-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-left sm:text-right border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                    title="Click to view which users have seen this notification"
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {item.readCount} / {item.targetCount || 1} Seen ({item.seenPercentage}%)
                      </span>
                    </div>
                    <div className="w-32 h-2 bg-slate-200 dark:bg-white/10 border border-slate-300/60 dark:border-transparent rounded-full overflow-hidden mt-1 ml-auto shadow-inner">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.seenPercentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-end gap-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      <span>Click to view users</span>
                      <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                    </p>
                  </button>

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
                  You are about to publish a notification to <strong>{users.length} verified users</strong> via {
                    (pendingOverrides ? pendingOverrides.inApp : sendInApp) && (pendingOverrides ? pendingOverrides.email : sendEmail)
                      ? 'In-App Bell & Email'
                      : (pendingOverrides ? pendingOverrides.inApp : sendInApp)
                      ? 'In-App Bell'
                      : 'Email'
                  }.
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
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingOverrides(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSendNotification(pendingOverrides?.inApp, pendingOverrides?.email)}
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

      {/* Delivery Confirmation & Failure Audit Modal */}
      <AnimatePresence>
        {deliveryReport?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header with status badge */}
              <div className={`p-6 border-b ${
                deliveryReport.failedCount === 0
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/20'
                  : deliveryReport.sentCount > 0
                  ? 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/20'
                  : 'bg-rose-500/10 dark:bg-rose-500/10 border-rose-500/20'
              } flex items-start justify-between gap-4`}>
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    deliveryReport.failedCount === 0
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : deliveryReport.sentCount > 0
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  }`}>
                    {deliveryReport.failedCount === 0 ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : deliveryReport.sentCount > 0 ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                      {deliveryReport.failedCount === 0
                        ? 'Notification Dispatched Successfully!'
                        : deliveryReport.sentCount > 0
                        ? 'Partial Delivery Alert'
                        : 'Delivery Failed'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">
                      {deliveryReport.failedCount === 0
                        ? `All targeted recipients (${deliveryReport.sentCount}) received the notification.`
                        : `${deliveryReport.sentCount} delivered, but ${deliveryReport.failedCount} user(s) failed.`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeliveryReport(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {/* 3 Metrics Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 text-center">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-gray-400">Total Targeted</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{deliveryReport.totalRecipients}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Delivered</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{deliveryReport.sentCount}</p>
                  </div>
                  <div className={`p-3.5 rounded-2xl text-center ${
                    deliveryReport.failedCount > 0
                      ? 'bg-rose-500/10 border border-rose-500/25'
                      : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10'
                  }`}>
                    <p className={`text-[11px] font-medium ${
                      deliveryReport.failedCount > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-gray-400'
                    }`}>Failed</p>
                    <p className={`text-xl font-bold mt-0.5 ${
                      deliveryReport.failedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                    }`}>{deliveryReport.failedCount}</p>
                  </div>
                </div>

                {/* Channels & Info pill */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-gray-400">Channels:</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200">{deliveryReport.channels.join(' & ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-gray-400">Subject:</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200 truncate max-w-[240px]">{deliveryReport.subject}</span>
                  </div>
                </div>

                {/* If all succeeded */}
                {deliveryReport.failedCount === 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                    <CheckCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">All emails delivered directly to inboxes</p>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                        The SMTP server has confirmed delivery to all {deliveryReport.sentCount} recipient(s) without bounce.
                      </p>
                    </div>
                  </div>
                )}

                {/* If there are failed users: Show Reason List */}
                {deliveryReport.failedCount > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Failed Recipients & Reasons ({deliveryReport.failedCount})</span>
                      </div>
                      {deliveryReport.failedEmails && deliveryReport.failedEmails.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(deliveryReport.failedEmails!.join('\n'));
                            setCopiedFailed(true);
                            setTimeout(() => setCopiedFailed(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedFailed ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedFailed ? 'Copied!' : 'Copy Emails'}</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {deliveryReport.failedDetails && deliveryReport.failedDetails.length > 0 ? (
                        deliveryReport.failedDetails.map((f, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                              <span className="truncate">{f.email}</span>
                              {f.name && <span className="text-[10px] text-slate-500">({f.name})</span>}
                            </div>
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono bg-rose-500/10 px-2 py-1 rounded-lg">
                              Karan (Reason): {f.reason}
                            </p>
                          </div>
                        ))
                      ) : (
                        deliveryReport.failedEmails?.map((email, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex items-center justify-between"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white truncate">{email}</span>
                            <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">Delivery rejected</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDeliveryReport(null)}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Done / Close</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Uploaded File Name Modal */}
      <AnimatePresence>
        {showFileNameModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFileNameModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      Set Uploaded File Name
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                      Replace [File Name] in your message draft
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFileNameModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleApplyFileName} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-gray-200 mb-1.5">
                    File Name:
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Project_Report_2026.pdf"
                      value={fileNameInput}
                      onChange={e => setFileNameInput(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    This will replace all <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-purple-600 dark:text-purple-400 text-[10px]">[File Name]</code> placeholders in your draft.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFileNameModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>OK / Apply Name</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Version Name Modal */}
      <AnimatePresence>
        {showVersionModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVersionModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      Set Release Version
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
                      Replace [Version Name] in your update announcement
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleApplyVersion} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-gray-200 mb-1.5">
                    Version Name:
                  </label>
                  <div className="relative">
                    <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder=""
                      value={versionInput}
                      onChange={e => setVersionInput(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    This will replace all <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-indigo-600 dark:text-indigo-400 text-[10px]">[Version Name]</code> placeholders in your title and message.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>OK / Apply Version</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Batched Gmail App Dispatcher Modal */}
      <AnimatePresence>
        {showGmailModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGmailModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-red-50/50 dark:bg-red-950/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/20">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      Send via Gmail App
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {targetRecipientEmails.length} recipient(s) • Divided into {gmailBatches.length} safe part{gmailBatches.length > 1 ? 's' : ''} (max {GMAIL_BATCH_SIZE}/part)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGmailModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Sender Account Switcher (From) */}
              <div className="px-4 py-3 bg-red-50/40 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/10 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                    <User className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Send From (Google Account / Profile):</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={senderAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSenderAccount(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('admin_gmail_sender', val);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#121626] text-xs font-semibold text-slate-800 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 shadow-xs max-w-full sm:max-w-xs truncate"
                    >
                      {loggedInAdminEmail && (
                        <option value={loggedInAdminEmail}>
                          👤 Logged-in Admin ({loggedInAdminEmail})
                        </option>
                      )}
                      <optgroup label="Browser Google Accounts">
                        <option value="0">Google Account 1 (Default Browser Profile)</option>
                        <option value="1">Google Account 2 (Work / Secondary Account)</option>
                        <option value="2">Google Account 3</option>
                        <option value="3">Google Account 4</option>
                      </optgroup>
                      {savedSenderEmails.length > 0 && (
                        <optgroup label="Saved Phone / Work Emails">
                          {savedSenderEmails.map((em) => (
                            <option key={em} value={em}>
                              📧 {em}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="custom">➕ Enter Phone / Custom Gmail ID...</option>
                    </select>

                    {savedSenderEmails.includes(senderAccount) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSenderEmail(senderAccount)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-[10px] transition-colors cursor-pointer"
                        title="Remove this email from saved list"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {senderAccount === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="email"
                      placeholder="Enter phone or work email (e.g. myname@gmail.com)"
                      value={customSenderEmail}
                      onChange={(e) => setCustomSenderEmail(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#121626] text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-xs font-sans"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSenderEmail}
                      disabled={!customSenderEmail.trim() || !customSenderEmail.includes('@')}
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer transition-all active:scale-95"
                    >
                      Save to List
                    </button>
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-start gap-1.5 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Phone Users:</strong> Phone par Gmail app khulte hi sabse upar <strong>"From:"</strong> par tap karein — aapke phone me login sabhi Google accounts ki list turant khul jayegi.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Website / PC Users:</strong> Upar dropdown se apna login email ya Account 2 choose karein, Gmail automatically usi profile se open hoga.
                    </span>
                  </div>
                </div>
              </div>

              {/* ⚠️ Spam Warning Banner */}
              <div className="px-4 pt-3 pb-1">
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-500/30 flex items-start gap-2.5 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="space-y-1">
                    <p className="font-bold">Emails sent from personal Gmail accounts may land in Spam!</p>
                    <p className="text-amber-700 dark:text-amber-400">
                      Sending bulk BCC from a personal account (e.g. rupambairagya08@gmail.com) is flagged as spam by Google.
                      <br />
                      <strong>✅ Safe Option:</strong> Select <strong>bott27124@gmail.com</strong> from the dropdown — it is a dedicated bot account and emails will land in the <strong>Inbox</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress & Overview */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Progress: {confirmedBatches.length} of {gmailBatches.length} Parts Confirmed
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {gmailBatches.length > 0 ? Math.round((confirmedBatches.length / gmailBatches.length) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-emerald-500 transition-all duration-300 rounded-full"
                    style={{
                      width: `${gmailBatches.length > 0 ? Math.round((confirmedBatches.length / gmailBatches.length) * 100) : 0}%`
                    }}
                  />
                </div>

                {confirmedBatches.length === gmailBatches.length && gmailBatches.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium">All parts have been sent and confirmed! You can now close this popup.</span>
                  </div>
                )}
              </div>

              {/* Batches List */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 max-h-[50vh]">
                {gmailBatches.map((b) => {
                  const isUnlocked = b.batchIndex === 0 || confirmedBatches.includes(b.batchIndex - 1);
                  const isConfirmed = confirmedBatches.includes(b.batchIndex);

                  return (
                    <div
                      key={b.batchIndex}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isConfirmed
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-300 dark:border-emerald-500/30'
                          : isUnlocked
                          ? 'bg-white dark:bg-[#161a2b] border-slate-300 dark:border-white/15 shadow-xs'
                          : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              isConfirmed
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : isUnlocked
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                            }`}>
                              Part {b.partNumber} ({b.emails.length} Users)
                            </span>

                            {isConfirmed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-3.5 h-3.5" /> Sent
                              </span>
                            ) : !isUnlocked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : null}
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1 max-w-sm sm:max-w-xs">
                            {b.emails.slice(0, 3).join(', ')}{b.emails.length > 3 ? ` +${b.emails.length - 3} more` : ''}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopyBatchEmails(b.emails, b.batchIndex)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 text-xs transition-colors cursor-pointer"
                            title="Copy email addresses for this part"
                          >
                            {copiedBatchIndex === b.batchIndex ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isUnlocked ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLaunchGmailBatch(b.emails)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                                title="Open this part in Gmail App (Can re-click anytime)"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{isConfirmed ? 'Re-open in Gmail' : 'Open in Gmail App'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleBatchConfirmed(b.batchIndex)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  isConfirmed
                                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100'
                                }`}
                                title={isConfirmed ? "Click to uncheck if not sent" : "Confirm you pressed send in Gmail"}
                              >
                                {isConfirmed ? '✓ Confirmed' : 'Mark as Sent'}
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Complete Part {b.partNumber - 1} first
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Emails placed in BCC for complete privacy.</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGmailModal(false)}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seen & Read Audit Modal */}
      <AnimatePresence>
        {auditingNotif && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-start justify-between gap-3 bg-slate-50/60 dark:bg-white/[0.02]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {auditingNotif.type === 'broadcast' ? 'Broadcast' : auditingNotif.type === 'selected' ? 'Selected Users' : 'Direct Message'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(auditingNotif.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                    {auditingNotif.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {auditingNotif.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditingNotif(null)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-2 p-4 bg-slate-100/50 dark:bg-white/[0.01] border-b border-slate-100 dark:border-white/10">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                    <CheckCheck className="w-4 h-4" />
                    <span>Seen in App</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {seenUsersList.length}{' '}
                    <span className="text-xs font-normal text-emerald-600/80 dark:text-emerald-400/80">
                      ({auditSeenPercent}%)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold text-xs">
                    <Clock className="w-4 h-4" />
                    <span>Unread / Pending</span>
                  </div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {unseenUsersList.length}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({Math.max(0, 100 - auditSeenPercent)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs: Seen vs Unseen */}
              <div className="flex items-center px-4 pt-3 border-b border-slate-100 dark:border-white/10 gap-2">
                <button
                  type="button"
                  onClick={() => setAuditTab('seen')}
                  className={`pb-2.5 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    auditTab === 'seen'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Seen Users ({seenUsersList.length})</span>
                  {auditTab === 'seen' && (
                    <motion.div
                      layoutId="auditTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab('unseen')}
                  className={`pb-2.5 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    auditTab === 'unseen'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Unseen / Not Opened ({unseenUsersList.length})</span>
                  {auditTab === 'unseen' && (
                    <motion.div
                      layoutId="auditTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full"
                    />
                  )}
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-3 border-b border-slate-100 dark:border-white/10">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={`Search ${auditTab === 'seen' ? 'seen' : 'unseen'} users by name or email...`}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-purple-500"
                  />
                  {auditSearch && (
                    <button
                      type="button"
                      onClick={() => setAuditSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Users List */}
              <div className="p-3 overflow-y-auto flex-1 space-y-1.5 min-h-[160px] max-h-[300px]">
                {displayedAuditUsers.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    {auditSearch ? (
                      <p>No users matching &quot;{auditSearch}&quot;</p>
                    ) : auditTab === 'seen' ? (
                      <div className="space-y-1">
                        <EyeOff className="w-6 h-6 mx-auto text-slate-400 mb-2 opacity-60" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No users have opened this yet</p>
                        <p className="text-[11px]">When users view this notification in their app or web, they will appear here in real-time.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">All targeted users have seen this!</p>
                        <p className="text-[11px]">100% of recipient users have opened and read this notification.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  displayedAuditUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(
                              user.name
                            )} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                          >
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {user.name || 'Unnamed User'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 ml-3">
                        {auditTab === 'seen' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                            Seen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
                            <Clock className="w-3 h-3" />
                            Unread
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {displayedAuditUsers.length} of {auditTab === 'seen' ? seenUsersList.length : unseenUsersList.length} users
                </span>
                <button
                  type="button"
                  onClick={() => setAuditingNotif(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* GEMINI AI ASSISTANT MODAL (POLISH / DRAFT NOTIFICATIONS)       */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Gemini AI Notification Assistant</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Check deliverability, refine tone, or draft notifications instantly
                    </p>
                  </div>
                </div>

                {/* Close Icon (✖) */}
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close AI Assistant"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Tabs: Polish vs Draft */}
              <div className="flex items-center px-4 pt-3 border-b border-slate-100 dark:border-white/10 gap-2 bg-slate-50/50 dark:bg-white/[0.01]">
                <button
                  type="button"
                  onClick={() => {
                    setAiMode('polish');
                    setAiResult(null);
                  }}
                  className={`pb-2.5 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    aiMode === 'polish'
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Polish Current Draft</span>
                  {aiMode === 'polish' && (
                    <motion.div
                      layoutId="aiModeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiMode('draft');
                    setAiResult(null);
                  }}
                  className={`pb-2.5 px-3 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    aiMode === 'draft'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Draft New with AI</span>
                  {aiMode === 'draft' && (
                    <motion.div
                      layoutId="aiModeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    />
                  )}
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {aiMode === 'polish' ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-900 dark:text-purple-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Deliverability & Anti-Spam Check</span>
                      </div>
                      <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                        Gemini will review your subject line and message body, fix any grammar or spelling mistakes, and remove promotional hype words so the email lands directly in users' <strong>Gmail Primary Inbox</strong>.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-gray-300">Current Subject:</span>
                        <div className="mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-gray-200 font-medium">
                          {subject.trim() || <span className="text-slate-400 italic">No subject entered yet</span>}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-700 dark:text-gray-300">Current Message Body:</span>
                        <div className="mt-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-gray-200 font-medium whitespace-pre-wrap max-h-36 overflow-y-auto text-xs leading-relaxed">
                          {message.trim() || <span className="text-slate-400 italic">No message body text written yet</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Smart Notification Generator</span>
                      </div>
                      <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        Describe what you need in simple words. Gemini will craft an appropriate, professional notification with an optimized transactional subject and clear bullet points.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-gray-200 mb-1.5">
                        What would you like to announce to your users?
                      </label>
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder="e.g. Advise all users about scheduled cloud storage maintenance this Saturday night for 30 minutes, files are safe..."
                        className="w-full p-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs resize-none"
                      />
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Quick Ideas:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Scheduled server maintenance for 30 minutes',
                          'DriveFlow Android App update with fast background sync',
                          'Security recommendation to update passwords',
                          'Cloud storage performance and speed boost',
                        ].map(idea => (
                          <button
                            key={idea}
                            type="button"
                            onClick={() => setAiPrompt(idea)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 text-[11px] transition-colors text-left"
                          >
                            + {idea}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Result Preview (if generated) */}
                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Gemini Enhanced Output</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {aiResult.usedFallback && (
                          <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-500/30">
                            Auto-Fallback from {aiResult.originalModel}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          {aiResult.model || 'Gemini'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-gray-300">Generated Subject:</span>
                        <p className="mt-1 p-2 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 font-semibold text-slate-900 dark:text-white">
                          {aiResult.subject}
                        </p>
                      </div>

                      <div>
                        <span className="font-bold text-slate-700 dark:text-gray-300">Generated Message Body:</span>
                        <div className="mt-1 p-3 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                          {aiResult.message}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleApplyAiResult}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Apply to Message Form</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Link
                  href="/admin/ai-config"
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Open AI Settings (Change Model or API Key)</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAiModal(false)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={handleRunAiAssist}
                    disabled={isAiLoading}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isAiLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{aiMode === 'polish' ? 'Check & Polish Draft' : 'Generate with Gemini'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* POPUP MODAL FOR AI ERRORS WITH ✖ CLOSE ICON AND OK BUTTON       */}
      {/* ============================================================== */}
      <AnimatePresence>
        {aiErrorModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header with Red Warning + Close ✖ Icon */}
              <div className="p-4 sm:p-5 border-b bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                      {aiErrorModal.title || 'Gemini AI Error'}
                    </h3>
                    <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                      Request could not be completed
                    </p>
                  </div>
                </div>

                {/* Close Icon (✖) */}
                <button
                  type="button"
                  onClick={() => setAiErrorModal(null)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close popup"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Body with Error Details */}
              <div className="p-5 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200 leading-relaxed">
                  <p className="font-semibold text-xs">{aiErrorModal.message}</p>
                  {aiErrorModal.details && (
                    <pre className="mt-2 p-2 rounded-lg bg-black/5 dark:bg-black/40 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {aiErrorModal.details}
                    </pre>
                  )}
                </div>

                {aiErrorModal.isApiKeyError ? (
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 space-y-2">
                    <p className="text-purple-900 dark:text-purple-200 font-medium">
                      Would you like to configure your Google Gemini API key now?
                    </p>
                    <Link
                      href="/admin/ai-config"
                      onClick={() => setAiErrorModal(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      <span>Open AI Settings</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-500 dark:text-slate-400 px-1">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Troubleshooting:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>Ensure your Gemini API key is valid and has remaining quota.</li>
                      <li>Check your network connection and retry.</li>
                      <li>Visit the AI Settings menu to test your model connection.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer with OK Button */}
              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAiErrorModal(null)}
                  className="w-full sm:w-auto px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* FILE NAME INPUT MODAL                                          */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showFileNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/30 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Enter Synchronized File Name
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Type the file name to display in the notification
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFileNameModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyFileName} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    File Name (e.g. Project_Presentation.pdf, Assets.zip)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={fileNameInput}
                    onChange={e => setFileNameInput(e.target.value)}
                    placeholder="Enter file name..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFileNameModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Apply File Name
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* VERSION INPUT MODAL                                            */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showVersionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-5 border-b bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/30 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Enter App Version Name
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Set the release version tag for users
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="p-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Close popup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyVersion} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Version (e.g. 1.0.9 or v2.4.0)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={versionInput}
                    onChange={e => setVersionInput(e.target.value)}
                    placeholder="e.g. 1.0.9"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111422] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Apply Version
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

