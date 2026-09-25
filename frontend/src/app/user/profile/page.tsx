'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Shield, Edit2, Check, X, Key,
  AlertCircle, RefreshCw, CheckCircle2, Lock, Eye, EyeOff,
  Sparkles, Send, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface UserProfileData {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  profilePic?: string;
  createdAt?: string;
  isGoogleUser?: boolean;
}

export default function UserProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // OTP-Protected Password Change State
  const [otpStep, setOtpStep] = useState<'idle' | 'otp_sent'>('idle');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password / Reset Link State
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showPasswordSuccessModal, setShowPasswordSuccessModal] = useState(false);

  // Feedback Alerts
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 6000);
  };

  // Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Fetch live profile from backend
  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res.data) {
        setProfile(res.data);
        setNameInput(res.data.name || '');

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

      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        localStorage.setItem('user', JSON.stringify({ ...parsed, name: updated.name }));
      }

      showStatus('success', 'Profile name updated successfully!');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  // Step 1: Send OTP to User's Email
  const handleSendPasswordOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await api.post('/auth/send-password-otp');
      setOtpStep('otp_sent');
      setResendCooldown(60);
      showStatus('success', res.data?.message || `6-digit OTP code has been sent to ${profile?.email}`);
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Failed to send OTP code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Verify OTP and Change Password
  const handleVerifyOtpAndChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enteredOtp || enteredOtp.trim().length !== 6) {
      showStatus('error', 'Please enter the valid 6-digit OTP received in your email.');
      return;
    }

    if (!newPassword || newPassword.length < 6 || newPassword.length > 9) {
      showStatus('error', 'New password must be between 6 and 9 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus('error', 'New password and confirm password do not match.');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.post('/auth/verify-password-otp', {
        otp: enteredOtp.trim(),
        newPassword,
      });

      setShowPasswordSuccessModal(true);
      showStatus('success', res.data?.message || 'Password verified and updated successfully via Email OTP!');
      setOtpStep('idle');
      setEnteredOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showStatus('error', err.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Trigger Forgot Password (Send Reset Email Link)
  const handleTriggerForgotPassword = async () => {
    if (!profile?.email) return;

    setSendingResetLink(true);
    try {
      await api.post('/auth/forgot-password', { email: profile.email });
      setShowResetConfirmModal(false);
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
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Your Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          My Profile
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your account details and email OTP-protected security credentials.
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
          {/* Avatar (Google Picture or Default Avatar) */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-purple-500/20 dark:border-purple-500/30 shadow-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center">
              {profile?.profilePic ? (
                <img
                  src={profile.profilePic}
                  alt={profile.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-extrabold text-white">
                  {(profile?.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* User Details & Edit Name */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <User className="w-3.5 h-3.5" />
                DriveFlow Member
              </span>

              {profile?.profilePic && profile?.isGoogleUser ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  Google Profile Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                  Default Avatar
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
                  {profile?.name || 'DriveFlow User'}
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
          </div>
        </div>

        {/* Note on Google Profile Sync */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/10 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Profile Image Sync:</strong> Agar aap Google Sign-In se login karte hain, toh aapki verified Google profile photo automatically yaha show hoti hai. Agar normal email se login hain, toh default initial avatar show hota hai.
          </p>
        </div>
      </div>

      {/* Grid: Security & Password Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: OTP-Verified Password Change (MANDATORY EMAIL VERIFICATION) */}
        <div className="bg-white dark:bg-[#121626] border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Change Password (OTP Protected)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Password change requires mandatory 6-digit email OTP verification.
                </p>
              </div>
            </div>

            {otpStep === 'idle' ? (
              /* Step 1: Request OTP State */
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/30 text-xs text-purple-900 dark:text-purple-300 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Two-Step Security Requirement</span>
                  </div>
                  <p className="leading-relaxed text-purple-800/90 dark:text-purple-300/80">
                    Aap direct password change nahi kar sakte. Security ke liye pehle aapke registered email (<strong>{profile?.email}</strong>) par 6-digit OTP code bheja jayega. Us code ko enter karke hi naya password set hoga.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendPasswordOtp}
                  disabled={sendingOtp}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending OTP to {profile?.email}...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Verification OTP to Email</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Step 2: Enter OTP & Set New Password */
              <form onSubmit={handleVerifyOtpAndChangePassword} className="space-y-3 pt-1">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">OTP sent to <strong>{profile?.email}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpStep('idle')}
                    className="text-[11px] underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white shrink-0 ml-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* 6-Digit OTP Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enter 6-Digit Email OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code (e.g. 542918)"
                    className="w-full px-3.5 py-2.5 text-center font-mono text-base tracking-widest bg-slate-50 dark:bg-white/5 border border-purple-300 dark:border-purple-500/40 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500 font-bold"
                    autoFocus
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password (6-9 characters)
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

                {/* Submit & Resend Controls */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={verifyingOtp || enteredOtp.length !== 6 || !newPassword || !confirmPassword}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {verifyingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying OTP & Updating...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify OTP & Update Password</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                    <span>Didn&apos;t receive code?</span>
                    <button
                      type="button"
                      onClick={handleSendPasswordOtp}
                      disabled={resendCooldown > 0 || sendingOtp}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-semibold disabled:opacity-50 disabled:no-underline cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </div>
              </form>
            )}
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
                Agar aap apna purana password bhool gaye hain, toh aap yaha se apne registered email address par password reset link bhej sakte hain:
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

      {/* Password Changed Successfully Modal */}
      <AnimatePresence>
        {showPasswordSuccessModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPasswordSuccessModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-5"
            >
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Password Changed Successfully!
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                  Aapka password successfully update ho gaya hai. Aap naye password ke saath DriveFlow me safely login aur access kar sakte hain.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setShowPasswordSuccessModal(false)}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>OK / Close</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
