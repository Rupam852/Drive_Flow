import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
  console.log('Testing connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};
test();
