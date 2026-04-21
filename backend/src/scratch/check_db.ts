import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const FileMetadataSchema = new mongoose.Schema({
  fileId: String,
  name: String,
  type: String,
  status: String,
  parentId: String,
  rootId: String,
});

const FileMetadata = mongoose.model('FileMetadata', FileMetadataSchema, 'filemetadatas');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to DB');

  const activeFiles = await FileMetadata.find({ status: 'active' });
  console.log(`Active files in DB: ${activeFiles.length}`);

  const folders = activeFiles.filter(f => f.type === 'application/vnd.google-apps.folder');
  console.log(`Folders: ${folders.length}`);

  const sampleFiles = activeFiles.slice(0, 10).map(f => ({ name: f.name, parent: f.parentId }));
  console.log('Sample files:', sampleFiles);

  await mongoose.disconnect();
}

check();
