/**
 * Comprehensive Timeout Fix Script
 * This script will:
 * 1. Create ALL missing indexes
 * 2. Verify database connection
 * 3. Optimize query timeouts
 * Run: node fix_timeout_comprehensive.js
 */

const mongoose = require('mongoose');
const config = require('./src/config/env');

// Import ALL models to register schemas
const Appointment = require('./src/models/Appointment');
const MedicalRecord = require('./src/models/MedicalRecord');
const Specialization = require('./src/models/Specialization');
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');
const Review = require('./src/models/Review');
const Notification = require('./src/models/Notification');
const Favorite = require('./src/models/Favorite');
const Transaction = require('./src/models/Transaction');
const Order = require('./src/models/Order');
const Vaccination = require('./src/models/Vaccination');
const WeightRecord = require('./src/models/WeightRecord');
const VeterinarianProfile = require('./src/models/VeterinarianProfile');
const Product = require('./src/models/Product');
const PetStore = require('./src/models/PetStore');
const VeterinarianSubscription = require('./src/models/VeterinarianSubscription');
const WeeklySchedule = require('./src/models/WeeklySchedule');
const VeterinarianAvailability = require('./src/models/VeterinarianAvailability');

async function createAllIndexes() {
  try {
    console.log('🔧 Comprehensive Timeout Fix\n');
    console.log('Connecting to MongoDB...');
    
    const startTime = Date.now();
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    const connectTime = Date.now() - startTime;
    console.log(`✓ Connected in ${connectTime}ms\n`);

    console.log('Creating ALL indexes for optimal performance...\n');

    const indexesToCreate = [
      // Appointment indexes
      { model: Appointment, name: 'Appointment', indexes: [
        { keys: { petOwnerId: 1, status: 1, appointmentDate: -1 }, options: {} },
        { keys: { veterinarianId: 1, appointmentDate: 1 }, options: {} },
        { keys: { petOwnerId: 1, appointmentDate: -1 }, options: {} },
        { keys: { petId: 1, appointmentDate: -1 }, options: {} },
        { keys: { status: 1 }, options: {} },
        { keys: { appointmentNumber: 1 }, options: { unique: true, sparse: true } }
      ]},
      
      // MedicalRecord indexes
      { model: MedicalRecord, name: 'MedicalRecord', indexes: [
        { keys: { petId: 1, uploadedDate: -1 }, options: {} },
        { keys: { petOwnerId: 1, uploadedDate: -1 }, options: {} },
        { keys: { petOwnerId: 1, recordType: 1, uploadedDate: -1 }, options: {} },
        { keys: { recordType: 1 }, options: {} },
        { keys: { relatedAppointmentId: 1 }, options: {} }
      ]},
      
      // User indexes
      { model: User, name: 'User', indexes: [
        { keys: { email: 1 }, options: { unique: true, sparse: true } },
        { keys: { role: 1, status: 1 }, options: {} }
      ]},
      
      // Pet indexes
      { model: Pet, name: 'Pet', indexes: [
        { keys: { ownerId: 1, isActive: 1 }, options: {} },
        { keys: { microchipNumber: 1 }, options: { unique: true, sparse: true } },
        { keys: { species: 1 }, options: {} }
      ]},
      
      // Review indexes
      { model: Review, name: 'Review', indexes: [
        { keys: { veterinarianId: 1, createdAt: -1 }, options: {} },
        { keys: { petOwnerId: 1 }, options: {} },
        { keys: { appointmentId: 1 }, options: {} }
      ]},
      
      // Notification indexes
      { model: Notification, name: 'Notification', indexes: [
        { keys: { userId: 1, isRead: 1, createdAt: -1 }, options: {} }
      ]},
      
      // Transaction indexes
      { model: Transaction, name: 'Transaction', indexes: [
        { keys: { userId: 1, createdAt: -1 }, options: {} },
        { keys: { relatedAppointmentId: 1 }, options: {} },
        { keys: { relatedOrderId: 1 }, options: {} },
        { keys: { status: 1 }, options: {} }
      ]},
      
      // Order indexes
      { model: Order, name: 'Order', indexes: [
        { keys: { petOwnerId: 1, createdAt: -1 }, options: {} },
        { keys: { ownerId: 1, createdAt: -1 }, options: {} },
        { keys: { petStoreId: 1, createdAt: -1 }, options: {} },
        { keys: { status: 1 }, options: {} },
        { keys: { orderNumber: 1 }, options: { unique: true, sparse: true } }
      ]},
      
      // Specialization indexes
      { model: Specialization, name: 'Specialization', indexes: [
        { keys: { name: 1 }, options: {} },
        { keys: { slug: 1 }, options: {} }
      ]},
      
      // Vaccination indexes
      { model: Vaccination, name: 'Vaccination', indexes: [
        { keys: { petId: 1, vaccinationDate: -1 }, options: {} },
        { keys: { petOwnerId: 1 }, options: {} },
        { keys: { nextDueDate: 1 }, options: {} }
      ]},
      
      // WeightRecord indexes
      { model: WeightRecord, name: 'WeightRecord', indexes: [
        { keys: { petId: 1, date: -1 }, options: {} },
        { keys: { petOwnerId: 1 }, options: {} }
      ]},
      
      // Product indexes
      { model: Product, name: 'Product', indexes: [
        { keys: { sellerId: 1, isActive: 1 }, options: {} },
        { keys: { petStoreId: 1 }, options: {} },
        { keys: { category: 1 }, options: {} },
        { keys: { petType: 1 }, options: {} },
        { keys: { isActive: 1 }, options: {} }
      ]},
      
      // PetStore indexes
      { model: PetStore, name: 'PetStore', indexes: [
        { keys: { ownerId: 1 }, options: {} },
        { keys: { isActive: 1 }, options: {} }
      ]},
      
      // VeterinarianProfile indexes
      { model: VeterinarianProfile, name: 'VeterinarianProfile', indexes: [
        { keys: { userId: 1 }, options: { unique: true } },
        { keys: { isVerified: 1, isFeatured: 1 }, options: {} },
        { keys: { specializations: 1 }, options: {} }
      ]},
      
      // VeterinarianSubscription indexes
      { model: VeterinarianSubscription, name: 'VeterinarianSubscription', indexes: [
        { keys: { veterinarianId: 1, isActive: 1 }, options: {} },
        { keys: { endDate: 1 }, options: {} }
      ]},
      
      // Favorite indexes
      { model: Favorite, name: 'Favorite', indexes: [
        { keys: { petOwnerId: 1, veterinarianId: 1 }, options: { unique: true } }
      ]}
    ];

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const collection of indexesToCreate) {
      console.log(`📋 ${collection.name}:`);
      
      for (const index of collection.indexes) {
        try {
          await collection.model.collection.createIndex(index.keys, index.options);
          console.log(`   ✓ ${Object.keys(index.keys).join(' + ')}`);
          created++;
        } catch (error) {
          if (error.code === 85 || error.message.includes('already exists')) {
            console.log(`   ⚠ Already exists: ${Object.keys(index.keys).join(' + ')}`);
            skipped++;
          } else {
            console.log(`   ❌ Error: ${Object.keys(index.keys).join(' + ')} - ${error.message}`);
            errors++;
          }
        }
      }
      console.log('');
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Skipped (already exists): ${skipped}`);
    console.log(`   Errors: ${errors}`);

    if (errors === 0) {
      console.log('\n✅ All indexes verified/created successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Restart your server');
      console.log('   2. Test endpoints via Postman');
      console.log('   3. Run: node diagnose_timeout_issues.js (to verify)');
    } else {
      console.log('\n⚠️ Some indexes had errors. Check the output above.');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. MongoDB is not running');
    console.error('2. MONGO_URI is incorrect');
    console.error('3. Network connectivity issues');
    process.exit(1);
  }
}

createAllIndexes();
