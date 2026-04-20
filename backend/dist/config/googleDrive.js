"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'http://localhost:5050');
// Set credentials using the refresh token stored in .env
// After running `npx ts-node src/scripts/getGoogleToken.ts`, add GOOGLE_REFRESH_TOKEN to .env
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
const drive = googleapis_1.google.drive({
    version: 'v3',
    auth: oauth2Client,
});
exports.default = drive;
//# sourceMappingURL=googleDrive.js.map