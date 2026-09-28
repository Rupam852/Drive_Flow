import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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

export async function POST(request: Request) {
  try {
    const { to, otp, subject, html, senderName } = await request.json();
    const apiKey = request.headers.get('x-api-key');

    const serverApiKey = process.env.API_SECRET_KEY || 'default-secret-key-123';
    if (!process.env.API_SECRET_KEY) {
      console.warn('[SECURITY WARNING] API_SECRET_KEY is not defined in environment variables! Using default fallback.');
    }

    if (!apiKey || apiKey !== serverApiKey) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!to || (!otp && !html)) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const brevoHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const brevoPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const brevoUser = process.env.SMTP_USER || process.env.MAILER_EMAIL || '';
    const brevoPass = process.env.SMTP_PASS || process.env.MAILER_PASS || '';
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'notifications@driveflow.neofilestransfer.site';
    const fromName = process.env.SMTP_FROM_NAME || 'DriveFlow';

    const gmailUser = process.env.GMAIL_SMTP_USER || 'bott27124@gmail.com';
    const gmailPass = process.env.GMAIL_SMTP_PASS || process.env.MAILER_PASS || '';

function cleanEmailSubject(subject: string): string {
  if (!subject) return 'DriveFlow Notification';
  let clean = subject.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu, '');
  clean = clean.replace(/[!\[\]]/g, '').trim();
  clean = clean.replace(/^driveflow[:\s-]*/i, '').trim();
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean ? `DriveFlow: ${clean}` : 'DriveFlow Notification';
}

    const isOtp = !!otp;
    const rawSubject = subject || (isOtp ? `DriveFlow: Your verification code is ${otp}` : 'DriveFlow Notification');
    const finalSubject = cleanEmailSubject(rawSubject);

    const defaultOtpHtml = `<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="padding: 26px 32px 20px; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">DriveFlow</h1>
              <p style="margin: 4px 0 0; color: #e9d5ff; font-size: 13px; font-weight: 500;">Secure Cloud Storage</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px; color: #1e293b;">
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #0f172a;">Account Verification</h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #475569;">
                Hello, please use the following one-time verification code (OTP) to complete your verification. This code is valid for <strong>10 minutes</strong>.
              </p>
              
              <!-- OTP Box -->
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
          <!-- Footer -->
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

    const finalHtml = html || defaultOtpHtml;
    const finalPlainText = isOtp
      ? `DriveFlow Account Verification\n\nYour one-time code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nSecurity Notice: Never share this code with anyone. If you did not request this code, you can safely ignore this email.\n\n-- DriveFlow Team`
      : htmlToPlainText(finalHtml);

    const senderDisplayName = senderName && typeof senderName === 'string' && senderName.trim()
      ? senderName.trim()
      : fromName;

    // 1. Try Brevo First (100% Primary Inbox via custom authenticated domain)
    try {
      const brevoTransporter = nodemailer.createTransport({
        host: brevoHost,
        port: brevoPort,
        secure: false,
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      } as any);

      await brevoTransporter.sendMail({
        from: `"${senderDisplayName}" <${fromEmail}>`,
        replyTo: fromEmail,
        to,
        subject: finalSubject,
        text: finalPlainText,
        html: finalHtml,
        headers: {
          'X-Entity-Ref-ID': `msg-${Date.now()}`,
          'X-Auto-Response-Suppress': 'All',
          'X-Mailer-Provider': 'Brevo-Relay',
        },
      });
      console.log(`[Brevo Relay] Email sent to ${to} via Vercel (subject: ${finalSubject})`);
      return NextResponse.json({ message: 'Email sent successfully via Brevo' }, { status: 200 });
    } catch (brevoErr: any) {
      console.warn(`[Failover] Vercel Brevo relay failed for ${to} (${brevoErr?.message}), failing over to Own Gmail SMTP...`);
    }

    // 2. Fallback to Own Gmail SMTP if Brevo fails
    try {
      const gmailTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      } as any);

      await gmailTransporter.sendMail({
        from: `"${senderDisplayName}" <${gmailUser}>`,
        replyTo: gmailUser,
        to,
        subject: finalSubject,
        text: finalPlainText,
        html: finalHtml,
        headers: {
          'X-Entity-Ref-ID': `msg-${Date.now()}`,
          'X-Auto-Response-Suppress': 'All',
          'X-Mailer-Provider': 'Gmail-SMTP',
        },
      });
      console.log(`[Gmail SMTP Fallback] Email sent to ${to} via Vercel (subject: ${finalSubject})`);
      return NextResponse.json({ message: 'Email sent successfully via Gmail fallback' }, { status: 200 });
    } catch (gmailErr: any) {
      console.error(`[Failover Error] Both Brevo and Gmail failed on Vercel:`, gmailErr);
      return NextResponse.json({ message: `Failed to send email: ${gmailErr?.message || 'All SMTP relays failed'}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error(`Error processing email request:`, error);
    return NextResponse.json({ message: `Failed to send email: ${error?.message || 'Unknown error'}` }, { status: 500 });
  }
}
