export declare const MAX_ACTIVITY_LOGS = 100;
/**
 * Trims oldest activity logs if total count exceeds MAX_ACTIVITY_LOGS (100).
 * Keeps database lean and prevents log accumulation beyond 100 history entries.
 */
export declare const trimExcessLogs: () => Promise<void>;
/**
 * Records an activity log and automatically cleans up older logs
 * keeping only the latest MAX_ACTIVITY_LOGS (100).
 */
export declare const logActivity: (userId: string, action: string, details: string) => Promise<void>;
