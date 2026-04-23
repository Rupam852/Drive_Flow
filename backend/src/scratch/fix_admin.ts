import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixAdmin() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected to MongoDB');

  const result = await mongoose.connection.collection('users').updateMany(
    { role: 'admin' },
    { $set: { isEmailVerified: true } }
  );

  console.log(`✅ Updated ${result.modifiedCount} admin user(s) — isEmailVerified set to true`);
  await mongoose.disconnect();
}

fixAdmin().catch(console.error);
