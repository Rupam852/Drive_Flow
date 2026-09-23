import { ActivityLog } from '../models/ActivityLog';

export const MAX_ACTIVITY_LOGS = 100;

/**
 * Trims oldest activity logs if total count exceeds MAX_ACTIVITY_LOGS (100).
 * Keeps database lean and prevents log accumulation beyond 100 history entries.
 */
export const trimExcessLogs = async () => {
  try {
    const count = await ActivityLog.countDocuments();
    if (count > MAX_ACTIVITY_LOGS) {
      const excess = count - MAX_ACTIVITY_LOGS;
      const oldestLogs = await ActivityLog.find()
        .sort({ timestamp: 1 })
        .limit(excess)
        .select('_id');

      if (oldestLogs.length > 0) {
        const idsToDelete = oldestLogs.map(l => l._id);
        await ActivityLog.deleteMany({ _id: { $in: idsToDelete } });
      }
    }
  } catch (err) {
    console.error('Error trimming excess activity logs:', err);
  }
};

/**
 * Records an activity log and automatically cleans up older logs
 * keeping only the latest MAX_ACTIVITY_LOGS (100).
 */
export const logActivity = async (userId: string, action: string, details: string) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      details,
    });

    // Auto-cleanup oldest logs beyond 100
    await trimExcessLogs();
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};
