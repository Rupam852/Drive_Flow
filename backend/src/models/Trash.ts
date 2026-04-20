import mongoose, { Schema, Document } from 'mongoose';

export interface ITrash extends Document {
  fileId: string;
  name: string;
  mimeType: string;
  originalParentId: string;
  user: mongoose.Types.ObjectId;
  trashedAt: Date;
}

const trashSchema: Schema = new Schema({
  fileId: { type: String, required: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  originalParentId: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  trashedAt: { type: Date, default: Date.now },
});

export const Trash = mongoose.model<ITrash>('Trash', trashSchema);
