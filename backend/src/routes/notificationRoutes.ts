import express from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  getAdminNotifications,
  createAdminNotification,
  deleteAdminNotification,
} from '../controllers/notificationController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// User endpoints
router.get('/', protect, getUserNotifications);
router.put('/read-all', protect, markAllNotificationsAsRead);
router.put('/:id/read', protect, markNotificationAsRead);
router.delete('/:id/dismiss', protect, dismissNotification);

// Admin endpoints
router.get('/admin', protect, admin, getAdminNotifications);
router.post('/admin', protect, admin, createAdminNotification);
router.delete('/admin/:id', protect, admin, deleteAdminNotification);

export default router;
