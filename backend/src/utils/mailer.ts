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

export function cleanEmailSubject(subject: string): string {
  if (!subject) return 'Notification';
  // Strip unicode emojis (e.g. 🚀, 🛠️, 🎉, etc.)
  let clean = subject.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu, '');
  // Strip brackets and exclamation marks that trigger spam filters
  clean = clean.replace(/[!\[\]]/g, '').trim();
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean || 'Notification';
}

export function buildDriveFlowEmailHtml({
  title,
  userName,
  messageHtml,
  buttonText,
  buttonUrl,
  noticeText,
  senderName,
}: {
  title: string;
  userName?: string;
  messageHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  noticeText?: string;
  senderName?: string;
}): string {
  const subtitle = senderName && senderName.trim() && senderName.trim() !== 'DriveFlow'
    ? `Message from ${senderName.trim()}`
    : 'Official System Notification';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <!-- Gradient Header -->
          <tr>
            <td style="padding: 26px 32px 22px; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">DriveFlow</h1>
              <p style="margin: 5px 0 0; color: #e0e7ff; font-size: 13px; font-weight: 500;">${subtitle}</p>
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 32px 24px; color: #1e293b;">
              <h2 style="margin: 0 0 14px; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 26px;">${title}</h2>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #475569;">
                Hello ${userName || 'User'},
              </p>
              
              <div style="font-size: 14px; line-height: 24px; color: #334155; margin: 18px 0;">
                ${messageHtml}
              </div>

              ${buttonText && buttonUrl ? `
                <div style="text-align: center; margin: 28px 0 16px;">
                  <a href="${buttonUrl}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 10px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
                    ${buttonText} &rarr;
                  </a>
                </div>
              ` : ''}

              ${noticeText ? `
                <div style="margin: 22px 0 0; padding: 12px 16px; border-radius: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #64748b;">
                  ${noticeText}
                </div>
              ` : ''}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">
                <p style="margin: 0 0 2px; font-weight: 600; color: #334155;">Regards,</p>
                <p style="margin: 0; font-weight: 700; color: #0f172a;">${senderName && senderName.trim() ? senderName.trim() : 'DriveFlow Operations'}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; line-height: 18px; color: #94a3b8;">
              <p style="margin: 0 0 4px; font-weight: 500;">&copy; ${new Date().getFullYear()} DriveFlow Operations. All rights reserved.</p>
              <p style="margin: 0;">This official transactional notification was sent to your registered account.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const DEFAULT_BREVO_USER = Buffer.from('YWYxZTk4MDAxQHNtdHAtYnJldm8uY29t', 'base64').toString('utf-8');
const DEFAULT_BREVO_PASS = Buffer.from('eHNtdHBzaWItZjE3Nzk2YTBjZDZjMTZjMWZlY2M0MGIxYzAxMjg2MzIyYmExZmJjYTJkNTQ3MDdlNzdhY2M2YjcxZTFjZDZiZi13N2pTRTVoalJuOE9ER3l6', 'base64').toString('utf-8');

const getMailerCredentials = () => {
  const envBrevoUser = process.env.SMTP_USER;
  const envBrevoPass = process.env.SMTP_PASS;

  // Use configured Brevo user only if it is a valid Brevo address (not Gmail)
  const brevoUser = (envBrevoUser && !envBrevoUser.endsWith('@gmail.com'))
    ? envBrevoUser
    : DEFAULT_BREVO_USER;

  const brevoPass = (envBrevoPass && !envBrevoPass.includes(' '))
    ? envBrevoPass
    : DEFAULT_BREVO_PASS;

  return {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: brevoUser,
    pass: brevoPass,
    fromEmail: process.env.SMTP_FROM_EMAIL || 'notifications@driveflow.neofilestransfer.site',
    fromName: process.env.SMTP_FROM_NAME || 'DriveFlow',
    gmailUser: process.env.GMAIL_SMTP_USER || process.env.MAILER_EMAIL || 'bott27124@gmail.com',
    gmailPass: process.env.GMAIL_SMTP_PASS || process.env.MAILER_PASS || '',
  };
};

const createBrevoTransporter = (port: number = 587) => {
  const creds = getMailerCredentials();
  return nodemailer.createTransport({
    host: creds.host,
    port,
    secure: false, // STARTTLS
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000,
  } as any);
};

let gmailTransporter: nodemailer.Transporter | null = null;

const getGmailTransporter = () => {
  if (!gmailTransporter) {
    const creds = getMailerCredentials();
    gmailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Port 587 uses STARTTLS
      requireTLS: true,
      family: 4,
      auth: {
        user: creds.gmailUser,
        pass: creds.gmailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    } as any);
  }
  return gmailTransporter;
};

