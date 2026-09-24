import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message: string;
  type: 'broadcast' | 'single' | 'selected';
  targetUsers: mongoose.Types.ObjectId[];
  readBy: mongoose.Types.ObjectId[];
  dismissedBy: mongoose.Types.ObjectId[];
  sender: mongoose.Types.ObjectId;
  link?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['broadcast', 'single', 'selected'],
      default: 'broadcast',
      required: true,
    },
    targetUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    dismissedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    link: { type: String, trim: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Auto-expire after 30 days
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

// Optimize query for fetching user notifications
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, targetUsers: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
