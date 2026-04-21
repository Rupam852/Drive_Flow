import mongoose, { Document, Schema } from 'mongoose';

export interface IFileMetadata extends Document {
  fileId: string; // Google Drive File ID
  name: string;
  type: string; // e.g., 'application/pdf', 'folder'
  size?: number; // bytes
  ownerUserId: mongoose.Types.ObjectId;
  parentId?: string;
  rootId?: string;
  status: 'active' | 'deleted' | 'trashed';
  isHidden: boolean; // Admin can hide files from user view
  createdAt: Date;
  updatedAt: Date;
}

const fileMetadataSchema = new Schema<IFileMetadata>(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: { type: String },
    rootId: { type: String, index: true },
    status: { type: String, enum: ['active', 'deleted', 'trashed'], default: 'active' },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Optimize queries for stats and listing
fileMetadataSchema.index({ fileId: 1 });
fileMetadataSchema.index({ parentId: 1 });
fileMetadataSchema.index({ status: 1 });
fileMetadataSchema.index({ type: 1 });

export const FileMetadata = mongoose.model<IFileMetadata>('FileMetadata', fileMetadataSchema);
