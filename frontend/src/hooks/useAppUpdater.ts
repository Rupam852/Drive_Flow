'use client';

import { useState, useEffect, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';

interface AppUpdateNotificationPlugin {
  requestNotificationPermission(): Promise<{ granted: boolean; requested: boolean }>;
  showUpdateNotification(options: { version: string; title?: string; body?: string; downloadUrl: string }): Promise<{ success: boolean }>;
}

const AppUpdateNotification = registerPlugin<AppUpdateNotificationPlugin>('AppUpdateNotification');

export const CURRENT_APP_VERSION = 'v1.0.3';
export const API_VERSION_URL = 'https://neo-files-transfer-p3ot.onrender.com/api/version/apk_f13b660ad8d24108';
export const DEFAULT_DOWNLOAD_URL = 'https://neo-files-transfer.pages.dev/download/723586892fd0';

export const isNewerVersion = (serverVer: string, currentVer: string): boolean => {
  if (!serverVer || !currentVer) return false;
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const sParts = clean(serverVer).split('.').map(Number);
  const cParts = clean(currentVer).split('.').map(Number);
  for (let i = 0; i < Math.max(sParts.length, cParts.length); i++) {
    const s = sParts[i] || 0;
    const c = cParts[i] || 0;
    if (s > c) return true;
    if (s < c) return false;
  }
  return false;
};

export function useAppUpdater() {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [latestVersion, setLatestVersion] = useState<string>(CURRENT_APP_VERSION);
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_DOWNLOAD_URL);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('auto_check_update') !== 'false'; // Default ON
  });

  const checkForUpdates = useCallback(async (manual: boolean = false) => {
    try {
      setIsChecking(true);
      if (manual) setStatusMessage('Checking for updates...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(API_VERSION_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const serverVer = data.version || data.latest_version || CURRENT_APP_VERSION;
      const targetUrl = data.web_url || data.download_url || DEFAULT_DOWNLOAD_URL;

      setLatestVersion(serverVer);
      setDownloadUrl(targetUrl);

      const newer = isNewerVersion(serverVer, CURRENT_APP_VERSION);
      setHasUpdate(newer);

      if (newer) {
        setStatusMessage(`New update ${serverVer} is available!`);
        if (Capacitor.isNativePlatform()) {
          try {
            await AppUpdateNotification.showUpdateNotification({
              version: serverVer,
              title: `New Update Available: ${serverVer}`,
              body: `DriveFlow ${serverVer} is available! Tap to download and install.`,
              downloadUrl: targetUrl,
            });
          } catch (e) {
            console.warn('Native notification failed:', e);
          }
        }
      } else {
        setStatusMessage('Your app is up to date.');
      }
    } catch (err) {
      console.warn('App update check failed:', err);
      if (manual) {
        setStatusMessage('Unable to check for updates. Please try again.');
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  const toggleAutoCheck = useCallback((enabled: boolean) => {
    setAutoCheckEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto_check_update', enabled ? 'true' : 'false');
    }
  }, []);

  // Request notification permission on app mount for Android 13+ & existing users
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AppUpdateNotification.requestNotificationPermission().catch(() => {});
    }
  }, []);

  // Automatic check on app launch if enabled (default ON) - ONLY on native Android app
  useEffect(() => {
    if (Capacitor.isNativePlatform() && autoCheckEnabled) {
      checkForUpdates(false);
    }
  }, [autoCheckEnabled, checkForUpdates]);

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    hasUpdate,
    downloadUrl,
    isChecking,
    statusMessage,
    autoCheckEnabled,
    checkForUpdates,
    toggleAutoCheck,
  };
}
