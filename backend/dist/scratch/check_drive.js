"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleDrive_1 = __importDefault(require("../config/googleDrive"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
async function check() {
    const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('Managed Folder ID:', DRIVE_FOLDER_ID);
    const res = await googleDrive_1.default.files.list({
        pageSize: 20,
        fields: 'files(id, name, mimeType, parents)',
        q: "trashed = false"
    });
    console.log('Top 20 files in Drive (including outside managed folder):');
    res.data.files?.forEach(f => {
        console.log(`- ${f.name} (${f.mimeType}) | Parents: ${f.parents?.join(', ')}`);
    });
}
check().catch(console.error);
//# sourceMappingURL=check_drive.js.map