import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fileMetadataSchema = new mongoose.Schema({
  fileId: String,
  name: String,
  type: String,
  parentId: String,
  status: String,
});

const FileMetadata = mongoose.model('FileMetadata', fileMetadataSchema, 'filemetadatas');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('DB Connected');
  console.log('DRIVE_FOLDER_ID from ENV:', process.env.GOOGLE_DRIVE_FOLDER_ID);
  
  const folders = await FileMetadata.find({ type: 'folder', status: 'active' });
  console.log('Total active folders in DB:', folders.length);
  
  folders.forEach(f => {
    console.log(`- ${f.name} (ID: ${f.fileId}, Parent: ${f.parentId})`);
  });
  
  const rootFolders = await FileMetadata.find({ type: 'folder', status: 'active', parentId: process.env.GOOGLE_DRIVE_FOLDER_ID });
  console.log('Folders with parentId === DRIVE_FOLDER_ID:', rootFolders.length);
  
  await mongoose.disconnect();
}

check();
