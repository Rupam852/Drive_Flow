import { ActivityLog } from '../models/ActivityLog';

export const logActivity = async (userId: string, action: string, details: string) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      details,
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};
