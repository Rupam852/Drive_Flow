import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  token: string;
  userId?: mongoose.Types.ObjectId;
  platform: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    platform: {
      type: String,
      default: 'android',
    },
  },
  {
    timestamps: true,
  }
);

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
