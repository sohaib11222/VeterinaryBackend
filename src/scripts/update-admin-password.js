const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: false });
}

const mongoose = require('mongoose');
const User = require('../models/User');

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';

const updateAdminPassword = async () => {
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this command.');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  if (!mongoUri) throw new Error('Set MONGO_URI or MONGODB_URI before running this command.');

  await mongoose.connect(mongoUri);
  const admin = await User.findOne({ email }).select('+password');
  if (!admin || admin.role !== 'ADMIN') {
    throw new Error(`Admin account not found for ${email}.`);
  }

  // User.pre('save') hashes the password; the plaintext is never stored.
  admin.password = password;
  await admin.save();
  console.log(`Admin password updated for ${admin.email}.`);
};

updateAdminPassword()
  .catch((error) => {
    console.error(`Admin password update failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
