import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'rejected';
  isEmailVerified: boolean;
  emailVerificationOtp?: string;
  otpExpires?: Date;
  passwordResetOtp?: string;
  passwordResetOtpExpires?: Date;
  googleId?: string;
  profilePic?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationOtp: { type: String },
    otpExpires: { type: Date },
    passwordResetOtp: { type: String },
    passwordResetOtpExpires: { type: Date },
    googleId: { type: String },
    profilePic: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
