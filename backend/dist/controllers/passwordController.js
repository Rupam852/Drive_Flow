"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const User_1 = require("../models/User");
// Store tokens temporarily in memory (in production use Redis or DB)
const resetTokens = new Map();
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User_1.User.findOne({ email });
        if (!user) {
            // Send success even if user not found (security best practice)
            res.json({ message: 'If this email exists, a reset link has been sent.' });
            return;
        }
        if (user.role === 'admin') {
            res.status(403).json({ message: 'Admin password cannot be reset via this method.' });
            return;
        }
        // Generate unique token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        resetTokens.set(hashedToken, {
            email,
            expires: Date.now() + 30 * 60 * 1000, // 30 minutes
        });
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
        // Send email via Nodemailer
        const transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAILER_EMAIL,
                pass: process.env.MAILER_PASS, // App password
            },
        });
        await transporter.sendMail({
            from: `"DriveFlow" <${process.env.MAILER_EMAIL}>`,
            to: email,
            subject: 'Password Reset Request - DriveFlow',
            html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#0f172a;color:#f8fafc;border-radius:16px;">
          <h2 style="color:#8b5cf6;">DriveFlow Password Reset</h2>
          <p>You requested a password reset. Click the link below within 30 minutes:</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#8b5cf6;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
          <p style="color:#94a3b8;font-size:12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
        });
        res.json({ message: 'If this email exists, a reset link has been sent.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const tokenData = resetTokens.get(hashedToken);
        if (!tokenData || tokenData.expires < Date.now()) {
            res.status(400).json({ message: 'Token is invalid or has expired.' });
            return;
        }
        const user = await User_1.User.findOne({ email: tokenData.email });
        if (!user) {
            res.status(400).json({ message: 'User not found.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        await user.save();
        resetTokens.delete(hashedToken);
        res.json({ message: 'Password reset successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=passwordController.js.map