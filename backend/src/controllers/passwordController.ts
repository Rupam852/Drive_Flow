import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { User } from '../models/User';

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

    const emailSubject = 'Password Reset Request - DriveFlow';
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#0f172a;color:#f8fafc;border-radius:16px;">
        <h2 style="color:#8b5cf6;">DriveFlow Password Reset</h2>
        <p>You requested a password reset. Click the link below within <strong>10 minutes</strong>:</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#8b5cf6;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
        <p style="color:#94a3b8;font-size:12px;">This link will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `;

    // Send email via Vercel relay to bypass Render SMTP blocks
    try {
      const axios = require('axios');
      await axios.post(
        `${frontendUrl}/api/send-email`,
        { to: email, subject: emailSubject, html: emailHtml },
        {
          headers: {
            'x-api-key': process.env.API_SECRET_KEY || 'default-secret-key-123',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
    } catch (relayError: any) {
      console.error(`Error delegating reset email to ${email}:`, relayError?.response?.data || relayError?.message);
      throw new Error('Failed to send reset email. Please try again later.');
    }

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
