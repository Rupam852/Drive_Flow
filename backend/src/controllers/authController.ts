import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { logActivity } from '../utils/logger';
import { ActivityLog } from '../models/ActivityLog';
import { sendOtpEmail } from '../utils/mailer';
import crypto from 'crypto';

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

    if (password.length < 6 || password.length > 8) {
      res.status(400);
      throw new Error('Password must be between 6 and 8 characters long');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
      await sendOtpEmail(user.email, otp);
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

      // Clear old history to start fresh for this session
      if (user.role === 'admin') {
        await ActivityLog.deleteMany({});
      } else {
        await ActivityLog.deleteMany({ user: user._id });
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
      const passwordHash = await bcrypt.hash('Rupam@123', salt);
      await User.create({
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        status: 'approved',
        isEmailVerified: true,
      });
      console.log('Admin user seeded');
    }
  } catch (error) {
    console.error('Error seeding admin', error);
  }
};
