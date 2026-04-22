'use client';

import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6 || newPassword.length > 9) {
      setError('Password must be between 6 and 9 characters long');
      return;
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setStatus('loading');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setStatus('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-dynamic">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary)] rounded-full blur-[120px] opacity-30 pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="glass-card w-full max-w-md p-8 rounded-[2rem] relative z-10">
        {status === 'success' ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
            <p className="text-gray-300 mb-6">Your password has been updated successfully.</p>
            <Link href="/login" className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-purple-500 transition-colors inline-block">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Lock className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-white">New Password</h1>
              <p className="text-[var(--color-muted)] mt-2">6–9 characters. Link valid for 10 minutes.</p>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p className="text-sm">{error}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {['New Password', 'Confirm Password'].map((label, i) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">{label}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      className="block w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                      placeholder={label}
                      maxLength={9}
                      value={i === 0 ? newPassword : confirmPassword}
                      onChange={(e) => i === 0 ? setNewPassword(e.target.value) : setConfirmPassword(e.target.value)}
                    />
                    {i === 0 && (
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={status === 'loading'}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white rounded-xl font-medium flex items-center justify-center">
                {status === 'loading' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Reset Password'}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
