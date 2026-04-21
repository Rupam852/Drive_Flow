"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const auth = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = googleapis_1.google.drive({ version: 'v3', auth });
async function check() {
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('Checking Root ID:', rootId);
    const res = await drive.files.list({
        q: `'${rootId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size)',
    });
    console.log('Files in Root from Google Drive:');
    res.data.files?.forEach(f => {
        console.log(`- ${f.name} (${f.mimeType}) ID: ${f.id}`);
    });
}
check();
//# sourceMappingURL=check_drive.js.map