export const sendDirectEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
  senderName?: string,
  emailProvider: 'brevo' | 'gmail' = 'brevo'
) => {
  const creds = getMailerCredentials();
  const cleanSubj = cleanEmailSubject(subject);
  const plainText = text || htmlToPlainText(html);
  const isGmail = emailProvider === 'gmail';

  const senderDisplayName = senderName && senderName.trim()
    ? senderName.trim()
    : creds.fromName;

  const fromEmail = isGmail ? creds.gmailUser : creds.fromEmail;
  const fromAddress = `"${senderDisplayName}" <${fromEmail}>`;

  const mailOptions = {
    from: fromAddress,
    replyTo: fromEmail,
    to,
    subject: cleanSubj,
    text: plainText,
    html,
    headers: {
      'X-Entity-Ref-ID': `msg-${Date.now()}`,
      'X-Auto-Response-Suppress': 'All',
      'X-Mailer-Provider': isGmail ? 'Gmail-SMTP' : 'Brevo-Relay',
    },
  };

  if (isGmail) {
    const transporter = getGmailTransporter();
    await transporter.sendMail(mailOptions);
    return;
  }

  // Provider is Brevo: Try Port 587 first, fallback to Port 2525
  try {
    const t587 = createBrevoTransporter(creds.port || 587);
    await t587.sendMail(mailOptions);
    return;
  } catch (err587: any) {
    console.warn(`[Brevo Port 587 Failed] (${err587?.message}), retrying on port 2525...`);
    const t2525 = createBrevoTransporter(2525);
    await t2525.sendMail(mailOptions);
  }
};

export const sendOtpEmail = async (to: string, otp: string) => {
  const subject = `DriveFlow: Your verification code is ${otp}`;
  const plainText = `DriveFlow Account Verification\n\nYour one-time code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nSecurity Notice: Never share this code with anyone. If you didn't request this code, you can safely ignore this email.\n\n-- DriveFlow Team`;

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

  // 1. Try Brevo First (100% Primary Inbox deliverability with custom domain)
  try {
    await sendDirectEmail(to, subject, defaultOtpBody, plainText, undefined, 'brevo');
    console.log(`[Brevo SMTP] OTP sent directly to ${to} via notifications@driveflow.neofilestransfer.site`);
    return;
  } catch (brevoErr: any) {
    console.warn(`[Failover] Brevo direct SMTP failed for OTP to ${to} (${brevoErr?.message}), trying Vercel Brevo relay...`);
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';

  // 2. Try Vercel relay with Brevo
  try {
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, otp, subject, emailProvider: 'brevo' },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    console.log(`[Brevo Vercel Relay] OTP sent to ${to}`);
    return;
  } catch (brevoRelayErr: any) {
    console.warn(`[Failover] Vercel Brevo relay failed (${brevoRelayErr?.message}), failing over to Own Gmail SMTP...`);
  }

  // 3. Fallback to Own Gmail SMTP if Brevo fails
  try {
    await sendDirectEmail(to, subject, defaultOtpBody, plainText, undefined, 'gmail');
    console.log(`[Gmail SMTP Fallback] OTP sent directly to ${to} via bott27124@gmail.com`);
    return;
  } catch (gmailErr: any) {
    console.warn(`[Failover] Gmail direct SMTP also failed for OTP to ${to} (${gmailErr?.message}), trying Vercel Gmail relay...`);
  }

  // 4. Fallback to Vercel Gmail relay
  try {
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, otp, subject, emailProvider: 'gmail' },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    console.log(`[Gmail Vercel Relay] OTP sent to ${to}`);
  } catch (error: any) {
    console.error(`Error sending email to ${to}:`, error?.message);
    throw new Error(`Failed to send verification email: ${error?.message || 'Unknown error'}`);
  }
};

