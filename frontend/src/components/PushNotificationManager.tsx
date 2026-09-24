'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import api from '@/lib/api';
import { emitNotificationSync } from '@/lib/notificationState';

export default function PushNotificationManager() {
  const router = useRouter();

  useEffect(() => {
    // Push notifications are ONLY initialized on native mobile platforms (Android/iOS)
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;

    const setupPushNotifications = async () => {
      try {
        // 1. Create High-Priority Notification Channel for Android
        try {
          await PushNotifications.createChannel({
            id: 'driveflow_announcements',
            name: 'DriveFlow Announcements',
            description: 'Receive important updates and announcements from DriveFlow',
            importance: 5, // High: Heads-up display with sound & vibration
            visibility: 1, // Public on lock screen
            sound: 'default',
            vibration: true,
            lights: true,
            lightColor: '#7c3aed',
          });
        } catch (channelErr) {
          console.warn('[Push] Channel creation skipped or unsupported:', channelErr);
        }

        // 2. Request User Permission
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('[Push] Notification permission not granted:', permStatus.receive);
          return;
        }

        // 3. Setup Listeners BEFORE calling register() to prevent race conditions
        await PushNotifications.addListener('registration', async (token: Token) => {
          if (!isMounted) return;
          console.log('[Push] FCM Registration Token received:', token.value?.substring(0, 15) + '...');

          try {
            const authToken = localStorage.getItem('token_user') || localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (authToken) {
              headers['Authorization'] = `Bearer ${authToken}`;
            }

            // Save device token to backend
            await api.post('/notifications/device-token', {
              token: token.value,
              platform: Capacitor.getPlatform(),
            }, { headers });

            localStorage.setItem('driveflow_fcm_token', token.value);
            console.log('[Push] Device token successfully registered with backend.');
          } catch (err: any) {
            console.warn('[Push] Failed to send device token to backend:', err?.message || err);
          }
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('[Push] FCM Registration Error:', error);
        });

        await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('[Push] Notification received in foreground:', notification);
            // Instantly sync in-app bell and badges
            emitNotificationSync({ type: 'refetch' });
          }
        );

        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            console.log('[Push] Notification tapped/actionPerformed:', action);
            const data = action.notification.data;
            const targetUrl = data?.url || '/user/notifications';

            try {
              router.push(targetUrl);
            } catch {
              window.location.href = targetUrl;
            }
          }
        );

        // 4. Register with Google FCM (fires the 'registration' listener above)
        await PushNotifications.register();
      } catch (err: any) {
        console.warn('[Push] Push notification setup error:', err?.message || err);
      }
    };

    setupPushNotifications();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners().catch(() => {});
      }
    };
  }, [router]);

  return null;
}
