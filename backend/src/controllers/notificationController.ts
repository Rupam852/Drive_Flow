import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { DeviceToken } from '../models/DeviceToken';
import { logActivity } from '../utils/logger';
import { sendCustomEmail, buildDriveFlowEmailHtml, cleanEmailSubject } from '../utils/mailer';
import { sendPushNotification, getFirebaseStatus } from '../utils/firebase';

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
      .populate('readBy', 'name email profilePic role')
      .populate('targetUsers', 'name email profilePic role')
      .sort({ createdAt: -1 })
      .limit(100);

    const formatted = notifications.map(n => {
      const readUsers = ((n.readBy as any[]) || []).filter(Boolean);
      const readCount = readUsers.length;
      const targetUsersList = ((n.targetUsers as any[]) || []).filter(Boolean);
      const targetCount = n.type === 'broadcast' 
        ? totalVerifiedUsers 
        : targetUsersList.length;

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
        readUsers: readUsers.map((u: any) => ({
          _id: u._id?.toString() || u.toString(),
          name: u.name || 'User',
          email: u.email || '',
          profilePic: u.profilePic,
          role: u.role || 'user',
        })),
        targetUsers: targetUsersList.map((u: any) => ({
          _id: u._id?.toString() || u.toString(),
          name: u.name || 'User',
          email: u.email || '',
          profilePic: u.profilePic,
          role: u.role || 'user',
        })),
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
            const users = await User.find({
              $or: [{ isEmailVerified: true }, { status: 'approved' }]
            }).select('email name');
            recipients = users
              .filter(u => u.email && u.email.includes('@'))
              .map(u => ({ email: u.email, name: u.name }));
          } else if (Array.isArray(targetUsers) && targetUsers.length > 0) {
            const users = await User.find({ _id: { $in: targetUsers } }).select('email name');
            recipients = users
              .filter(u => u.email && u.email.includes('@'))
              .map(u => ({ email: u.email, name: u.name }));
          }

          const cleanSubject = cleanEmailSubject(title.trim());
          const cleanBody = message.trim().replace(/\n/g, '<br/>');
          const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';

          let buttonUrl: string | undefined = undefined;
          let buttonText: string | undefined = undefined;

          if (link && typeof link === 'string' && link.trim().startsWith('http')) {
            const isDirectBinary = link.toLowerCase().includes('.apk') || link.toLowerCase().includes('pages.dev');
            if (isDirectBinary) {
              buttonUrl = `${frontendUrl}/user/notifications`;
              buttonText = 'Open App to Update';
            } else {
              buttonUrl = link.trim();
              buttonText = 'View Details';
            }
          }

          const CHUNK_SIZE = 5;
          for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
            const chunk = recipients.slice(i, i + CHUNK_SIZE);
            await Promise.all(
              chunk.map(async (r) => {
                try {
                  const html = buildDriveFlowEmailHtml({
                    title: cleanSubject.replace(/^DriveFlow:\s*/i, ''),
                    userName: r.name || 'User',
                    messageHtml: `<div style="font-size: 14px; line-height: 22px; color: #334155;">${cleanBody}</div>`,
                    buttonText,
                    buttonUrl,
                    noticeText: 'This automated notification was sent to your registered DriveFlow account.',
                  });
                  await sendCustomEmail(r.email, cleanSubject, html);
                } catch (mailErr) {
                  console.warn(`Failed sending email to ${r.email}:`, mailErr);
                }
              })
            );
          }
        } catch (e) {
          console.error('Error during email broadcast alongside in-app notification:', e);
        }
      })();
    }

    // Send Real-Time Android Push Notification to System Status Bar
    let pushResult: any = null;
    try {
      pushResult = await sendPushNotification({
        title: title.trim(),
        body: message.trim(),
        targetUserIds: type === 'selected' || type === 'single' ? targetUsers : undefined,
        data: {
          notificationId: newNotification._id.toString(),
          url: `/user/notifications?id=${newNotification._id.toString()}`,
        },
      });
      console.log('[Admin Notification Push Result]:', pushResult);
    } catch (err: any) {
      console.error('[Firebase Push Notification Error]:', err);
      pushResult = { success: false, error: err?.message };
    }

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
      pushResult,
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

import jwt from 'jsonwebtoken';

// @desc    Register or update an FCM push device token
// @route   POST /api/notifications/device-token
// @access  Public / Optional Auth
export const registerDeviceToken = async (req: Request, res: Response) => {
  try {
    const { token, platform = 'android' } = req.body || {};
    let userId = (req as any).user?._id;

    // Optional auth token resolution from header
    if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const rawToken = req.headers.authorization.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'fallback-secret';
        const decoded: any = jwt.verify(rawToken, secret);
        if (decoded && decoded.id) {
          userId = decoded.id;
        }
      } catch {
        // Ignore invalid token, still register device token
      }
    }

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

    console.log(`[Push] Device token registered: ${cleanToken.substring(0, 15)}... (User: ${userId || 'anonymous'})`);
    res.json({ success: true, message: 'Device token registered successfully.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Check Firebase push notification readiness & registered devices count
// @route   GET /api/notifications/push-status
// @access  Public
export const getPushStatus = async (_req: Request, res: Response) => {
  try {
    const status = getFirebaseStatus();
    const tokenCount = await DeviceToken.countDocuments();
    res.json({
      firebaseInitialized: status.isInitialized,
      registeredDevicesCount: tokenCount,
      hasEnvKey: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message });
  }
};
