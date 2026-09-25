'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Shield, Camera, Edit2, Check, X, Key,
  AlertCircle, RefreshCw, CheckCircle2, Lock, Eye, EyeOff,
  Calendar, Sparkles, Send, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import CloudLogo from '@/components/CloudLogo';

interface AdminProfileData {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  profilePic?: string;
  createdAt?: string;
  isGoogleUser?: boolean;
}

export default function AdminProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Upload Avatar State
  const [uploadingPic, setUploadingPic] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Forgot Password / Reset Link State
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  // Feedback Alerts
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Fetch live profile from backend
  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res.data) {
        setProfile(res.data);
        setNameInput(res.data.name || '');

        // Sync local storage user cache
        const localUserStr = localStorage.getItem('user');
        if (localUserStr) {
          const parsed = JSON.parse(localUserStr);
          const merged = { ...parsed, ...res.data };
          localStorage.setItem('user', JSON.stringify(merged));
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch from /auth/profile, falling back to cached user:', err);
      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        setProfile(parsed);
        setNameInput(parsed.name || '');
      } else {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Update Name
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showStatus('error', 'Name cannot be empty.');
      return;
    }

    setSavingName(true);
    try {
      const res = await api.put('/auth/profile', { name: nameInput.trim() });
      const updated = res.data.user;
      setProfile((prev) => (prev ? { ...prev, name: updated.name } : null));
      setIsEditingName(false);

      // Sync local storage
      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        localStorage.setItem('user', JSON.stringify({ ...parsed, name: updated.name }));
      }

      showStatus('success', 'Admin profile name updated successfully!');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  // Handle Profile Photo Upload & Compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showStatus('error', 'Please choose a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showStatus('error', 'Image size must be less than 5MB.');
      return;
    }

    setUploadingPic(true);

    try {
      // Compress and resize image to compact canvas Data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDimension = 320;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
              resolve(event.target?.result as string);
            }
          };
          img.onerror = () => reject(new Error('Failed to process image'));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Save to backend
      const res = await api.put('/auth/profile', { profilePic: dataUrl });
      const updated = res.data.user;

      setProfile((prev) => (prev ? { ...prev, profilePic: updated.profilePic } : null));

      // Sync local storage
      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        localStorage.setItem('user', JSON.stringify({ ...parsed, profilePic: updated.profilePic }));
      }

      showStatus('success', 'Profile photo updated successfully!');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove Profile Photo
  const handleRemovePhoto = async () => {
    setUploadingPic(true);
    try {
      const res = await api.put('/auth/profile', { profilePic: '' });
      const updated = res.data.user;

      setProfile((prev) => (prev ? { ...prev, profilePic: '' } : null));

      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        localStorage.setItem('user', JSON.stringify({ ...parsed, profilePic: '' }));
      }

      showStatus('success', 'Profile photo removed.');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to remove photo.');
    } finally {
      setUploadingPic(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6 || newPassword.length > 9) {
      showStatus('error', 'New password must be between 6 and 9 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus('error', 'New password and confirm password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });

      showStatus('success', 'Password updated successfully! Keep your new credentials safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Trigger Forgot Password (Send Reset Email)
  const handleTriggerForgotPassword = async () => {
    if (!profile?.email) return;

    setSendingResetLink(true);
    try {
      await api.post('/auth/forgot-password', { email: profile.email });
      setShowResetConfirmModal(false);
      setResetSentSuccess(true);
      showStatus('success', `Password reset link sent to ${profile.email}! Check your inbox.`);
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to send reset email.');
      setShowResetConfirmModal(false);
    } finally {
      setSendingResetLink(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-800 dark:text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Admin Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Admin Profile
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your administrator identity, profile photo, and security credentials.
        </p>
      </div>

      {/* Status Alerts */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-sm border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="flex-1">{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="p-1 hover:opacity-75 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Profile Card */}
      <div className="bg-white dark:bg-[#121626] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Button */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-purple-500/20 dark:border-purple-500/30 shadow-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center">
              {profile?.profilePic ? (
                <img
                  src={profile.profilePic}
                  alt={profile.name || 'Admin'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-extrabold text-white">
                  {(profile?.name || 'A').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Upload Overlay Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
              className="absolute bottom-1 right-1 p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30 transition-transform active:scale-95 cursor-pointer"
              title="Upload new profile photo"
            >
              {uploadingPic ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* User Details & Edit Name */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Shield className="w-3.5 h-3.5" />
                Administrator
              </span>

              {profile?.isGoogleUser && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Google Linked
                </span>
              )}
            </div>

            {/* Editable Name */}
            {isEditingName ? (
              <form onSubmit={handleUpdateName} className="flex items-center gap-2 mt-2 max-w-sm">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-purple-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors cursor-pointer"
                  title="Save name"
                >
                  {savingName ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setNameInput(profile?.name || '');
                  }}
                  className="p-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {profile?.name || 'Administrator'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
                  title="Edit Name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{profile?.email}</span>
            </p>

            {/* Photo Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-purple-500 dark:hover:border-purple-400 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors cursor-pointer"
              >
                Change Photo
              </button>
              {profile?.profilePic && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPic}
                  className="px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-medium transition-colors cursor-pointer"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Note on Google Profile Sync */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/10 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Cross-Login Profile Picture Sync:</strong> Agar aap Google se login karte hain, toh aapki Google profile picture automatically yaha save ho jati hai. Uske baad agar aap password se bhi login karenge, toh wahi photo hamesha dikhayi degi. Aap chahe toh kabhi bhi upar se nayi photo bhi upload kar sakte hain.
          </p>
        </div>
      </div>

      {/* Grid: Security & Password Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Change Password Directly */}
        <div className="bg-white dark:bg-[#121626] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Change Password
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your admin login password (6 to 9 characters).
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
              {/* Current Password (optional if purely google, but recommended) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password (6-9 chars)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    maxLength={9}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new 6-9 character password"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  maxLength={9}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full mt-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Forgot Password / Email Reset Flow */}
        <div className="bg-white dark:bg-[#121626] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Forgot Password?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Request a secure password reset link sent to your registered email.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Agar aap apna password bhool gaye hain ya security reason se link ke zariye password reset karna chahte hain, toh yaha se direct reset link generate karke apne email par receive kar sakte hain:
              </p>
              <div className="p-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 flex items-center gap-2 text-xs font-mono text-slate-800 dark:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="truncate">{profile?.email}</span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              disabled={sendingResetLink}
              className="w-full py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Password Reset Link to Email</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Forgot Password Email */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <Key className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Send Password Reset Link?
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">
                  We will send an encrypted password reset link to <strong>{profile?.email}</strong>. The link will remain active for 10 minutes.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  disabled={sendingResetLink}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTriggerForgotPassword}
                  disabled={sendingResetLink}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/25 flex items-center gap-1.5 cursor-pointer"
                >
                  {sendingResetLink ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Link Now</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
