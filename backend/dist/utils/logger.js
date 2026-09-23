"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = exports.trimExcessLogs = exports.MAX_ACTIVITY_LOGS = void 0;
const ActivityLog_1 = require("../models/ActivityLog");
exports.MAX_ACTIVITY_LOGS = 100;
/**
 * Trims oldest activity logs if total count exceeds MAX_ACTIVITY_LOGS (100).
 * Keeps database lean and prevents log accumulation beyond 100 history entries.
 */
const trimExcessLogs = async () => {
    try {
        const count = await ActivityLog_1.ActivityLog.countDocuments();
        if (count > exports.MAX_ACTIVITY_LOGS) {
            const excess = count - exports.MAX_ACTIVITY_LOGS;
            const oldestLogs = await ActivityLog_1.ActivityLog.find()
                .sort({ timestamp: 1 })
                .limit(excess)
                .select('_id');
            if (oldestLogs.length > 0) {
                const idsToDelete = oldestLogs.map(l => l._id);
                await ActivityLog_1.ActivityLog.deleteMany({ _id: { $in: idsToDelete } });
            }
        }
    }
    catch (err) {
        console.error('Error trimming excess activity logs:', err);
    }
};
exports.trimExcessLogs = trimExcessLogs;
/**
 * Records an activity log and automatically cleans up older logs
 * keeping only the latest MAX_ACTIVITY_LOGS (100).
 */
const logActivity = async (userId, action, details) => {
    try {
        await ActivityLog_1.ActivityLog.create({
            user: userId,
            action,
            details,
        });
        // Auto-cleanup oldest logs beyond 100
        await (0, exports.trimExcessLogs)();
    }
    catch (err) {
        console.error('Error logging activity:', err);
    }
};
exports.logActivity = logActivity;
//# sourceMappingURL=logger.js.map