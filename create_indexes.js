/**
 * Script to create database indexes for optimal performance
 * Run this once: node create_indexes.js
 */

const mongoose = require('mongoose');
const config = require('./src/config/env');

const Appointment = require('./src/models/Appointment');

async function createIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    console.log('\nCreating indexes...');
    
    // Create Appointment indexes
    console.log('Creating Appointment indexes...');
    await Appointment.collection.createIndex({ petOwnerId: 1, status: 1, appointmentDate: -1 });
    console.log('✓ Created compound index: petOwnerId + status + appointmentDate');
    
    await Appointment.collection.createIndex({ veterinarianId: 1, appointmentDate: 1 });
    console.log('✓ Created index: veterinarianId + appointmentDate');
    
    await Appointment.collection.createIndex({ petOwnerId: 1, appointmentDate: -1 });
    console.log('✓ Created index: petOwnerId + appointmentDate');
    
    await Appointment.collection.createIndex({ status: 1 });
    console.log('✓ Created index: status');

    console.log('\n✅ All indexes created successfully!');
    console.log('\nYou can now restart your server for better performance.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
