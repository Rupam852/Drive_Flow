'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Shield, Edit2, Check, X, Key, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password reset confirmation triggers
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showSuccessLogout, setShowSuccessLogout] = useState(false);
  const [resetTimer, setResetTimer] = useState(5);

  useEffect(() => {
    // Retrieve stored profile information
    const userString = localStorage.getItem('user');
    if (userString) {
      const parsed = JSON.parse(userString);
      setUserData(parsed);
      setNameInput(parsed.name || '');
    } else {
      router.replace('/login');
    }
  }, [router]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setError('Name field cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.put('/auth/profile', { name: nameInput });
      const updatedUser = res.data.user;

      // Sync local storage user token details
      const userString = localStorage.getItem('user');
      if (userString) {
        const parsed = JSON.parse(userString);
        const merged = { ...parsed, name: updatedUser.name };
        localStorage.setItem('user', JSON.stringify(merged));
        setUserData(merged);
      }

      setSuccess('Profile name updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerForgotPassword = async () => {
    if (!userData?.email) return;
    
    setLoading(true);
    setError('');
    
    try {
      await api.post('/auth/forgot-password', { email: userData.email });
      
      // Close confirmation dialog, open Success/Logout redirect overlay
      setShowConfirmReset(false);
      setShowSuccessLogout(true);
      
      // Auto redirect countdown timer (5 seconds)
      let count = 5;
      const interval = setInterval(() => {
        count -= 1;
        setResetTimer(count);
        if (count <= 0) {
          clearInterval(interval);
          executeSecurityLogout();
        }
      }, 1000);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to trigger password reset. Please try again.');
      setShowConfirmReset(false);
    } finally {
      setLoading(false);
    }
  };

  const executeSecurityLogout = () => {
    // Flush local authorization details
    localStorage.removeItem('token_user');
    if (localStorage.getItem('role') === 'user') {
      localStorage.removeItem('role');
      localStorage.removeItem('token');
    }
    localStorage.removeItem('user');
    router.replace('/login');
  };

  if (!userData) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">My Profile</h2>
        <p className="text-gray-400 text-sm">Manage your personal workspace credentials and details</p>
      </div>

      {/* Success / Error Alerts */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-4 py-3 rounded-2xl flex items-center gap-3 text-sm"
          >
            <Check className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Profile Info Card */}
      <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden space-y-8">
        
        {/* Glow Decor */}
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Profile Header Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-900 via-indigo-950 to-purple-900 flex items-center justify-center border border-white/10 text-white font-extrabold text-3xl">
            {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-xl font-bold text-white">{userData.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 w-fit">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
                {userData.role || 'User'} Status: {userData.status || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="space-y-6">
          
          {/* Field: Full Name */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Full Name</label>
            
            {isEditing ? (
              <form onSubmit={handleUpdateName} className="flex gap-2 w-full">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </span>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center shrink-0"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setNameInput(userData.name); }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-white text-sm font-semibold">{userData.name}</span>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors border border-white/5 flex items-center justify-center"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Field: Email (Read Only) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Email Address</label>
            <div className="flex items-center p-4 bg-white/5 border border-white/5 rounded-2xl opacity-60 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <span className="text-white text-sm font-semibold">{userData.email}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-medium">To modify your email address, please contact system administrators.</p>
          </div>

        </div>

        {/* Security / Password Action Section */}
        <div className="pt-6 border-t border-white/5 space-y-4">
          <h4 className="text-sm font-bold text-white tracking-wide">Security Actions</h4>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 border border-amber-500/30 hover:border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white rounded-2xl font-bold transition-all text-sm w-full sm:w-fit cursor-pointer"
          >
            <Key className="w-4 h-4" />
            <span>Request Password Reset (Forgot Password)</span>
          </button>
        </div>

      </div>

      {/* MODAL 1: Confirm Password Reset */}
      <AnimatePresence>
        {showConfirmReset && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-md w-full p-8 rounded-[2.5rem] text-center border border-white/10 relative overflow-hidden"
            >
              <AlertCircle className="w-14 h-14 text-amber-400 mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-white mb-2">Password Reset Confirmation</h3>
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                Are you sure you want to trigger a password reset for <strong>{userData.email}</strong>? You will be automatically logged out for security purposes after the link is sent.
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTriggerForgotPassword}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors font-bold text-sm flex items-center gap-1.5"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Yes, Reset & Log Out'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Reset Success Notification + Auto Logout */}
      <AnimatePresence>
        {showSuccessLogout && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0f172a]/95 backdrop-blur-md select-none touch-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card max-w-md w-full p-8 rounded-[2.5rem] text-center border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Email Sent Successfully!</h3>
              <p className="text-sm text-sky-200/60 leading-relaxed mb-6">
                A password reset instructions link has been sent to your inbox. Please check your email to update your secure password.
              </p>
              
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl mb-8 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-1">Security Redirection</span>
                <p className="text-white font-bold text-sm">
                  Logging out in <span className="text-blue-400 text-lg font-black animate-pulse">{resetTimer}</span> seconds...
                </p>
              </div>

              <button
                onClick={executeSecurityLogout}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-[0_10px_25px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                Log Out Now
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
