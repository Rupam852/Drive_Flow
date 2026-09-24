import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import { DeviceToken } from '../models/DeviceToken';

let isFirebaseInitialized = false;

function initFirebase() {
  if (isFirebaseInitialized || getApps().length > 0) {
    isFirebaseInitialized = true;
    return;
  }

  try {
    // 1. Check if FIREBASE_SERVICE_ACCOUNT is provided via environment variable (JSON string or base64)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (!raw.startsWith('{')) {
        try {
          raw = Buffer.from(raw, 'base64').toString('utf8');
        } catch {
          // fallback to raw
        }
      }
      const serviceAccount = JSON.parse(raw);
      initializeApp({
        credential: cert(serviceAccount),
      });
      isFirebaseInitialized = true;
      console.log('[Firebase] Initialized via environment variable');
      return;
    }

    // 2. Look for any firebase service account file in backend root
    const backendDir = path.resolve(__dirname, '../../');
    const files = fs.readdirSync(backendDir);
    const serviceAccountFile = files.find(
      (f) => f.includes('firebase-adminsdk') || f.includes('firebase-service-account')
    );

    if (serviceAccountFile) {
      const fullPath = path.join(backendDir, serviceAccountFile);
      const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      isFirebaseInitialized = true;
      console.log(`[Firebase] Initialized via local key file: ${serviceAccountFile}`);
      return;
    }

    console.warn('[Firebase] No service account key found. Push notifications will be skipped.');
  } catch (err: any) {
    console.error('[Firebase] Failed to initialize Firebase Admin:', err?.message || err);
  }
}

// Auto initialize on import
initFirebase();

export function getFirebaseStatus() {
  return {
    isInitialized: isFirebaseInitialized,
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  tokens?: string[];
  targetUserIds?: string[];
}

/**
 * Send push notification to target devices or all devices
 */
export async function sendPushNotification(payload: PushNotificationPayload) {
  initFirebase();
  if (!isFirebaseInitialized) {
    console.warn('[Firebase] Skipping push: Firebase not initialized (missing service account credentials on server)');
    return { success: false, sentCount: 0, reason: 'firebase_not_initialized' };
  }

  try {
    let targetTokens: string[] = [];

    if (payload.tokens && payload.tokens.length > 0) {
      targetTokens = payload.tokens;
    } else if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      // Find tokens for specific users
      const records = await DeviceToken.find({ userId: { $in: payload.targetUserIds } });
      targetTokens = records.map((r) => r.token);
    } else {
      // Broadcast to all registered devices
      const records = await DeviceToken.find();
      targetTokens = records.map((r) => r.token);
    }

    // Remove duplicates and empty tokens
    targetTokens = Array.from(new Set(targetTokens.filter((t) => !!t && t.length > 10)));

    if (targetTokens.length === 0) {
      console.log('[Firebase] No registered device tokens found to send push notification.');
      return { success: true, sentCount: 0, reason: 'no_tokens_found' };
    }

    const message: MulticastMessage = {
      tokens: targetTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: '/user/notifications',
        ...(payload.data || {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'driveflow_announcements',
          priority: 'high',
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[Firebase] Push notification sent: ${response.successCount} successful, ${response.failureCount} failed.`);

    // Clean up stale or unregistered tokens
    if (response.failureCount > 0) {
      const badTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            badTokens.push(targetTokens[idx]);
          }
        }
      });

      if (badTokens.length > 0) {
        await DeviceToken.deleteMany({ token: { $in: badTokens } });
        console.log(`[Firebase] Cleaned up ${badTokens.length} expired device tokens.`);
      }
    }

    return {
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err: any) {
    console.error('[Firebase] Error sending multicast push notification:', err?.message || err);
    return { success: false, error: err?.message };
  }
}
