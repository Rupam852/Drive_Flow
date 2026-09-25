import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User, IUser } from '../models/User';
import { logActivity } from '../utils/logger';
import { ActivityLog } from '../models/ActivityLog';
import { sendOtpEmail, sendCustomEmail, buildDriveFlowEmailHtml, cleanEmailSubject, sendPasswordChangeOtpEmail } from '../utils/mailer';
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
        profilePic: user.profilePic,
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
        const userHtml = buildDriveFlowEmailHtml({
          title: 'Account Registration Received',
          userName: user.name,
          messageHtml: `
            <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
              Thank you for registering and verifying your email with <strong>DriveFlow</strong>!
            </p>
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
              <p style="font-size: 14px; color: #1e3a8a; margin: 0; font-weight: 700;">Account Status: Pending Admin Approval</p>
              <p style="font-size: 13px; color: #1e40af; margin: 4px 0 0 0;">Our admin team is reviewing your registration. You will receive an automated confirmation email once approved.</p>
            </div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #475569;">
              Thank you for your patience.
            </p>
          `,
          noticeText: 'This automated notification was sent to confirm your DriveFlow registration.',
        });
        await sendCustomEmail(user.email, 'DriveFlow: Account registration received', userHtml);

        // 2. Send admin notification email
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'bott27124@gmail.com';
        const adminHtml = buildDriveFlowEmailHtml({
          title: 'New User Registration',
          userName: 'Admin',
          messageHtml: `
            <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
              A new user has registered and verified their email address. They are waiting for your review.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
              <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0;"><strong>Name:</strong> ${user.name}</p>
              <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0;"><strong>Email:</strong> ${user.email}</p>
              <p style="font-size: 14px; color: #64748b; margin: 0;"><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
            </div>
          `,
          buttonText: 'Open Admin Dashboard',
          buttonUrl: `${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login`,
          noticeText: 'DriveFlow Admin System Notification',
        });
        await sendCustomEmail(adminEmail, 'DriveFlow: New user pending approval', adminHtml);
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

// @desc    Get authenticated user profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profilePic: user.profilePic,
      createdAt: user.createdAt,
      isGoogleUser: !!user.googleId,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Update authenticated user profile name and/or avatar
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { name, profilePic } = req.body;

    const userId = (req as any).user?._id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (profilePic !== undefined) {
      user.profilePic = profilePic;
    }

    await user.save();

    // Log user activity
    await logActivity(user._id.toString(), 'update_profile', `User updated profile: ${user.name}`);

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profilePic: user.profilePic,
      }
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Send OTP to authenticated user's email for password change
// @route   POST /api/auth/send-password-otp
// @access  Private
export const sendPasswordOtp = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetOtp = otp;
    user.passwordResetOtpExpires = otpExpires;
    await user.save();

    await sendPasswordChangeOtpEmail(user.email, otp, user.name);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${user.email}.`,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Verify OTP and change password for authenticated user
// @route   POST /api/auth/verify-password-otp
// @access  Private
export const verifyPasswordOtp = async (req: Request, res: Response) => {
  try {
    const { otp, newPassword } = req.body;
    const userId = (req as any).user?._id;

    if (!otp || !otp.trim()) {
      res.status(400).json({ message: 'Please enter the 6-digit verification code sent to your email.' });
      return;
    }

    if (!newPassword || newPassword.length < 6 || newPassword.length > 9) {
      res.status(400).json({ message: 'Password must be between 6 and 9 characters long.' });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!user.passwordResetOtp || user.passwordResetOtp !== otp.trim()) {
      res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
      return;
    }

    if (!user.passwordResetOtpExpires || user.passwordResetOtpExpires < new Date()) {
      res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    await user.save();

    await logActivity(user._id.toString(), 'change_password_otp', `Password changed via email OTP verification for ${user.email}`);

    res.json({ success: true, message: 'Password has been successfully verified and changed!' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

const googleClient = new OAuth2Client();

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken, action } = req.body;
    if (!idToken) {
      res.status(400).json({ message: 'idToken is required' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_SIGNIN_CLIENT_ID || '807433349889-957a3l6dtio305gtn6g5f7ek39rgi498.apps.googleusercontent.com', // Web Client ID
        process.env.GOOGLE_ANDROID_CLIENT_ID || '807433349889-1lstbeco9bsmrtjeugvka2mi9ff9cq9u.apps.googleusercontent.com'  // Android Client ID
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
      // User does not exist
      if (action === 'login') {
        res.status(404).json({ message: 'No account found with this email. Please register first.' });
        return;
      }

      // Register new user (action is 'register')
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
      const userHtml = buildDriveFlowEmailHtml({
        title: 'Account Registration Received',
        userName: user.name,
        messageHtml: `
          <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
            Thank you for registering with <strong>DriveFlow</strong> using Google Sign-In!
          </p>
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
            <p style="font-size: 14px; color: #1e3a8a; margin: 0; font-weight: 700;">Account Status: Pending Admin Approval</p>
            <p style="font-size: 13px; color: #1e40af; margin: 4px 0 0 0;">Our admin team is reviewing your registration. You will receive an automated confirmation email once approved.</p>
          </div>
          <p style="margin: 12px 0 0; font-size: 14px; color: #475569;">
            Thank you for your patience.
          </p>
        `,
        noticeText: 'This automated notification was sent to confirm your DriveFlow registration.',
      });
      sendCustomEmail(user.email, 'DriveFlow: Account registration received', userHtml).catch(console.error);

      // Send alert to admin
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'bott27124@gmail.com';
      const adminHtml = buildDriveFlowEmailHtml({
        title: 'New User Registration (Google)',
        userName: 'Admin',
        messageHtml: `
          <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">
            A new user has registered using Google Sign-In and is waiting for manual review.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; margin: 16px 0; border-radius: 8px;">
            <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0;"><strong>Name:</strong> ${user.name}</p>
            <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0;"><strong>Email:</strong> ${user.email}</p>
            <p style="font-size: 14px; color: #64748b; margin: 0;"><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
          </div>
        `,
        buttonText: 'Open Admin Dashboard',
        buttonUrl: `${process.env.FRONTEND_URL || 'https://driveflowrupam.vercel.app'}/login`,
        noticeText: 'DriveFlow Admin System Notification',
      });
      sendCustomEmail(adminEmail, 'DriveFlow: New user pending approval', adminHtml).catch(console.error);

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
