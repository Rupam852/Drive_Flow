import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { to, otp, subject, html } = await request.json();
    const apiKey = request.headers.get('x-api-key');

    const serverApiKey = process.env.API_SECRET_KEY || 'default-secret-key-123';
    if (apiKey !== serverApiKey) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!to || (!otp && !html)) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // upgrade later with STARTTLS
      requireTLS: true,
      family: 4, // force IPv4
      auth: {
        user: process.env.MAILER_EMAIL,
        pass: process.env.MAILER_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    } as any);

    const mailOptions = {
      from: `"DriveFlow" <${process.env.MAILER_EMAIL}>`,
      to,
      subject: subject || 'Verify your Email Address',
      html: html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #6b21a8; text-align: center;">Welcome to DriveFlow!</h2>
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Thank you for registering. Please use the following verification code to complete your registration process:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #6b21a8; padding: 10px 20px; border-radius: 5px; background-color: #f3e8ff; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #555;">This code will expire in 10 minutes.</p>
          <p style="font-size: 14px; color: #555;">If you did not request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">DriveFlow Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to} via Vercel`);
    
    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`Error sending email via Vercel:`, error);
    return NextResponse.json({ message: `Failed to send email: ${error?.message || 'Unknown error'}` }, { status: 500 });
  }
}
