import { useEffect } from 'react';

export function useInactivityTimeout(
  role: 'user' | 'admin',
  handleLogout: (isExpired?: boolean) => void
) {
  useEffect(() => {
    // 1. Detect if running inside Capacitor Android app vs Web Browser
    const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor;
    if (isNative) return; // Skip auto-logout for native mobile app

    // User: 30 minutes, Admin: 1 hour (60 minutes)
    const timeoutLimit = role === 'admin' ? 60 * 60 * 1000 : 30 * 60 * 1000;
    const tokenKey = role === 'admin' ? 'token_admin' : 'token_user';
    const lastActiveKey = `lastActiveTime_${role}`;

    const checkTimeout = () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return false;

      const lastActive = localStorage.getItem(lastActiveKey);
      if (lastActive) {
        const diff = Date.now() - parseInt(lastActive, 10);
        if (diff > timeoutLimit) {
          localStorage.removeItem(lastActiveKey);
          handleLogout(true);
          return true;
        }
      } else {
        localStorage.setItem(lastActiveKey, Date.now().toString());
      }
      return false;
    };

    // Run check immediately on mount/load
    checkTimeout();

    const updateActivity = () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return;

      const lastActive = localStorage.getItem(lastActiveKey);
      if (lastActive) {
        const diff = Date.now() - parseInt(lastActive, 10);
        if (diff > timeoutLimit) {
          checkTimeout();
          return;
        }
      }
      localStorage.setItem(lastActiveKey, Date.now().toString());
    };

    const handleVisibilityOrFocus = () => {
      checkTimeout();
    };

    // Listen to user interactions with passive event listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Periodically check inactivity (every 10 seconds)
    const interval = setInterval(checkTimeout, 10000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [role, handleLogout]);
}
