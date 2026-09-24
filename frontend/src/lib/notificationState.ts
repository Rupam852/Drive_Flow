// Centralized event bus for real-time notification synchronization across components
export const NOTIFICATION_SYNC_EVENT = 'driveflow_notification_sync';

export interface NotificationSyncPayload {
  type: 'set_count' | 'clear' | 'decrement' | 'refetch';
  unreadCount?: number;
  delta?: number;
}

export function emitNotificationSync(payload: NotificationSyncPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_SYNC_EVENT, { detail: payload }));
  }
}
