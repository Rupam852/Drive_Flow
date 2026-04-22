'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';

/**
 * useAndroidBack - Handles Android hardware/gesture back button in Capacitor.
 * Pass a handler function that returns true if the back was handled (stops propagation),
 * or false to let the default behavior proceed.
 */
export function useAndroidBack(handler: () => boolean, deps: React.DependencyList = []) {
  useEffect(() => {
    let listenerPromise: ReturnType<typeof App.addListener> | null = null;

    // Only register on native Capacitor (Android/iOS)
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      listenerPromise = App.addListener('backButton', (info) => {
        const handled = handler();
        if (!handled && info.canGoBack) {
          window.history.back();
        } else if (!handled && !info.canGoBack) {
          // On root — exit app
          App.exitApp();
        }
      });
    }

    return () => {
      if (listenerPromise) {
        listenerPromise.then((l) => l.remove()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
