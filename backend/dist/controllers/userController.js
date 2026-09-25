"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = exports.deleteUser = exports.pendingUser = exports.rejectUser = exports.approveUser = exports.getUsers = void 0;
const User_1 = require("../models/User");
const mailer_1 = require("../utils/mailer");
const logger_1 = require("../utils/logger");
// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User_1.User.find({ isEmailVerified: true }).select('-passwordHash');
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getUsers = getUsers;
// @desc    Approve user
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
const approveUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'approved';
            const updatedUser = await user.save();
            // Dispatch welcome activation email asynchronously
            (async () => {
                try {
                    const approvedHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
              <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">Account Approved &amp; Activated</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Great news! Our admin has reviewed and approved your DriveFlow account registration. Your digital workspace is now fully activated and ready for use.</p>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="font-size: 15px; color: #065f46; margin: 0; font-weight: bold;">Status: Approved &amp; Active</p>
                <p style="font-size: 14px; color: #047857; margin: 5px 0 0 0;">You can now log in using your registered email and secure password.</p>
              </div>
              <p style="font-size: 15px; color: #333; line-height: 1.6;">Start uploading, storing, and organizing your files securely with complete high-speed encryption.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.25); display: inline-block;">Log In to Your Workspace</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
              <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Team</p>
            </div>
          `;
                    await (0, mailer_1.sendCustomEmail)(user.email, 'DriveFlow: Your account has been approved', approvedHtml);
                }
                catch (err) {
                    console.error(`Failed to send approval welcome email to ${user.email}:`, err);
                }
            })();
            res.json({ message: 'User approved successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.approveUser = approveUser;
// @desc    Reject user
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
const rejectUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'rejected';
            const updatedUser = await user.save();
            // Dispatch rejection notice email asynchronously
            (async () => {
                try {
                    const rejectedHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
              <h2 style="color: #ef4444; text-align: center; margin-bottom: 20px;">Notice: Account Registration Declined</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for registering with <strong>DriveFlow</strong>. After careful review, our administrative team has declined your registration request at this time.</p>
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="font-size: 15px; color: #991b1b; margin: 0; font-weight: bold;">Status: Registration Rejected</p>
                <p style="font-size: 14px; color: #b91c1c; margin: 5px 0 0 0;">If you believe this is a misunderstanding, please contact our administrator support to resolve the issue.</p>
              </div>
              <div style="text-align: center; margin: 25px 0;">
                <a href="mailto:rupambairagya08@gmail.com?subject=Rejection%20Inquiry" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 8px; display: inline-block;">Contact Administrator Support</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
              <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Team</p>
            </div>
          `;
                    await (0, mailer_1.sendCustomEmail)(user.email, 'DriveFlow: Update regarding your account registration', rejectedHtml);
                }
                catch (err) {
                    console.error(`Failed to send rejection email to ${user.email}:`, err);
                }
            })();
            res.json({ message: 'User rejected successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.rejectUser = rejectUser;
// @desc    Set user as pending
// @route   PUT /api/users/:id/pending
// @access  Private/Admin
const pendingUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            user.status = 'pending';
            const updatedUser = await user.save();
            res.json({ message: 'User moved to pending successfully', user: updatedUser });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.pendingUser = pendingUser;
// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id);
        if (user) {
            // Prevent deleting self (admin)
            if (user.role === 'admin') {
                res.status(400).json({ message: 'Cannot delete admin user' });
                return;
            }
            await User_1.User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User deleted successfully' });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteUser = deleteUser;
// @desc    Send email notification to single user, selected users, or broadcast to all (Admin only)
// @route   POST /api/users/notify
// @access  Private/Admin
const sendNotification = async (req, res) => {
    try {
        const { recipientType, userId, userIds, subject, message, link } = req.body;
        if (!subject || !subject.trim() || !message || !message.trim()) {
            res.status(400).json({ message: 'Subject and message body are required.' });
            return;
        }
        let recipients = [];
        if (recipientType === 'all') {
            const users = await User_1.User.find({ isEmailVerified: true }).select('email name');
            recipients = users
                .filter(u => u.email && u.email.includes('@'))
                .map(u => ({ email: u.email, name: u.name }));
        }
        else if (recipientType === 'single' && userId) {
            const user = await User_1.User.findById(userId).select('email name');
            if (!user) {
                res.status(404).json({ message: 'Target user not found.' });
                return;
            }
            recipients = [{ email: user.email, name: user.name }];
        }
        else if (recipientType === 'selected' && Array.isArray(userIds) && userIds.length > 0) {
            const users = await User_1.User.find({ _id: { $in: userIds }, isEmailVerified: true }).select('email name');
            recipients = users
                .filter(u => u.email && u.email.includes('@'))
                .map(u => ({ email: u.email, name: u.name }));
        }
        else {
            res.status(400).json({ message: 'Please select valid recipients for this notification.' });
            return;
        }
        if (recipients.length === 0) {
            res.status(400).json({ message: 'No valid recipient email addresses found.' });
            return;
        }
        const cleanSubject = subject.trim();
        const cleanMessage = message.trim();
        const cleanLink = link && typeof link === 'string' && link.trim().startsWith('http') ? link.trim() : null;
        const generateHtml = (name) => {
            const escapedBody = cleanMessage
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br/>');
            const isApkDownload = cleanLink && (cleanLink.toLowerCase().includes('.apk') || cleanLink.toLowerCase().includes('download') || cleanLink.toLowerCase().includes('drive.google') || cleanLink.toLowerCase().includes('neo-files-transfer'));
            return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${cleanSubject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                  <!-- Gradient Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 36px 28px; text-align: center;">
                      <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 6px 16px; border-radius: 9999px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.35);">
                        <span style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">DriveFlow Notification</span>
                      </div>
                      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; line-height: 1.35; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${cleanSubject}</h1>
                    </td>
                  </tr>

                  <!-- Main Body -->
                  <tr>
                    <td style="padding: 34px 30px 24px;">
                      <p style="font-size: 16px; color: #0f172a; margin-top: 0; margin-bottom: 16px; font-weight: 600;">
                        Hello ${name || 'DriveFlow User'},
                      </p>
                      <div style="background-color: #f1f5f9; border-left: 4px solid #8b5cf6; border-radius: 8px; padding: 18px 20px; margin: 18px 0; color: #334155; font-size: 15px; line-height: 1.7;">
                        ${escapedBody}
                      </div>

                      ${cleanLink ? `
                        <div style="text-align: center; margin: 28px 0 16px;">
                          <a href="${cleanLink}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); letter-spacing: 0.2px;">
                            ${isApkDownload ? 'Get Latest App Update' : 'Open Attached Link'}
                          </a>
                        </div>
                      ` : ''}

                      <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 24px; margin-bottom: 0;">
                        This message was sent by the DriveFlow Administrator to keep you updated on your account.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px; text-align: center;">
                      <p style="font-size: 13px; color: #475569; margin: 0 0 4px; font-weight: 600;">
                        DriveFlow Team
                      </p>
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        &copy; ${new Date().getFullYear()} DriveFlow. All rights reserved.
                      </p>
                      <p style="font-size: 11px; color: #94a3b8; margin: 6px 0 0;">
                        You are receiving this system email as an active registered user of DriveFlow.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
        };
        let sentCount = 0;
        const failedEmails = [];
        // Send emails sequentially or in small batches to preserve deliverability
        for (const r of recipients) {
            try {
                const html = generateHtml(r.name || 'User');
                await (0, mailer_1.sendCustomEmail)(r.email, cleanSubject, html);
                sentCount++;
            }
            catch (err) {
                console.error(`Failed sending to ${r.email}:`, err?.message);
                failedEmails.push(r.email);
            }
        }
        try {
            await (0, logger_1.logActivity)(req.user?._id, 'admin_notification_sent', `Dispatched email notification "${cleanSubject}" to ${sentCount}/${recipients.length} recipients (${recipientType})`);
        }
        catch (logErr) {
            console.warn('Could not log admin notification activity:', logErr);
        }
        res.json({
            success: true,
            sentCount,
            totalRecipients: recipients.length,
            failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
            message: `Notification successfully sent to ${sentCount} recipient(s).`
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.sendNotification = sendNotification;
//# sourceMappingURL=userController.js.map