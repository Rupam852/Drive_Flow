import mongoose, { Document } from 'mongoose';
export interface IActivityLog extends Document {
    user: mongoose.Types.ObjectId;
    action: 'upload' | 'delete' | 'download' | 'rename' | 'move' | 'create_folder';
    details: string;
    timestamp: Date;
}
export declare const ActivityLog: mongoose.Model<IActivityLog, {}, {}, {}, mongoose.Document<unknown, {}, IActivityLog, {}, mongoose.DefaultSchemaOptions> & IActivityLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IActivityLog>;
