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

const sendDirectEmail = async (to: string, subject: string, html: string) => {
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

  await transporter.sendMail({
    from: `"DriveFlow" <${process.env.MAILER_EMAIL}>`,
    to,
    subject,
    html,
  });
};

export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
    
    // Call the Vercel frontend API to send the email
    await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, otp },
      {
        headers: {
          'x-api-key': getApiKey(),
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds timeout
      }
    );

    console.log(`OTP sent to ${to} via Vercel relay`);
  } catch (error: any) {
    console.warn(`Vercel relay failed for OTP to ${to}, attempting direct Nodemailer fallback:`, error?.message);
    try {
      const defaultOtpBody = `
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
      `;
      await sendDirectEmail(to, 'Verify your Email Address', defaultOtpBody);
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
        timeout: 15000 // 15 seconds timeout
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
