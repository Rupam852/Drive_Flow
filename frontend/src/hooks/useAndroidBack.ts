'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';

type BackHandler = () => boolean;

interface HandlerEntry {
  handler: BackHandler;
  priority: number;
}

const backHandlers: HandlerEntry[] = [];
let listenerRegistered = false;

/**
 * useAndroidBack - Handles Android hardware/gesture back button in Capacitor.
 * @param handler Function that returns true if handled (stops propagation)
 * @param priority Higher priority runs first (e.g. modals=10, page nav=5, layout=0)
 * @param deps Dependency array for the effect
 */
export function useAndroidBack(handler: BackHandler, priority: number = 0, deps: React.DependencyList = []) {
  useEffect(() => {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      if (!listenerRegistered) {
        App.addListener('backButton', (info) => {
          let handled = false;
          
          // Sort handlers by priority descending (highest first)
          const sortedHandlers = [...backHandlers].sort((a, b) => b.priority - a.priority);
          
          for (const entry of sortedHandlers) {
            if (entry.handler()) {
              handled = true;
              break;
            }
          }
          
          if (!handled && info.canGoBack) {
            window.history.back();
          } else if (!handled && !info.canGoBack) {
            App.exitApp();
          }
        });
        listenerRegistered = true;
      }

      const entry = { handler, priority };
      backHandlers.push(entry);

      return () => {
        const index = backHandlers.indexOf(entry);
        if (index > -1) {
          backHandlers.splice(index, 1);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
