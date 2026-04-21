"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const FileMetadataSchema = new mongoose_1.default.Schema({
    fileId: String,
    name: String,
    type: String,
    status: String,
    parentId: String,
    rootId: String,
});
const FileMetadata = mongoose_1.default.model('FileMetadata', FileMetadataSchema, 'filemetadatas');
async function check() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    const activeFiles = await FileMetadata.find({ status: 'active' });
    console.log(`Active files in DB: ${activeFiles.length}`);
    const folders = activeFiles.filter(f => f.type === 'application/vnd.google-apps.folder');
    console.log(`Folders: ${folders.length}`);
    const sampleFiles = activeFiles.slice(0, 10).map(f => ({ name: f.name, parent: f.parentId }));
    console.log('Sample files:', sampleFiles);
    await mongoose_1.default.disconnect();
}
check();
//# sourceMappingURL=check_db.js.map