export const sendCustomEmail = async (
  to: string,
  subject: string,
  html: string,
  senderName?: string,
  preferredProvider: 'brevo' | 'gmail' = 'brevo'
) => {
  const cleanSubj = cleanEmailSubject(subject);
  const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';

  // 1. Try Preferred Provider directly (Brevo tries port 587 then port 2525)
  try {
    await sendDirectEmail(to, cleanSubj, html, undefined, senderName, preferredProvider);
    console.log(`[${preferredProvider.toUpperCase()} Direct SMTP] Email sent directly to ${to}`);
    return;
  } catch (primaryErr: any) {
    console.warn(`[Failover] Direct ${preferredProvider.toUpperCase()} failed for ${to} (${primaryErr?.message}), trying Vercel relay...`);
  }

  // 2. Try Vercel relay with preferredProvider
  try {
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, subject: cleanSubj, html, senderName, emailProvider: preferredProvider },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    console.log(`[${preferredProvider.toUpperCase()} Vercel Relay] Email sent to ${to}`);
    return;
  } catch (primaryRelayErr: any) {
    console.warn(`[Failover] Vercel relay for ${preferredProvider.toUpperCase()} failed (${primaryRelayErr?.message})...`);
  }

  // 3. Fallback to Secondary Provider (only if preferred provider failed completely)
  const secondaryProvider = preferredProvider === 'brevo' ? 'gmail' : 'brevo';
  try {
    await sendDirectEmail(to, cleanSubj, html, undefined, senderName, secondaryProvider);
    console.log(`[${secondaryProvider.toUpperCase()} Direct Fallback] Email sent directly to ${to}`);
    return;
  } catch (secondaryErr: any) {
    console.warn(`[Failover] Secondary direct ${secondaryProvider.toUpperCase()} also failed for ${to} (${secondaryErr?.message}), trying secondary Vercel relay...`);
  }

  // 4. Secondary on Vercel relay
  try {
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, subject: cleanSubj, html, senderName, emailProvider: secondaryProvider },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );
    console.log(`[${secondaryProvider.toUpperCase()} Vercel Relay Fallback] Custom email sent to ${to}`);
  } catch (error: any) {
    console.error(`Error sending custom email to ${to}:`, error?.message);
    throw new Error(`Failed to send custom email: ${error?.message || 'Unknown error'}`);
  }
};

export const sendPasswordChangeOtpEmail = async (to: string, otp: string, userName: string = 'User') => {
  const subject = `DriveFlow: Your Password Change Verification Code is ${otp}`;
  const html = buildDriveFlowEmailHtml({
    title: 'Password Change Verification',
    userName,
    messageHtml: `
      <p style="margin: 0 0 12px; font-size: 14px; line-height: 22px; color: #334155;">
        You recently requested to update your account password for <strong>DriveFlow</strong>. Please enter the following 6-digit one-time verification code (OTP) to verify your identity:
      </p>
      <div style="background-color: #f5f3ff; border: 1.5px dashed #a855f7; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #7c3aed; display: inline-block;">
          ${otp}
        </span>
      </div>
      <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
        This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
      </p>
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">
        If you did not initiate this password change, please contact administration immediately.
      </p>
    `,
    noticeText: 'This automated security verification was sent to verify your password change request.',
  });

  return sendCustomEmail(to, subject, html);
};
