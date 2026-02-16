/**
 * Script to create ALL database indexes for optimal performance
 * Run this once: node create_all_indexes.js
 */

const mongoose = require('mongoose');
const config = require('./src/config/env');

// Import all models to register their schemas
const Appointment = require('./src/models/Appointment');
const MedicalRecord = require('./src/models/MedicalRecord');
const Specialization = require('./src/models/Specialization');
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');
const Review = require('./src/models/Review');
const Notification = require('./src/models/Notification');
const Favorite = require('./src/models/Favorite');
const Transaction = require('./src/models/Transaction');

async function createAllIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    console.log('Creating indexes for all collections...\n');

    // Appointment indexes
    console.log('📅 Creating Appointment indexes...');
    try {
      await Appointment.collection.createIndex({ petOwnerId: 1, status: 1, appointmentDate: -1 });
      console.log('  ✓ petOwnerId + status + appointmentDate');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Appointment.collection.createIndex({ veterinarianId: 1, appointmentDate: 1 });
      console.log('  ✓ veterinarianId + appointmentDate');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Appointment.collection.createIndex({ petOwnerId: 1, appointmentDate: -1 });
      console.log('  ✓ petOwnerId + appointmentDate');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Appointment.collection.createIndex({ status: 1 });
      console.log('  ✓ status');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // MedicalRecord indexes
    console.log('\n🏥 Creating MedicalRecord indexes...');
    try {
      await MedicalRecord.collection.createIndex({ petOwnerId: 1, uploadedDate: -1 });
      console.log('  ✓ petOwnerId + uploadedDate');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await MedicalRecord.collection.createIndex({ petOwnerId: 1, recordType: 1, uploadedDate: -1 });
      console.log('  ✓ petOwnerId + recordType + uploadedDate');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await MedicalRecord.collection.createIndex({ petId: 1, uploadedDate: -1 });
      console.log('  ✓ petId + uploadedDate');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Specialization indexes
    console.log('\n🔬 Creating Specialization indexes...');
    try {
      await Specialization.collection.createIndex({ name: 1 });
      console.log('  ✓ name');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Specialization.collection.createIndex({ slug: 1 });
      console.log('  ✓ slug');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // User indexes
    console.log('\n👤 Creating User indexes...');
    try {
      await User.collection.createIndex({ email: 1 });
      console.log('  ✓ email');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await User.collection.createIndex({ role: 1 });
      console.log('  ✓ role');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Pet indexes
    console.log('\n🐾 Creating Pet indexes...');
    try {
      await Pet.collection.createIndex({ ownerId: 1, isActive: 1 });
      console.log('  ✓ ownerId + isActive');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Review indexes
    console.log('\n⭐ Creating Review indexes...');
    try {
      await Review.collection.createIndex({ petOwnerId: 1, createdAt: -1 });
      console.log('  ✓ petOwnerId + createdAt');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Review.collection.createIndex({ veterinarianId: 1, createdAt: -1 });
      console.log('  ✓ veterinarianId + createdAt');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Notification indexes
    console.log('\n🔔 Creating Notification indexes...');
    try {
      await Notification.collection.createIndex({ userId: 1, isRead: 1, createdAt: -1 });
      console.log('  ✓ userId + isRead + createdAt');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Favorite indexes
    console.log('\n❤️ Creating Favorite indexes...');
    try {
      await Favorite.collection.createIndex({ petOwnerId: 1 });
      console.log('  ✓ petOwnerId');
    } catch (e) { console.log('  ⚠ Already exists'); }

    // Transaction indexes
    console.log('\n💰 Creating Transaction indexes...');
    try {
      await Transaction.collection.createIndex({ userId: 1, createdAt: -1 });
      console.log('  ✓ userId + createdAt');
    } catch (e) { console.log('  ⚠ Already exists'); }
    
    try {
      await Transaction.collection.createIndex({ status: 1 });
      console.log('  ✓ status');
    } catch (e) { console.log('  ⚠ Already exists'); }

    console.log('\n✅ All indexes created successfully!');
    console.log('\nYou can now restart your server for better performance.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating indexes:', error);
    process.exit(1);
  }
}

createAllIndexes();
