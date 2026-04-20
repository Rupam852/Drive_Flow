import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth });

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
