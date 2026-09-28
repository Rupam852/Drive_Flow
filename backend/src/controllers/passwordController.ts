import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendCustomEmail, buildDriveFlowEmailHtml } from '../utils/mailer';

// Store tokens temporarily in memory (in production use Redis or DB)
const resetTokens = new Map<string, { email: string; expires: number }>();

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(404).json({ 
        message: 'please this email is not registered please first register then use forgot password feature' 
      });
      return;
    }

    if (user.status === 'rejected') {
      res.status(403).json({ 
        message: 'This account has been restricted. Please contact support.' 
      });
      return;
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    resetTokens.set(hashedToken, {
      email,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const emailSubject = 'DriveFlow: Password Reset Request';
    const emailHtml = buildDriveFlowEmailHtml({
      title: 'Password Reset Request',
      userName: user.name || 'User',
      messageHtml: `
        <p style="margin: 0 0 14px; font-size: 14px; line-height: 22px; color: #334155;">
          You recently requested to reset your password for your <strong>DriveFlow</strong> account. Click the button below within <strong>10 minutes</strong> to choose a new password:
        </p>
      `,
      buttonText: 'Reset Password',
      buttonUrl: resetUrl,
      noticeText: 'This link is valid for 10 minutes. If you did not request a password reset, you can safely disregard this email.',
    });

    // Send email using Brevo first, then failover to Own Gmail SMTP, then Vercel relay
    await sendCustomEmail(email, emailSubject, emailHtml);

    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = resetTokens.get(hashedToken);

    if (!tokenData || tokenData.expires < Date.now()) {
      res.status(400).json({ message: 'Token is invalid or has expired.' });
      return;
    }

    const user = await User.findOne({ email: tokenData.email });
    if (!user || user.status === 'rejected') {
      res.status(400).json({ message: 'User not found or account restricted.' });
      return;
    }

    if (newPassword.length < 6 || newPassword.length > 9) {
      res.status(400).json({ message: 'Password must be between 6 and 9 characters long.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    resetTokens.delete(hashedToken);
    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
