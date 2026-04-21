import drive from '../config/googleDrive';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function check() {
  const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log('Managed Folder ID:', DRIVE_FOLDER_ID);

  const res = await drive.files.list({
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
