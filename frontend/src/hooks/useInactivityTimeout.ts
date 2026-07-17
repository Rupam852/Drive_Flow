import { useEffect } from 'react';

export function useInactivityTimeout(role: 'user' | 'admin', handleLogout: () => void) {
  useEffect(() => {
    // 1. Detect if running inside Capacitor Android app vs Web Browser
    const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor;
    if (isNative) return; // Skip auto-logout for native mobile app

    const timeoutLimit = 30 * 60 * 1000; // 30 minutes in ms
    const tokenKey = role === 'admin' ? 'token_admin' : 'token_user';

    const checkTimeout = () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return false;

      const lastActive = localStorage.getItem('lastActiveTime');
      if (lastActive) {
        const diff = Date.now() - parseInt(lastActive);
        if (diff > timeoutLimit) {
          localStorage.removeItem('lastActiveTime');
          handleLogout();
          return true;
        }
      } else {
        localStorage.setItem('lastActiveTime', Date.now().toString());
      }
      return false;
    };

    // Run check immediately on mount/load
    checkTimeout();

    const updateActivity = () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) return;

      const lastActive = localStorage.getItem('lastActiveTime');
      if (lastActive) {
        const diff = Date.now() - parseInt(lastActive);
        if (diff > timeoutLimit) {
          checkTimeout();
          return;
        }
      }
      localStorage.setItem('lastActiveTime', Date.now().toString());
    };

    const handleVisibilityOrFocus = () => {
      checkTimeout();
    };

    // Listen to user interactions
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
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
