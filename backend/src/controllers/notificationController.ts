import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { DeviceToken } from '../models/DeviceToken';
import { logActivity } from '../utils/logger';
import { sendCustomEmail } from '../utils/mailer';
import { sendPushNotification } from '../utils/firebase';

// @desc    Get in-app notifications for the logged-in user
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const notifications = await Notification.find({
      $and: [
        {
          $or: [
            { type: 'broadcast' },
            { targetUsers: userId }
          ]
        },
        { dismissedBy: { $ne: userId } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = notifications.map(n => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      createdAt: n.createdAt,
      isRead: n.readBy.some(id => id.toString() === userId.toString()),
    }));

    const unreadCount = formatted.filter(n => !n.isRead).length;

    res.json({
      notifications: formatted,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Mark a specific notification as read by the user
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    await Notification.findByIdAndUpdate(id, {
      $addToSet: { readBy: userId }
    });

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;

    await Notification.updateMany(
      {
        $and: [
          {
            $or: [
              { type: 'broadcast' },
              { targetUsers: userId }
            ]
          },
          { dismissedBy: { $ne: userId } }
        ]
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Dismiss (delete) a notification for current user
// @route   DELETE /api/notifications/:id/dismiss
// @access  Private
export const dismissNotification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    await Notification.findByIdAndUpdate(id, {
      $addToSet: { dismissedBy: userId }
    });

    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Get all notifications with read statistics (Admin only)
// @route   GET /api/notifications/admin
// @access  Private/Admin
export const getAdminNotifications = async (req: Request, res: Response) => {
  try {
    const totalVerifiedUsers = await User.countDocuments({ isEmailVerified: true, role: 'user' });

    const notifications = await Notification.find()
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    const formatted = notifications.map(n => {
      const readCount = n.readBy?.length || 0;
      const targetCount = n.type === 'broadcast' 
        ? totalVerifiedUsers 
        : (n.targetUsers?.length || 0);

      const seenPercentage = targetCount > 0 
        ? Math.min(100, Math.round((readCount / targetCount) * 100))
        : 0;

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        link: n.link,
        createdAt: n.createdAt,
        expiresAt: n.expiresAt,
        readCount,
        targetCount,
        seenPercentage,
        senderName: (n.sender as any)?.name || 'Admin',
      };
    });

    res.json({
      notifications: formatted,
      totalUsers: totalVerifiedUsers,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Create and dispatch in-app notification (Admin only)
// @route   POST /api/notifications/admin
// @access  Private/Admin
export const createAdminNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, type = 'broadcast', targetUsers = [], link, sendEmail = false } = req.body;
    const adminId = (req as any).user?._id;

    if (!title || !title.trim() || !message || !message.trim()) {
      res.status(400).json({ message: 'Title and message are required.' });
      return;
    }

    const newNotification = await Notification.create({
      title: title.trim(),
      message: message.trim(),
      type,
      targetUsers: type === 'broadcast' ? [] : targetUsers,
      sender: adminId,
      link: link ? link.trim() : undefined,
    });

    // Optional: send simultaneous email broadcast if requested
    if (sendEmail) {
      (async () => {
        try {
          let recipients: Array<{ email: string; name?: string }> = [];
          if (type === 'broadcast') {
            const users = await User.find({ isEmailVerified: true }).select('email name');
            recipients = users.map(u => ({ email: u.email, name: u.name }));
          } else if (Array.isArray(targetUsers) && targetUsers.length > 0) {
            const users = await User.find({ _id: { $in: targetUsers }, isEmailVerified: true }).select('email name');
            recipients = users.map(u => ({ email: u.email, name: u.name }));
          }

          const cleanSubject = title.trim();
          const cleanBody = message.trim().replace(/\n/g, '<br/>');

          for (const r of recipients) {
            try {
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                  <h2 style="color: #6366f1; text-align: center;">${cleanSubject}</h2>
                  <p>Hello ${r.name || 'User'},</p>
                  <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0;">
                    ${cleanBody}
                  </div>
                  ${link ? `<p><a href="${link}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">Open Link</a></p>` : ''}
                  <p style="font-size: 12px; color: #94a3b8; text-align: center;">DriveFlow Notifications</p>
                </div>
              `;
              await sendCustomEmail(r.email, cleanSubject, html);
            } catch (mailErr) {
              console.warn(`Failed sending email to ${r.email}:`, mailErr);
            }
          }
        } catch (e) {
          console.error('Error during email broadcast alongside in-app notification:', e);
        }
      })();
    }

    // Send Real-Time Android Push Notification to System Status Bar
    sendPushNotification({
      title: title.trim(),
      body: message.trim(),
      targetUserIds: type === 'selected' || type === 'single' ? targetUsers : undefined,
      data: {
        notificationId: newNotification._id.toString(),
        url: '/user/notifications',
      },
    }).catch(err => {
      console.error('[Firebase Push Notification Error]:', err);
    });

    try {
      await logActivity(
        adminId,
        'admin_notification_created',
        `Created in-app notification "${title.trim()}" (${type})`
      );
    } catch (logErr) {
      console.warn('Activity logging error:', logErr);
    }

    res.status(201).json({
      success: true,
      notification: newNotification,
      message: 'In-app notification published successfully.',
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Recall and completely delete a notification (Admin only)
// @route   DELETE /api/notifications/admin/:id
// @access  Private/Admin
export const deleteAdminNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?._id;

    const deleted = await Notification.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    try {
      await logActivity(
        adminId,
        'admin_notification_deleted',
        `Deleted/recalled in-app notification "${deleted.title}"`
      );
    } catch (logErr) {
      console.warn('Activity logging error:', logErr);
    }

    res.json({
      success: true,
      message: 'Notification recalled and deleted from all users successfully.',
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Register or update an FCM push device token
// @route   POST /api/notifications/device-token
// @access  Public / Optional Auth
export const registerDeviceToken = async (req: Request, res: Response) => {
  try {
    const { token, platform = 'android' } = req.body;
    const userId = (req as any).user?._id;

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      res.status(400).json({ message: 'Valid device token is required.' });
      return;
    }

    const cleanToken = token.trim();

    await DeviceToken.findOneAndUpdate(
      { token: cleanToken },
      {
        token: cleanToken,
        platform,
        ...(userId ? { userId } : {}),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Device token registered successfully.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
