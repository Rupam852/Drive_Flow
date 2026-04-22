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

async function uploadAPK() {
  try {
    console.log('📁 Creating "DriveFlow-App" folder in Google Drive root...');

    // 1. Create a folder named "DriveFlow-App" in Drive root
    const folderRes = await drive.files.create({
      requestBody: {
        name: 'DriveFlow-App',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const folderId = folderRes.data.id!;
    console.log(`✅ Folder created! ID: ${folderId}`);

    // 2. Upload APK to that folder
    const apkPath = 'D:\\PROJECT\\File_Opcus\\frontend\\android\\app\\build\\outputs\\apk\\debug\\DriveFlow.apk';

    console.log(`📤 Uploading DriveFlow.apk (${(fs.statSync(apkPath).size / 1024 / 1024).toFixed(1)} MB)...`);

    const uploadRes = await drive.files.create({
      requestBody: {
        name: 'DriveFlow.apk',
        parents: [folderId],
        mimeType: 'application/vnd.android.package-archive',
      },
      media: {
        mimeType: 'application/vnd.android.package-archive',
        body: fs.createReadStream(apkPath),
      },
      fields: 'id, name, size',
    });

    const fileId = uploadRes.data.id!;
    console.log(`✅ APK uploaded! File ID: ${fileId}`);

    // 3. Make the file publicly accessible (anyone with link can download)
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log('✅ Public access granted!');

    // 4. Generate direct download link
    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;

    console.log('\n🎉 SUCCESS! Copy this info:\n');
    console.log(`📦 File ID    : ${fileId}`);
    console.log(`🔗 Direct DL  : ${directDownloadUrl}`);
    console.log(`👁️  View URL   : ${viewUrl}`);
    console.log('\n✅ Use the Direct DL link on the login page!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

uploadAPK();
