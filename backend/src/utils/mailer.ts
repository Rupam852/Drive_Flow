import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const getApiKey = () => {
  const key = process.env.API_SECRET_KEY;
  if (!key) {
    console.warn('[SECURITY WARNING] API_SECRET_KEY is not defined in environment variables! Using default fallback.');
  }
  return key || 'default-secret-key-123';
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
    console.error(`Error delegating email to ${to}:`, error?.response?.data || error?.message);
    throw new Error(`Failed to send verification email: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
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
    console.error(`Error delegating custom email to ${to}:`, error?.response?.data || error?.message);
    throw new Error(`Failed to send custom email: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
  }
};
