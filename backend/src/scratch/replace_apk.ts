import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5050'
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Same File ID as before — link on website stays same!
const EXISTING_FILE_ID = '1EH7ZYEMbhNuMOgCLLhjerlIvick3k-0F';
const APK_PATH = 'D:\\PROJECT\\File_Opcus\\frontend\\android\\app\\build\\outputs\\apk\\debug\\DriveFlow.apk';

async function replaceAPK() {
  try {
    const sizeMB = (fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(1);
    console.log(`📤 Replacing DriveFlow.apk on Google Drive (${sizeMB} MB)...`);

    // Update existing file content — same file ID, link stays the same!
    const res = await drive.files.update({
      fileId: EXISTING_FILE_ID,
      requestBody: {
        name: 'DriveFlow.apk',
      },
      media: {
        mimeType: 'application/vnd.android.package-archive',
        body: fs.createReadStream(APK_PATH),
      },
      fields: 'id, name',
    });

    console.log(`\n✅ APK replaced successfully!`);
    console.log(`📦 File: ${res.data.name}`);
    console.log(`🔗 Download link (same as before):`);
    console.log(`   https://drive.google.com/uc?export=download&id=${EXISTING_FILE_ID}`);
    console.log(`\n✅ Website download button will now serve the NEW APK!`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

replaceAPK();
