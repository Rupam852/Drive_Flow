"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = void 0;
const ActivityLog_1 = require("../models/ActivityLog");
const logActivity = async (userId, action, details) => {
    try {
        await ActivityLog_1.ActivityLog.create({
            user: userId,
            action,
            details,
        });
    }
    catch (err) {
        console.error('Error logging activity:', err);
    }
};
exports.logActivity = logActivity;
//# sourceMappingURL=logger.js.map