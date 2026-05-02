import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

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
  }
} as any);

export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    const mailOptions = {
      from: `"DriveFlow" <${process.env.MAILER_EMAIL}>`,
      to,
      subject: 'Verify your Email Address',
      html: `
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
    console.log(`OTP sent to ${to}`);
  } catch (error: any) {
    console.error(`Error sending email to ${to}:`, error);
    throw new Error(`Failed to send verification email: ${error?.message || 'Unknown error'}`);
  }
};
