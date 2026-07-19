'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsNativeApp(isNative);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const verifyParam = params.get('verify');
      
      if (emailParam && verifyParam === 'true') {
        setFormData(prev => ({ ...prev, email: emailParam }));
        setShowOtp(true);
      }
    }

    if (!isNative) {
      const id = 'google-jssdk';
      const initGis = () => {
        if ((window as any).google) {
          (window as any).google.accounts.id.initialize({
            client_id: '807433349889-957a3l6dtio305gtn6g5f7ek39rgi498.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse,
          });
          const container = document.getElementById('google-signin-btn');
          if (container) {
            (window as any).google.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              width: 384,
              shape: 'pill',
              text: 'signup_with',
            });
          }
        }
      };

      if (document.getElementById(id)) {
        setTimeout(initGis, 100);
      } else {
        const script = document.createElement('script');
        script.id = id;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setTimeout(initGis, 100);
        };
        document.body.appendChild(script);
      }
    }
  }, [router]);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (response?.credential) {
      await submitGoogleRegister(response.credential);
    }
  };

  const submitGoogleRegister = async (idToken: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/google', { idToken, action: 'register' });
      const userData = res.data;

      if (userData.status === 'pending') {
        setSuccess(true);
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem('token', userData.token);
      localStorage.setItem(`token_${userData.role}`, userData.token);
      localStorage.setItem('role', userData.role);
      localStorage.setItem('user', JSON.stringify(userData));

      if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(err.response.data.message || 'Google account is pending approval.');
      } else {
        setError(err.response?.data?.message || 'Google Sign-Up failed.');
      }
      setIsSubmitting(false);
    }
  };

  const handleNativeGoogleRegister = async () => {
    setError('');
    const GoogleAuthPlugin = (window as any).Capacitor?.Plugins?.GoogleAuthPlugin;
    if (!GoogleAuthPlugin) {
      setError('Native Google Sign-In helper is not loaded.');
      return;
    }

    try {
      const res = await GoogleAuthPlugin.login({
        webClientId: '807433349889-957a3l6dtio305gtn6g5f7ek39rgi498.apps.googleusercontent.com'
      });
      if (res?.idToken) {
        await submitGoogleRegister(res.idToken);
      } else {
        setError('Failed to obtain Google login ID token.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Native Google Sign-In cancelled or failed.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password.length < 6 || formData.password.length > 9) {
      setError('Password must be between 6 and 9 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      if (res.data.requireOtp) {
        setShowOtp(true);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);
    try {
      await api.post('/auth/verify-email', { email: formData.email, otp });
      setShowOtp(false);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      await api.post('/auth/resend-otp', { email: formData.email });
      alert('A new OTP has been sent to your email.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-[100dvh] w-full min-w-full flex items-center justify-center p-4 bg-gradient-dynamic relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary)] rounded-full blur-[120px] opacity-30 pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-secondary)] rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card w-full max-w-md p-8 rounded-[2rem] relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-16 h-16 bg-[var(--color-primary)] rounded-2xl mx-auto mb-4 flex items-center justify-center"
          >
            <User className="text-white w-8 h-8" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-[var(--color-muted)] mt-2">Join DriveFlow today</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Registration Successful</h3>
            <p className="text-gray-300 mb-6">Please wait for admin approval. You can contact the admin to expedite the process.</p>
            <div className="flex flex-col gap-3">
              <a 
                href="mailto:rupambairagya08@gmail.com?subject=Approval Request"
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-blue-600 text-white rounded-xl transition-colors inline-block"
              >
                Contact Admin
              </a>
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors py-2">
                Back to Login
              </Link>
            </div>
          </motion.div>
        ) : showOtp ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <div className="w-16 h-16 bg-purple-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Mail className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Verify Your Email</h3>
            <p className="text-gray-300 mb-2 text-sm">We've sent a 6-digit code to <b>{formData.email}</b>. Please enter it below.</p>
            <p className="text-yellow-400/90 mb-6 text-xs font-medium bg-yellow-400/10 py-1.5 px-3 rounded-lg inline-block">Please check your Spam/Junk folder if you don't see it in your inbox.</p>
            
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                required
                maxLength={6}
                className="block w-full text-center tracking-[0.5em] text-2xl py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="w-full py-3 bg-[var(--color-primary)] hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify Email'}
              </motion.button>
            </form>
            <div className="mt-6">
              <button onClick={handleResendOtp} className="text-sm text-[var(--color-primary)] hover:text-white transition-colors">
                Didn't receive the code? Resend
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  className="block w-full pl-11 pr-12 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5 ml-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Use 6 to 9 characters for your password
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  className="block w-full pl-11 pr-12 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 mt-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Register'}
            </motion.button>
          </form>
        )}

        {!success && !showOtp && (
          <>
            <div className="relative flex py-2 items-center justify-center my-4">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">or</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {isNativeApp ? (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleNativeGoogleRegister}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
                </svg>
                Sign up with Google
              </motion.button>
            ) : (
              <div className="w-full flex justify-center">
                <div id="google-signin-btn" className="w-full min-h-[44px]" />
              </div>
            )}

            <p className="mt-6 text-center text-sm text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="text-white font-medium hover:text-[var(--color-primary)] transition-colors">
                Sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
