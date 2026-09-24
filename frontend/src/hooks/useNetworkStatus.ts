'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { notifyNetworkReconnected } from '@/lib/api';

interface NetworkHelperPlugin {
  getNetworkStatus(): Promise<{ connected: boolean; validated?: boolean; connectionType: string }>;
  openNetworkSettings(): Promise<void>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: { connected: boolean; validated?: boolean; connectionType?: string }) => void
  ): Promise<any>;
}

const NetworkHelper = registerPlugin<NetworkHelperPlugin>('NetworkHelper');

export function isNativeAndroidPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  return isNative && platform === 'android';
}

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isNativeAndroid, setIsNativeAndroid] = useState<boolean>(false);
  const isCheckingRef = useRef(false);
  const isOfflineRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  // Ping verification: verifies real internet access (handles captive portals / dead Wi-Fi)
  const probeRealInternet = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Standard lightweight Android captive portal check endpoint
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return true;
    } catch {
      // Secondary fallback ping to our API endpoint
      try {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 3000);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://driveflow-worker.rupambairagya08.workers.dev/api';
        
        await fetch(`${apiUrl}/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: fallbackController.signal,
        });

        clearTimeout(fallbackTimeout);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) return !isOfflineRef.current;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      const isAndroid = isNativeAndroidPlatform();
      setIsNativeAndroid(isAndroid);

      // If not running in native Android app, we do not enforce offline blocker
      if (!isAndroid) {
        if (isOfflineRef.current) {
          notifyNetworkReconnected();
        }
        setIsOffline(false);
        return true;
      }

      // Check standard navigator status first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
        setConnectionType('none');
        return false;
      }

      // Query native Android ConnectivityManager
      try {
        const nativeStatus = await NetworkHelper.getNetworkStatus();
        setConnectionType(nativeStatus.connectionType || 'unknown');

        if (!nativeStatus.connected) {
          setIsOffline(true);
          return false;
        }

        // If native OS already validated internet, we are definitely online
        if (nativeStatus.validated) {
          if (isOfflineRef.current) {
            notifyNetworkReconnected();
          }
          setIsOffline(false);
          return true;
        }
      } catch (err) {
        console.warn('Native network status query failed:', err);
      }

      // Active probe verification
      const hasRealInternet = await probeRealInternet();
      if (hasRealInternet) {
        if (isOfflineRef.current) {
          notifyNetworkReconnected();
        }
        setIsOffline(false);
      } else {
        setIsOffline(true);
      }
      return hasRealInternet;
    } catch (e) {
      console.warn('Network check error:', e);
      return false;
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, [probeRealInternet]);

  const openSettings = useCallback(async () => {
    try {
      if (isNativeAndroidPlatform()) {
        await NetworkHelper.openNetworkSettings();
      } else {
        console.log('openNetworkSettings is only available on native Android.');
      }
    } catch (err) {
      console.error('Failed to open network settings:', err);
    }
  }, []);

  useEffect(() => {
    const isAndroid = isNativeAndroidPlatform();
    setIsNativeAndroid(isAndroid);

    if (!isAndroid) return;

    // 1. Initial check on mount
    checkConnection();

    // 2. Browser online/offline event listeners
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setConnectionType('none');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Native Network Callback listener from Android ConnectivityManager
    let nativeListenerHandle: any = null;
    try {
      NetworkHelper.addListener('networkStatusChange', (status) => {
        if (!status.connected) {
          setIsOffline(true);
          setConnectionType(status.connectionType || 'none');
        } else {
          // If internet has returned, immediately re-verify and trigger auto-retry
          checkConnection();
        }
      }).then((handle) => {
        nativeListenerHandle = handle;
      }).catch((e) => {
        console.warn('Failed to attach NetworkHelper listener:', e);
      });
    } catch (e) {
      console.warn('NetworkHelper listener setup error:', e);
    }

    // 4. Handle Phone Screen Lock / Unlock & App Resume
    // When phone times out / locks and user opens/unlocks again, re-evaluate network immediately
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    const handleFocus = () => {
      checkConnection();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    let appStateHandle: any = null;
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkConnection();
        }
      }).then((handle) => {
        appStateHandle = handle;
      }).catch(() => {});
    } catch {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (nativeListenerHandle?.remove) {
        nativeListenerHandle.remove();
      }
      if (appStateHandle?.remove) {
        appStateHandle.remove();
      }
    };
  }, [checkConnection]);

  // Periodic heartbeat re-check when offline to auto-dismiss modal and resume requests as soon as internet is back
  useEffect(() => {
    if (!isOffline || !isNativeAndroid) return;

    const intervalId = setInterval(() => {
      checkConnection();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isOffline, isNativeAndroid, checkConnection]);

  return {
    isOffline,
    isChecking,
    connectionType,
    isNativeAndroid,
    checkConnection,
    openSettings,
  };
}
