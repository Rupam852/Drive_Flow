import mongoose, { Document } from 'mongoose';
export interface ITrash extends Document {
    fileId: string;
    name: string;
    mimeType: string;
    originalParentId: string;
    user: mongoose.Types.ObjectId;
    trashedAt: Date;
}
export declare const Trash: mongoose.Model<ITrash, {}, {}, {}, mongoose.Document<unknown, {}, ITrash, {}, mongoose.DefaultSchemaOptions> & ITrash & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITrash>;
