'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, Smartphone, Download, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import LoadingScreen from '@/components/LoadingScreen';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdblocked, setIsAdblocked] = useState(false);
  const [showPopup, setShowPopup] = useState<{ message: string; isError: boolean; email?: string } | null>(null);
  const [isNativeApp, setIsNativeApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).Capacitor?.isNativePlatform?.();
  });
  const router = useRouter();

  // Handle auto-login redirect or load Google SDK
  useEffect(() => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsNativeApp(isNative);

    const checkAuth = () => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('expired') === 'true') {
        setError('Your login session expired. Please log in again to continue.');
        setLoading(false);
        return;
      }

      const role = localStorage.getItem('role');
      const token = localStorage.getItem(`token_${role}`) || localStorage.getItem('token');
      
      if (role && token) {
        router.replace(role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
      } else {
        setLoading(false);
      }
    };

    checkAuth();
    router.prefetch('/user/dashboard');
    router.prefetch('/admin/dashboard');

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
                text: 'continue_with',
              });
            }
          } catch (e) {
            console.warn('Google GIS init error:', e);
          }
        } else {
          setIsAdblocked(true);
        }
      };

      // Probe for adblocker after 1.2s if Google SDK is missing
      const timer = setTimeout(() => {
        if (!(window as any).google) {
          setIsAdblocked(true);
        }
      }, 1200);

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
          setIsAdblocked(true);
        };
        document.body.appendChild(script);
      }

      return () => clearTimeout(timer);
    }
  }, [router]);

  const handleGoogleClick = () => {
    if (!(window as any).google?.accounts?.id) {
      setError('🛡️ Brave Shield / Adblocker Detected! Google Sign-In script was blocked by your browser. Please turn off Shields/Adblocker or log in using Email & Password.');
      setIsAdblocked(true);
    }
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    if (response?.credential) {
      await submitGoogleLogin(response.credential);
    }
  };

  const submitGoogleLogin = async (idToken: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/google', { idToken, action: 'login' });
      const userData = res.data;

      if (userData.status === 'pending') {
        setShowPopup({ message: userData.message, isError: false });
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem('token', userData.token);
      localStorage.setItem(`token_${userData.role}`, userData.token);
      localStorage.setItem('role', userData.role);
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.removeItem('driveflow_app_prompt_dismissed');

      if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowPopup({ message: err.response.data.message, isError: true });
      } else {
        setError(err.response?.data?.message || 'Google Sign-In failed.');
      }
      setIsSubmitting(false);
    }
  };

  const handleNativeGoogleLogin = async () => {
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
        await submitGoogleLogin(res.idToken);
      } else {
        setError('Failed to obtain Google login ID token.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Native Google Sign-In cancelled or failed.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const res = await api.post('/auth/login', { email, password });
      const userData = res.data;
      
      localStorage.setItem('token', userData.token);
      localStorage.setItem(`token_${userData.role}`, userData.token);
      localStorage.setItem('role', userData.role);
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.removeItem('driveflow_app_prompt_dismissed');

      if (userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowPopup({ message: err.response.data.message, isError: true, email: err.response.data.email || email });
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full min-w-full flex items-center justify-center p-4 bg-gradient-dynamic relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary)] rounded-full blur-[120px] opacity-30 pointer-events-none z-0 touch-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-secondary)] rounded-full blur-[120px] opacity-20 pointer-events-none z-0 touch-none" />

      {/* Card wrapper */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[400px]">

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="glass-card w-full p-7 sm:p-8 rounded-[1.75rem] shadow-2xl border border-white/10"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[var(--color-primary)] rounded-2xl mx-auto mb-3.5 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Lock className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">Sign in to access your files</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl mb-5 flex items-start gap-3 text-xs sm:text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 ml-0.5">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-black/25 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 ml-0.5">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="block w-full pl-10 pr-10 py-2.5 sm:py-3 bg-black/25 border border-white/10 rounded-xl text-white text-xs sm:text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-xs font-medium text-[var(--color-primary)] hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </motion.button>
        </form>

        <div className="relative flex py-1 items-center justify-center my-3">
          <div className="flex-grow border-t border-white/10"></div>
          <span className="flex-shrink mx-3 text-gray-500 text-xs">or</span>
          <div className="flex-grow border-t border-white/10"></div>
        </div>

        {isNativeApp ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleNativeGoogleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
            </svg>
            Continue with Google
          </motion.button>
        ) : (
          <div className="w-full flex flex-col items-center justify-center shrink-0 min-h-[62px]">
            <div 
              onClick={handleGoogleClick}
              className="relative w-full h-[44px] min-h-[44px] max-h-[44px] shrink-0 rounded-xl bg-white text-neutral-900 font-semibold text-xs sm:text-sm border border-neutral-300 shadow-sm overflow-hidden flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
              style={{ height: '44px', minHeight: '44px', maxHeight: '44px' }}
            >
              {/* Permanent static button - never erased during GIS load */}
              <div className="flex items-center justify-center gap-2.5 pointer-events-none z-0">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
                </svg>
                <span>Continue with Google</span>
              </div>
              {/* Google GIS container overlay */}
              <div 
                id="google-signin-btn" 
                onClick={handleGoogleClick}
                className="absolute inset-0 z-10 opacity-[0.001] flex items-center justify-center overflow-hidden cursor-pointer" 
              />
            </div>
            {isAdblocked ? (
              <div className="mt-2.5 w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] text-center flex items-center justify-center gap-2 leading-tight">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Brave Shield / Adblocker is blocking Google Login. Please disable it or use Email & Password.</span>
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 mt-2 text-center max-w-[300px]">
                If the Google login window does not open, please disable Brave Shield / Adblocker and refresh.
              </p>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs sm:text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-white font-semibold hover:text-[var(--color-primary)] transition-colors">
            Register here
          </Link>
        </p>
      </motion.div>

      </div> {/* end Card wrapper */}
      {/* Rejection / Pending Popup */}
      {showPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-[90vw] sm:max-w-md p-5 sm:p-8 rounded-3xl text-center"
          >
            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Notice</h3>
            <p className="text-gray-300 mb-6">{showPopup.message}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button 
                onClick={() => setShowPopup(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Close
              </button>
              {showPopup.message.toLowerCase().includes('verify') && showPopup.email && (
                <button
                  onClick={async () => {
                    try {
                      await api.post('/auth/resend-otp', { email: showPopup.email });
                      router.push(`/register?email=${encodeURIComponent(showPopup.email || '')}&verify=true`);
                    } catch (err: any) {
                      alert(err.response?.data?.message || 'Failed to resend OTP');
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--color-secondary)] text-white hover:bg-sky-600 transition-colors"
                >
                  Verify Email
                </button>
              )}
              <a 
                href={`mailto:rupambairagya08@gmail.com?subject=${showPopup.message.includes('rejected') ? 'Rejected Profile Inquiry' : 'Approval Request'}`}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-blue-600 transition-colors"
              >
                Contact Admin
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
