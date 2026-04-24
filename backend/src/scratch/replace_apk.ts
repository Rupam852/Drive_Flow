import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5050'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// The file ID from LoginPage.tsx
const FILE_ID = '1EH7ZYEMbhNuMOgCLLhjerlIvick3k-0F';
const APK_PATH = 'D:\\PROJECT\\File_Opcus\\frontend\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk';

async function replaceAPK() {
  try {
    if (!fs.existsSync(APK_PATH)) {
      throw new Error(`APK file not found at ${APK_PATH}`);
    }

    console.log(`🔍 Checking existence of file with ID: ${FILE_ID}...`);
    const metadata = await drive.files.get({ fileId: FILE_ID });
    console.log(`✅ Found: ${metadata.data.name}`);

    console.log(`📤 Uploading new APK content to existing file ID (${(fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(1)} MB)...`);

    const updateRes = await drive.files.update({
      fileId: FILE_ID,
      media: {
        mimeType: 'application/vnd.android.package-archive',
        body: fs.createReadStream(APK_PATH),
      },
    });

    console.log(`✅ Success! APK content replaced. File ID remains: ${updateRes.data.id}`);
    console.log(`🔗 Link remains the same: https://drive.google.com/uc?export=download&id=${FILE_ID}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

replaceAPK();
