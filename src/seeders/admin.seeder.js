require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@veterinary.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/veterinary_db';

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin Seeder...\n');

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
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

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

seedAdmin();
