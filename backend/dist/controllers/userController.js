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
                    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
                    const approvedHtml = (0, mailer_1.buildDriveFlowEmailHtml)({
                        title: 'Account Approved',
                        userName: user.name,
                        messageHtml: `
              <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
                Great news! Your <strong>DriveFlow</strong> account registration has been reviewed and approved by the administration.
              </p>
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
                <p style="font-size: 14px; color: #065f46; margin: 0; font-weight: 700;">Account Status: Approved &amp; Active</p>
                <p style="font-size: 13px; color: #047857; margin: 4px 0 0 0;">You now have full access to store, organize, and access your files securely.</p>
              </div>
              <p style="margin: 12px 0 0; font-size: 14px; color: #475569;">
                You can log in anytime using your registered email and password.
              </p>
            `,
                        buttonText: 'Log In to Workspace',
                        buttonUrl: `${frontendUrl}/login`,
                        noticeText: 'If you have any questions, you can reach out to administrator support.',
                    });
                    await (0, mailer_1.sendCustomEmail)(user.email, 'DriveFlow: Account approved', approvedHtml);
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
                    const rejectedHtml = (0, mailer_1.buildDriveFlowEmailHtml)({
                        title: 'Account Registration Update',
                        userName: user.name,
                        messageHtml: `
              <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
                Thank you for your interest in <strong>DriveFlow</strong>. After review by our administrative team, your registration request has been declined at this time.
              </p>
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
                <p style="font-size: 14px; color: #991b1b; margin: 0; font-weight: 700;">Status: Registration Declined</p>
                <p style="font-size: 13px; color: #b91c1c; margin: 4px 0 0 0;">If you believe this decision was made in error, please contact administrator support.</p>
              </div>
            `,
                        buttonText: 'Contact Administrator Support',
                        buttonUrl: 'mailto:rupambairagya08@gmail.com?subject=Registration%20Inquiry',
                        noticeText: 'This automated notification was sent from DriveFlow Administration.',
                    });
                    await (0, mailer_1.sendCustomEmail)(user.email, 'DriveFlow: Account registration update', rejectedHtml);
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
        const sanitizedSubject = (0, mailer_1.cleanEmailSubject)(subject.trim());
        const cleanMessage = message.trim();
        const cleanLink = link && typeof link === 'string' && link.trim().startsWith('http') ? link.trim() : null;
        const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
        // Route direct APK downloads through official web app to prevent spam/phishing flags
        let buttonUrl = undefined;
        let buttonText = undefined;
        if (cleanLink) {
            const isDirectBinary = cleanLink.toLowerCase().includes('.apk') || cleanLink.toLowerCase().includes('pages.dev');
            if (isDirectBinary) {
                buttonUrl = `${frontendUrl}/user/notifications`;
                buttonText = 'Open App to Update';
            }
            else {
                buttonUrl = cleanLink;
                buttonText = 'View Details';
            }
        }
        const escapedBody = cleanMessage
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
        let sentCount = 0;
        const failedEmails = [];
        // Send emails sequentially or in small batches to preserve deliverability
        for (const r of recipients) {
            try {
                const html = (0, mailer_1.buildDriveFlowEmailHtml)({
                    title: sanitizedSubject.replace(/^DriveFlow:\s*/i, ''),
                    userName: r.name || 'User',
                    messageHtml: `<div style="font-size: 14px; line-height: 22px; color: #334155;">${escapedBody}</div>`,
                    buttonText,
                    buttonUrl,
                    noticeText: 'This automated notification was sent to your registered DriveFlow account.',
                });
                await (0, mailer_1.sendCustomEmail)(r.email, sanitizedSubject, html);
                sentCount++;
            }
            catch (err) {
                console.error(`Failed sending to ${r.email}:`, err?.message);
                failedEmails.push(r.email);
            }
        }
        try {
            await (0, logger_1.logActivity)(req.user?._id, 'admin_notification_sent', `Dispatched email notification "${sanitizedSubject}" to ${sentCount}/${recipients.length} recipients (${recipientType})`);
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