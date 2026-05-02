import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app';
    
    // Call the Vercel frontend API to send the email
    const response = await axios.post(
      `${frontendUrl}/api/send-email`,
      { to, otp },
      {
        headers: {
          'x-api-key': process.env.API_SECRET_KEY || 'default-secret-key-123',
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
