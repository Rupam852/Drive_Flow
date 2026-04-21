"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const fileMetadataSchema = new mongoose_1.default.Schema({
    fileId: String,
    name: String,
    type: String,
    parentId: String,
    status: String,
});
const FileMetadata = mongoose_1.default.model('FileMetadata', fileMetadataSchema, 'filemetadatas');
async function check() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('DB Connected');
    console.log('DRIVE_FOLDER_ID from ENV:', process.env.GOOGLE_DRIVE_FOLDER_ID);
    const folders = await FileMetadata.find({ type: 'folder', status: 'active' });
    console.log('Total active folders in DB:', folders.length);
    folders.forEach(f => {
        console.log(`- ${f.name} (ID: ${f.fileId}, Parent: ${f.parentId})`);
    });
    const rootFolders = await FileMetadata.find({ type: 'folder', status: 'active', parentId: process.env.GOOGLE_DRIVE_FOLDER_ID });
    console.log('Folders with parentId === DRIVE_FOLDER_ID:', rootFolders.length);
    await mongoose_1.default.disconnect();
}
check();
//# sourceMappingURL=check_folders.js.map