'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, Smartphone, Download } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import LoadingScreen from '@/components/LoadingScreen';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState<{ message: string; isError: boolean; email?: string } | null>(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const router = useRouter();

  // Handle auto-login redirect or bypass loading screen and load Google SDK
  useEffect(() => {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    setIsNativeApp(isNative);

    const checkAuth = () => {
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
      // Direct Adblocker / Brave Shield check
      const checkAdBlocker = async () => {
        try {
          await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
          });
        } catch (err) {
          setError('Adblocker or Brave Shield is active. Google Sign-In & Sign-Up may not work. Please disable it for this site and refresh.');
        }
      };
      checkAdBlocker();

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
              width: 384, // matches card width
              shape: 'pill',
              text: 'continue_with',
            });

            // Check if rendering was blocked silently by Adblocker/Brave Shield
            setTimeout(() => {
              if (container.children.length === 0) {
                setError('Google Sign-In was blocked. If you use Brave or an Adblocker, please disable shields/adblocker and refresh.');
              }
            }, 1500);
          }
        } else {
          setError('Google Sign-In was blocked. If you use Brave or an Adblocker, please disable shields/adblocker and refresh.');
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
        script.onerror = () => {
          setError('Google Sign-In was blocked. If you use Brave or an Adblocker, please disable shields/adblocker and refresh.');
        };
        document.body.appendChild(script);
      }
    }
  }, [router]);

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

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <div className="min-h-[100dvh] w-full min-w-full flex items-center justify-center p-4 bg-gradient-dynamic relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary)] rounded-full blur-[120px] opacity-30 pointer-events-none z-0 touch-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-secondary)] rounded-full blur-[120px] opacity-20 pointer-events-none z-0 touch-none" />

      {/* Card + Banner wrapper */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md gap-3">

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-card w-full p-8 rounded-[2rem]"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-16 h-16 bg-[var(--color-primary)] rounded-2xl mx-auto mb-4 flex items-center justify-center"
          >
            <Lock className="text-white w-8 h-8" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-[var(--color-muted)] mt-2">Sign in to access your files</p>
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

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                required
                className="block w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-sm text-[var(--color-primary)] hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </motion.button>
        </form>

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
            onClick={handleNativeGoogleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.13-5.136 4.13A5.72 5.72 0 0 1 8.24 12.8a5.72 5.72 0 0 1 5.751-5.73 5.56 5.56 0 0 1 3.96 1.6l3.055-3.055A9.97 9.97 0 0 0 13.99 2 9.99 9.99 0 0 0 4 12a9.99 9.99 0 0 0 9.99 10c5.38 0 9.8-3.97 9.8-10 0-.68-.06-1.3-.16-1.715H12.24Z" />
            </svg>
            Continue with Google
          </motion.button>
        ) : (
          <div className="w-full flex justify-center">
            <div id="google-signin-btn" className="w-full min-h-[44px]" />
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-white font-medium hover:text-[var(--color-primary)] transition-colors">
            Register here
          </Link>
        </p>
      </motion.div>

      {/* Android App Download Banner — only on web, hidden inside the app */}
      {!isNativeApp && (
        <motion.a
          href="https://neo-files-transfer.pages.dev/download/723586892fd0"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="relative w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
        >
          {/* Pulsing dot */}
          <span className="absolute top-3 right-3 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-300 font-semibold text-sm">Android App Available</p>
            <p className="text-emerald-500/80 text-xs mt-0.5">Please download this app for better experience</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 text-xs font-bold">Download</span>
          </div>
        </motion.a>
      )}

      </div> {/* end Card + Banner wrapper */}
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
