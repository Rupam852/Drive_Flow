import mongoose, { Document } from 'mongoose';
export interface IFileMetadata extends Document {
    fileId: string;
    name: string;
    type: string;
    size?: number;
    ownerUserId: mongoose.Types.ObjectId;
    parentId?: string;
    rootId?: string;
    status: 'active' | 'deleted' | 'trashed';
    createdAt: Date;
    updatedAt: Date;
}
export declare const FileMetadata: mongoose.Model<IFileMetadata, {}, {}, {}, mongoose.Document<unknown, {}, IFileMetadata, {}, mongoose.DefaultSchemaOptions> & IFileMetadata & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IFileMetadata>;
