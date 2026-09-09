const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: false });
}

const mongoose = require('mongoose');
const User = require('../models/User');

const currentEmail = String(process.env.CURRENT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const newEmail = String(process.env.NEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';

const updateAdminPassword = async () => {
  if (!currentEmail || !newEmail || !password) {
    throw new Error('Set CURRENT_ADMIN_EMAIL, NEW_ADMIN_EMAIL, and ADMIN_PASSWORD before running this command.');
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  if (!mongoUri) throw new Error('Set MONGO_URI or MONGODB_URI before running this command.');

  await mongoose.connect(mongoUri);
  const admin = await User.findOne({ email: currentEmail }).select('+password');
  if (!admin || admin.role !== 'ADMIN') {
    throw new Error(`Admin account not found for ${currentEmail}.`);
  }
  const emailOwner = await User.findOne({ email: newEmail, _id: { $ne: admin._id } }).select('_id email role');
  if (emailOwner) {
    throw new Error(`The new email is already used by another account: ${newEmail}.`);
  }

  admin.email = newEmail;
  admin.password = password;
  await admin.save();
  console.log(`Admin email and password updated for ${admin.email}.`);
};

updateAdminPassword()
  .catch((error) => {
    console.error(`Admin password update failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
