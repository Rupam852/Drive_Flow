import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId;
  action: 'upload' | 'delete' | 'download' | 'rename' | 'move' | 'create_folder';
  details: string;
  timestamp: Date;
}

const activityLogSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, expires: 3600 },
});

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
