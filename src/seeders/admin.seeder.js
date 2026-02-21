const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({
    path: envPath,
    override: false,
  });
}
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@veterinary.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  null;

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin Seeder...\n');

    if (fs.existsSync(envPath)) {
      console.log(`🧩 Loaded env file: ${envPath}`);
    } else {
      console.log('🧩 No .env file found at backend root (skipping dotenv file load)');
    }

    if (!MONGODB_URI) {
      throw new Error('Missing MONGO_URI (or MONGODB_URI). Refusing to seed to avoid writing to the wrong database.');
    }

    const sanitizedUri = String(MONGODB_URI)
      .replace(/:\/\/.*?:.*?@/, '://***:***@')
      .replace(/\?.*$/, '');
    console.log(`🔎 Using MONGO_URI: ${sanitizedUri}`);

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log(
      `🔗 Mongo Target: host=${mongoose.connection.host} db=${mongoose.connection.name}`
    );
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Checking if admin user exists...');
    let admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

    if (admin) {
      console.log('⚠️  Admin user already exists, updating...\n');

      admin.password = ADMIN_PASSWORD; // ✅ PLAIN PASSWORD
      admin.fullName = ADMIN_NAME;
      admin.role = 'ADMIN';
      admin.status = 'APPROVED';
      admin.updatedAt = new Date();

      await admin.save();
      console.log('✅ Admin user updated successfully!\n');
    } else {
      console.log('➕ Creating new admin user...');

      admin = await User.create({
        email: ADMIN_EMAIL.toLowerCase(),
        password: ADMIN_PASSWORD, // ✅ PLAIN PASSWORD
        fullName: ADMIN_NAME,
        role: 'ADMIN',
        status: 'APPROVED',
      });

      console.log('✅ Admin user created successfully!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ADMIN USER SEEDED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👤 Name:', admin.fullName);
    console.log('🎭 Role:', admin.role);
    console.log('📊 Status:', admin.status);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Error seeding admin:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

seedAdmin();
