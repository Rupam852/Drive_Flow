import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User, IUser } from '../models/User';
import { logActivity } from '../utils/logger';
import { ActivityLog } from '../models/ActivityLog';
import { sendOtpEmail, sendCustomEmail } from '../utils/mailer';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: '30d',
  });
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    if (password.length < 6 || password.length > 9) {
      res.status(400);
      throw new Error('Password must be between 6 and 9 characters long');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'user',
      status: 'pending',
      isEmailVerified: false,
      emailVerificationOtp: otp,
      otpExpires,
    });

    if (user) {
      // Send OTP email asynchronously to prevent blocking the response
      // If it fails, the user can use "Resend OTP" on the verification page
      sendOtpEmail(user.email, otp).catch((err) => {
        console.error('Failed to send initial OTP email:', err);
      });
      
      await logActivity(user._id as any, 'register', `New account registered: ${name}`);
      res.status(201).json({
        message: 'Registration successful. OTP sent to email.',
        requireOtp: true,
        email: user.email
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      if (!user.isEmailVerified) {
        res.status(403).json({ message: 'Email not verified. Please verify your email first.', requireOtp: true, email: user.email });
        return;
      }
      if (user.status === 'pending') {
        res.status(403).json({ message: 'Please wait for admin approval. Contact admin.' });
        return;
      }
      if (user.status === 'rejected') {
        res.status(403).json({ message: 'Your profile has been rejected. Please contact admin.' });
        return;
      }


      await logActivity(user._id as any, 'login', `User logged in: ${user.name}`);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        token: generateToken((user._id as any).toString(), user.role),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ message: 'Email already verified' });
      return;
    }

    if (user.emailVerificationOtp !== otp) {
      res.status(400).json({ message: 'Invalid OTP' });
      return;
    }

    if (user.otpExpires && user.otpExpires < new Date()) {
      res.status(400).json({ message: 'OTP has expired' });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerificationOtp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Dispatch notification emails asynchronously
    (async () => {
      try {
        // 1. Send user confirmation pending email
        const userHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
            <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">Welcome to DriveFlow!</h2>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for registering and successfully verifying your email address!</p>
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="font-size: 15px; color: #1e3a8a; margin: 0; font-weight: bold;">Account Status: Pending Admin Approval</p>
              <p style="font-size: 14px; color: #1e40af; margin: 5px 0 0 0;">Please wait up to <strong>2 hours</strong>. Our admin team will quickly review and approve your account.</p>
            </div>
            <p style="font-size: 15px; color: #333; line-height: 1.6;">You will receive an automated email confirmation as soon as your account is approved and ready to access!</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Security Operations Team</p>
          </div>
        `;
        await sendCustomEmail(user.email, '[DriveFlow] Account Pending Approval', userHtml);

        // 2. Send admin notification email
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'bott27124@gmail.com';
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fcfcfc;">
            <h2 style="color: #8b5cf6; text-align: center; margin-bottom: 20px;">🚨 New User Registered</h2>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello Admin,</p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">A new user has registered and verified their email address. They are now waiting for your manual approval to access DriveFlow.</p>
            <div style="background-color: #faf5ff; border: 1px dashed #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 8px;">
              <p style="font-size: 15px; color: #581c87; margin: 0 0 8px 0; font-weight: bold;">User Details:</p>
              <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Name:</strong> ${user.name}</p>
              <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Email:</strong> ${user.email}</p>
              <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Registered At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="font-size: 15px; color: #333; line-height: 1.6;">Please log into your Admin Panel to approve or reject this user's profile.</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login" style="background-color: #8b5cf6; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(139,92,246,0.25); display: inline-block;">Go to Admin Dashboard</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Automation Relay</p>
          </div>
        `;
        await sendCustomEmail(adminEmail, '[DriveFlow Alert] New User Pending Approval', adminHtml);
      } catch (err) {
        console.error('Failed to dispatch registration notification emails:', err);
      }
    })();

    res.status(200).json({ message: 'Email verified successfully. Please wait for admin approval.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ message: 'Email already verified' });
      return;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.emailVerificationOtp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({ message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const seedAdmin = async () => {
  try {
    const adminEmail = 'rupambairagya08@gmail.com';
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const adminPass = process.env.ADMIN_SEED_PASSWORD || 'Rupam@123';
      if (!process.env.ADMIN_SEED_PASSWORD) {
        console.warn('[SECURITY WARNING] ADMIN_SEED_PASSWORD is not defined in environment variables! Using default fallback.');
      }
      const passwordHash = await bcrypt.hash(adminPass, salt);
      await User.create({
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        status: 'approved',
        isEmailVerified: true,
      });
      console.log('Admin user seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding admin', error);
  }
};

// @desc Get latest required mobile app version and download URL
// @route GET /api/auth/app-version
export const getAppVersion = async (req: Request, res: Response) => {
  try {
    let latestVersion = process.env.LATEST_APP_VERSION;
    let minRequiredVersion = process.env.MIN_REQUIRED_VERSION;
    const downloadUrl = process.env.APP_DOWNLOAD_URL || 'https://neo-files-transfer.pages.dev/download/723586892fd0';

    // Fully Automated: Read and parse version directly from frontend AppUpdateProvider.tsx
    try {
      const providerPath = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'components', 'AppUpdateProvider.tsx');
      if (fs.existsSync(providerPath)) {
        const content = fs.readFileSync(providerPath, 'utf8');
        const match = content.match(/const CURRENT_APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
          const autoVersion = match[1];
          // Dynamically override latestVersion and minRequiredVersion if not strictly set in env
          if (!latestVersion) latestVersion = autoVersion;
          if (!minRequiredVersion) minRequiredVersion = autoVersion;
        }
      }
    } catch (parseError) {
      console.error('Failed to auto-detect app version from source:', parseError);
    }

    // Ultimate Safe Fallbacks
    if (!latestVersion) latestVersion = '1.0.1';
    if (!minRequiredVersion) minRequiredVersion = '1.0.1';
    
    res.status(200).json({
      latestVersion,
      minRequiredVersion,
      downloadUrl,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Update authenticated user profile name
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const userId = (req as any).user?._id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.name = name;
    await user.save();

    // Log user activity
    await logActivity(user._id.toString(), 'update_profile', `User updated profile name to ${name}`);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

const googleClient = new OAuth2Client();

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ message: 'idToken is required' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        '807433349889-957a3l6dtio305gtn6g5f7ek39rgi498.apps.googleusercontent.com', // Web Client ID
        '807433349889-1lstbeco9bsmrtjeugvka2mi9ff9cq9u.apps.googleusercontent.com'  // Android Client ID
      ],
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ message: 'Invalid token payload' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      let updated = false;
      if (picture && user.profilePic !== picture) {
        user.profilePic = picture;
        updated = true;
      }
      if (!user.googleId) {
        user.googleId = googleId;
        updated = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        updated = true;
      }
      if (updated) {
        await user.save();
      }

      // Check status
      if (user.status === 'pending') {
        res.status(403).json({ message: 'Please wait for admin approval. Contact admin.' });
        return;
      }
      if (user.status === 'rejected') {
        res.status(403).json({ message: 'Your profile has been rejected. Please contact admin.' });
        return;
      }

      await logActivity(user._id.toString(), 'login', `User logged in via Google: ${user.name}`);

      res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profilePic: user.profilePic,
        token: generateToken(user._id.toString(), user.role),
      });
    } else {
      // Register new user
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = await User.create({
        name: name || email.split('@')[0],
        email,
        passwordHash,
        role: 'user',
        status: 'pending',
        isEmailVerified: true, // Google verifies email
        googleId,
        profilePic: picture,
      });

      // Send confirmation to user
      const userHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
          <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">Welcome to DriveFlow!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello <strong>${user.name}</strong>,</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for registering using Google!</p>
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="font-size: 15px; color: #1e3a8a; margin: 0; font-weight: bold;">Account Status: Pending Admin Approval</p>
            <p style="font-size: 14px; color: #1e40af; margin: 5px 0 0 0;">Please wait up to <strong>2 hours</strong>. Our admin team will quickly review and approve your account.</p>
          </div>
          <p style="font-size: 15px; color: #333; line-height: 1.6;">You will receive an automated email confirmation as soon as your account is approved and ready to access!</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Security Operations Team</p>
        </div>
      `;
      sendCustomEmail(user.email, '[DriveFlow] Account Pending Approval', userHtml).catch(console.error);

      // Send alert to admin
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'bott27124@gmail.com';
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #fcfcfc;">
          <h2 style="color: #8b5cf6; text-align: center; margin-bottom: 20px;">🚨 New User Registered (via Google)</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Hello Admin,</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">A new user has registered using Google Sign-In and is now waiting for your manual approval to access DriveFlow.</p>
          <div style="background-color: #faf5ff; border: 1px dashed #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p style="font-size: 15px; color: #581c87; margin: 0 0 8px 0; font-weight: bold;">User Details:</p>
            <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Name:</strong> ${user.name}</p>
            <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="font-size: 14px; color: #333; margin: 4px 0;"><strong>Registered At:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="font-size: 15px; color: #333; line-height: 1.6;">Please log into your Admin Panel to approve or reject this user's profile.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login" style="background-color: #8b5cf6; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(139,92,246,0.25); display: inline-block;">Go to Admin Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">DriveFlow Automation Relay</p>
        </div>
      `;
      sendCustomEmail(adminEmail, '[DriveFlow Alert] New User Pending Approval', adminHtml).catch(console.error);

      await logActivity(user._id.toString(), 'register', `New user registered via Google: ${user.name}`);

      res.status(202).json({
        status: 'pending',
        message: 'Registration successful. Please wait for admin approval.',
      });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
