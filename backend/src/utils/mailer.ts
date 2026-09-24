import axios from 'axios';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const getApiKey = () => {
  const key = process.env.API_SECRET_KEY;
  if (!key) {
    console.warn('[SECURITY WARNING] API_SECRET_KEY is not defined in environment variables! Using default fallback.');
  }
  return key || 'default-secret-key-123';
};

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

const sendDirectEmail = async (to: string, subject: string, html: string, text?: string) => {
  if (!process.env.MAILER_EMAIL || !process.env.MAILER_PASS) {
    throw new Error('Direct mailer credentials not configured');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    auth: {
      user: process.env.MAILER_EMAIL,
      pass: process.env.MAILER_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  } as any);

  const plainText = text || htmlToPlainText(html);

  await transporter.sendMail({
    from: `"DriveFlow Security" <${process.env.MAILER_EMAIL}>`,
    replyTo: process.env.MAILER_EMAIL,
    to,
    subject,
    text: plainText,
    html,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'high',
      'X-Entity-Ref-ID': `driveflow-${Date.now()}`,
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    },
  });
};

export const sendOtpEmail = async (to: string, otp: string) => {
  const subject = `DriveFlow: Your verification code is ${otp}`;
  const plainText = `DriveFlow Account Verification\n\nYour one-time code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nSecurity Notice: Never share this code with anyone. If you didn't request this code, you can safely ignore this email.\n\n-- DriveFlow Security Team`;

  const defaultOtpBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DriveFlow Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 26px 32px 20px; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">DriveFlow</h1>
              <p style="margin: 4px 0 0; color: #e9d5ff; font-size: 13px; font-weight: 500;">Secure Cloud Storage</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px; color: #1e293b;">
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #0f172a;">Account Verification</h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #475569;">
                Hello, please use the following one-time verification code (OTP) to complete your verification. This code is valid for <strong>10 minutes</strong>.
              </p>
              
              <div style="background-color: #f5f3ff; border: 1.5px dashed #a855f7; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #7c3aed; display: inline-block;">
                  ${otp}
                </span>
              </div>

              <p style="margin: 0 0 10px; font-size: 13px; line-height: 20px; color: #64748b;">
                <strong>Security Reminder:</strong> DriveFlow will never ask for your code via chat or phone. Never share this code with anyone.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                If you did not request this verification code, your account is safe and you can safely disregard this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; line-height: 16px; color: #94a3b8;">
              <p style="margin: 0 0 4px;">&copy; ${new Date().getFullYear()} DriveFlow. All rights reserved.</p>
              <p style="margin: 0;">This automated security verification was sent to verify your identity.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
    
    // Call the Vercel frontend API to send the email
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, otp, subject },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`OTP sent to ${to} via Vercel relay`);
  } catch (error: any) {
    console.warn(`Vercel relay failed for OTP to ${to}, attempting direct Nodemailer fallback:`, error?.message);
    try {
      await sendDirectEmail(to, subject, defaultOtpBody, plainText);
      console.log(`OTP sent directly to ${to} via direct Nodemailer`);
    } catch (fallbackError: any) {
      console.error(`Error sending email to ${to}:`, fallbackError?.message);
      throw new Error(`Failed to send verification email: ${fallbackError?.message || error?.message || 'Unknown error'}`);
    }
  }
};

export const sendCustomEmail = async (to: string, subject: string, html: string) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
    
    // Call the Vercel frontend API to send the custom email
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, subject, html },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`Custom email sent to ${to} via Vercel relay`);
  } catch (error: any) {
    console.warn(`Vercel relay failed for custom email to ${to}, attempting direct Nodemailer fallback:`, error?.message);
    try {
      await sendDirectEmail(to, subject, html);
      console.log(`Custom email sent directly to ${to} via direct Nodemailer`);
    } catch (fallbackError: any) {
      console.error(`Error sending custom email to ${to}:`, fallbackError?.message);
      throw new Error(`Failed to send custom email: ${fallbackError?.message || error?.message || 'Unknown error'}`);
    }
  }
};
