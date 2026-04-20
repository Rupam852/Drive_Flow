const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const userSchema = new mongoose.Schema({
  email: String,
  status: String,
  role: String
});

const User = mongoose.model('User', userSchema);

async function approveAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await User.updateMany({}, { status: 'approved' });
    console.log(`Updated ${result.modifiedCount} users to approved`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

approveAll();
