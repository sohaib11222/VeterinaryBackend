/**
 * Comprehensive Timeout Diagnostic Script
 * Run: node diagnose_timeout_issues.js
 * 
 * This script will:
 * 1. Check MongoDB connection
 * 2. Verify all indexes exist
 * 3. Test query performance
 * 4. Check database statistics
 */

const mongoose = require('mongoose');
const config = require('./src/config/env');

// Import all models
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');
const Appointment = require('./src/models/Appointment');
const MedicalRecord = require('./src/models/MedicalRecord');
const Review = require('./src/models/Review');
const Notification = require('./src/models/Notification');
const Order = require('./src/models/Order');
const Transaction = require('./src/models/Transaction');
const Vaccination = require('./src/models/Vaccination');
const WeightRecord = require('./src/models/WeightRecord');
const Specialization = require('./src/models/Specialization');

async function diagnose() {
  try {
    console.log('🔍 Starting Timeout Diagnostic...\n');
    
    // 1. Test MongoDB Connection
    console.log('1️⃣ Testing MongoDB Connection...');
    const startConnect = Date.now();
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    const connectTime = Date.now() - startConnect;
    console.log(`   ✓ Connected in ${connectTime}ms`);
    
    if (connectTime > 5000) {
      console.log('   ⚠️ WARNING: Connection is slow (>5s)');
    }
    
    // 2. Check Database Stats
    console.log('\n2️⃣ Checking Database Statistics...');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`   Found ${collections.length} collections`);
    
    for (const collection of collections) {
      try {
        const stats = await db.command({ collStats: collection.name });
        const count = await db.collection(collection.name).countDocuments({});
        console.log(`   ${collection.name}: ${count} documents, ${(stats.size / 1024).toFixed(2)} KB`);
      } catch (error) {
        const count = await db.collection(collection.name).countDocuments({});
        console.log(`   ${collection.name}: ${count} documents`);
      }
    }
    
    // 3. Verify Critical Indexes
    console.log('\n3️⃣ Verifying Critical Indexes...');
    
    const indexChecks = [
      { model: Appointment, name: 'Appointment', indexes: [
        { keys: { petOwnerId: 1, status: 1, appointmentDate: -1 }, name: 'petOwnerId + status + appointmentDate' },
        { keys: { veterinarianId: 1, appointmentDate: 1 }, name: 'veterinarianId + appointmentDate' },
        { keys: { petOwnerId: 1, appointmentDate: -1 }, name: 'petOwnerId + appointmentDate' }
      ]},
      { model: MedicalRecord, name: 'MedicalRecord', indexes: [
        { keys: { petOwnerId: 1, uploadedDate: -1 }, name: 'petOwnerId + uploadedDate' },
        { keys: { petOwnerId: 1, recordType: 1, uploadedDate: -1 }, name: 'petOwnerId + recordType + uploadedDate' }
      ]},
      { model: User, name: 'User', indexes: [
        { keys: { email: 1 }, name: 'email' },
        { keys: { role: 1, status: 1 }, name: 'role + status' }
      ]},
      { model: Pet, name: 'Pet', indexes: [
        { keys: { ownerId: 1, isActive: 1 }, name: 'ownerId + isActive' }
      ]},
      { model: Review, name: 'Review', indexes: [
        { keys: { veterinarianId: 1, createdAt: -1 }, name: 'veterinarianId + createdAt' },
        { keys: { petOwnerId: 1 }, name: 'petOwnerId' }
      ]},
      { model: Notification, name: 'Notification', indexes: [
        { keys: { userId: 1, isRead: 1, createdAt: -1 }, name: 'userId + isRead + createdAt' }
      ]},
      { model: Order, name: 'Order', indexes: [
        { keys: { petOwnerId: 1, createdAt: -1 }, name: 'petOwnerId + createdAt' },
        { keys: { ownerId: 1, createdAt: -1 }, name: 'ownerId + createdAt' }
      ]},
      { model: Transaction, name: 'Transaction', indexes: [
        { keys: { userId: 1, createdAt: -1 }, name: 'userId + createdAt' }
      ]},
      { model: Specialization, name: 'Specialization', indexes: [
        { keys: { name: 1 }, name: 'name' }
      ]}
    ];
    
    const missingIndexes = [];
    
    for (const check of indexChecks) {
      try {
        const indexes = await check.model.collection.getIndexes();
        const indexNames = Object.keys(indexes || {});
        
        for (const expectedIndex of check.indexes) {
          // Check if index exists (by matching keys)
          let exists = false;
          
          for (const indexName of indexNames) {
            if (indexName === '_id_') continue;
            
            const index = indexes[indexName];
            if (!index || !index.key) continue;
            
            const indexKeys = Object.keys(index.key || {});
            const expectedKeys = Object.keys(expectedIndex.keys || {});
            
            // Check if all expected keys exist in index and values match
            const keysMatch = expectedKeys.every(key => {
              return indexKeys.includes(key) && 
                     index.key[key] === expectedIndex.keys[key];
            });
            
            if (keysMatch && expectedKeys.length === indexKeys.length) {
              exists = true;
              break;
            }
          }
          
          if (!exists) {
            missingIndexes.push(`${check.name}: ${expectedIndex.name}`);
            console.log(`   ❌ MISSING: ${check.name}.${expectedIndex.name}`);
          } else {
            console.log(`   ✓ ${check.name}.${expectedIndex.name}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking ${check.name}: ${error.message}`);
      }
    }
    
    if (missingIndexes.length > 0) {
      console.log(`\n   ⚠️ Found ${missingIndexes.length} missing indexes!`);
      console.log('   Run: node create_all_indexes.js');
    }
    
    // 4. Test Query Performance
    console.log('\n4️⃣ Testing Query Performance...');
    
    // Test Appointment query
    const appointmentStart = Date.now();
    try {
      await Appointment.find({}).limit(1).lean().maxTimeMS(5000);
      const appointmentTime = Date.now() - appointmentStart;
      console.log(`   Appointment.find(): ${appointmentTime}ms`);
      if (appointmentTime > 2000) {
        console.log('   ⚠️ WARNING: Query is slow (>2s)');
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // Test User query
    const userStart = Date.now();
    try {
      await User.find({ role: 'PET_OWNER' }).limit(1).lean().maxTimeMS(5000);
      const userTime = Date.now() - userStart;
      console.log(`   User.find(role): ${userTime}ms`);
      if (userTime > 2000) {
        console.log('   ⚠️ WARNING: Query is slow (>2s)');
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // Test MedicalRecord query
    const medicalStart = Date.now();
    try {
      await MedicalRecord.find({}).limit(1).lean().maxTimeMS(5000);
      const medicalTime = Date.now() - medicalStart;
      console.log(`   MedicalRecord.find(): ${medicalTime}ms`);
      if (medicalTime > 2000) {
        console.log('   ⚠️ WARNING: Query is slow (>2s)');
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // 5. Check MongoDB Server Status
    console.log('\n5️⃣ Checking MongoDB Server Status...');
    try {
      const serverStatus = await db.admin().serverStatus();
      console.log(`   Version: ${serverStatus.version}`);
      console.log(`   Uptime: ${(serverStatus.uptime / 3600).toFixed(2)} hours`);
      console.log(`   Connections: ${serverStatus.connections.current}/${serverStatus.connections.available}`);
      
      if (serverStatus.connections.current > serverStatus.connections.available * 0.8) {
        console.log('   ⚠️ WARNING: High connection usage');
      }
    } catch (error) {
      console.log(`   ⚠️ Could not get server status: ${error.message}`);
    }
    
    // Summary
    console.log('\n📊 Diagnostic Summary:');
    console.log(`   Connection Time: ${connectTime}ms`);
    console.log(`   Missing Indexes: ${missingIndexes.length}`);
    
    if (missingIndexes.length > 0) {
      console.log('\n❌ ACTION REQUIRED:');
      console.log('   1. Run: node create_all_indexes.js');
      console.log('   2. Restart your server');
    } else {
      console.log('\n✅ All indexes are present');
    }
    
    if (connectTime > 5000) {
      console.log('\n⚠️ ACTION REQUIRED:');
      console.log('   MongoDB connection is slow. Check:');
      console.log('   1. MongoDB server is running');
      console.log('   2. Network connectivity');
      console.log('   3. MONGO_URI in .env file');
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Diagnostic Error:', error);
    console.error('\nPossible issues:');
    console.error('1. MongoDB is not running');
    console.error('2. MONGO_URI is incorrect in .env');
    console.error('3. Network connectivity issues');
    process.exit(1);
  }
}

diagnose();
