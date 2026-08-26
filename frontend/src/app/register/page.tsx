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
          try {
            (window as any).google.accounts.id.initialize({
              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '807433349889-957a3l6dtio305gtn6g5f7ek39rgi498.apps.googleusercontent.com',
              callback: handleGoogleCredentialResponse,
            });
            const container = document.getElementById('google-signin-btn');
            if (container) {
              const containerWidth = container.clientWidth || 340;
              const finalWidth = Math.min(380, Math.max(200, containerWidth));
              (window as any).google.accounts.id.renderButton(container, {
                theme: 'outline',
                size: 'large',
                width: finalWidth,
                shape: 'rectangular',
                text: 'signup_with',
              });
            }
          } catch (e) {
            console.warn('Google GIS init error:', e);
          }
        }
      };

      if (document.getElementById(id)) {
        setTimeout(initGis, 50);
      } else {
        const script = document.createElement('script');
        script.id = id;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setTimeout(initGis, 50);
        };
        script.onerror = (e) => {
          console.warn('Google GIS script load failed:', e);
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="glass-card w-full max-w-sm p-5 sm:p-6 rounded-3xl relative z-10 shadow-2xl border border-white/10"
      >
        <div className="text-center mb-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="w-11 h-11 bg-[var(--color-primary)] rounded-xl mx-auto mb-2 flex items-center justify-center shadow-md shadow-purple-500/20"
          >
            <User className="text-white w-5 h-5" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">Join DriveFlow today</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/40 text-red-200 px-3.5 py-2 rounded-xl mb-3.5 flex items-start gap-2 text-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}

        {success ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1.5">Registration Successful</h3>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">Please wait for admin approval. You can contact the admin to expedite the process.</p>
            <div className="flex flex-col gap-2.5">
              <a 
                href="mailto:rupambairagya08@gmail.com?subject=Approval Request"
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors inline-block"
              >
                Contact Admin
              </a>
              <Link href="/login" className="text-gray-400 hover:text-white transition-colors text-xs py-1">
                Back to Login
              </Link>
            </div>
          </motion.div>
        ) : showOtp ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-3"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-full mx-auto mb-3 flex items-center justify-center">
              <Mail className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Verify Your Email</h3>
            <p className="text-gray-300 mb-2 text-xs">We've sent a 6-digit code to <b>{formData.email}</b>.</p>
            <p className="text-yellow-400/90 mb-4 text-[11px] font-medium bg-yellow-400/10 py-1 px-2.5 rounded-lg inline-block">Check Spam folder if not found in inbox.</p>
            
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input
                type="text"
                required
                maxLength={6}
                className="block w-full text-center tracking-[0.4em] text-xl py-2 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all font-mono"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify Email'}
              </motion.button>
            </form>
            <div className="mt-4">
              <button onClick={handleResendOtp} className="text-xs text-[var(--color-primary)] hover:text-white transition-colors">
                Didn't receive code? Resend
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 ml-0.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  className="block w-full pl-10 pr-3.5 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 ml-0.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-10 pr-3.5 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 ml-0.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  className="block w-full pl-10 pr-10 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 ml-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Use 6 to 9 characters for password
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 ml-0.5">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  className="block w-full pl-10 pr-10 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 mt-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 active:scale-95"
            >
              {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Register'}
            </motion.button>
          </form>
        )}

        {!success && !showOtp && (
          <>
            <div className="relative flex py-1 items-center justify-center my-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-3 text-gray-500 text-xs">or</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {isNativeApp ? (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleNativeGoogleRegister}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-xl text-xs sm:text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
                </svg>
                Register with Google
              </motion.button>
            ) : (
              <div className="w-full flex flex-col items-center justify-center shrink-0 min-h-[58px]">
                <div 
                  className="relative w-full h-[40px] min-h-[40px] max-h-[40px] shrink-0 rounded-xl bg-white text-neutral-900 font-semibold text-xs sm:text-sm border border-neutral-300 shadow-sm overflow-hidden flex items-center justify-center cursor-pointer"
                  style={{ height: '40px', minHeight: '40px', maxHeight: '40px' }}
                >
                  {/* Permanent static button - never erased during GIS load */}
                  <div className="flex items-center justify-center gap-2.5 pointer-events-none z-0">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
                    </svg>
                    <span>Register with Google</span>
                  </div>
                  {/* Google GIS container overlay */}
                  <div 
                    id="google-signin-btn" 
                    className="absolute inset-0 z-10 opacity-[0.001] flex items-center justify-center overflow-hidden" 
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 text-center max-w-[280px]">
                  If the Google login window does not open, please disable Brave Shield / Adblocker and refresh.
                </p>
              </div>
            )}

            <p className="mt-3.5 text-center text-xs text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="text-white font-semibold hover:text-[var(--color-primary)] transition-colors">
                Sign in here
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
