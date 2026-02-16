/**
 * Fix microchipNumber index to be sparse
 * This allows multiple null values while keeping unique constraint for actual values
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function fixMicrochipIndex() {
  try {
    console.log('🔧 Fixing microchipNumber index...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const petsCollection = db.collection('pets');
    
    // Drop the existing non-sparse index
    try {
      await petsCollection.dropIndex('microchipNumber_1');
      console.log('✓ Dropped existing microchipNumber_1 index');
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log('⚠️  Index microchipNumber_1 not found (might have different name)');
      } else {
        console.log(`⚠️  Could not drop index: ${error.message}`);
      }
    }
    
    // List all indexes to see what exists
    const indexes = await petsCollection.indexes();
    console.log('\n📋 Current indexes on pets collection:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    // Drop any microchipNumber index (might have different name)
    for (const idx of indexes) {
      if (idx.key && idx.key.microchipNumber) {
        try {
          await petsCollection.dropIndex(idx.name);
          console.log(`✓ Dropped index: ${idx.name}`);
        } catch (error) {
          console.log(`⚠️  Could not drop ${idx.name}: ${error.message}`);
        }
      }
    }
    
    // Create a new SPARSE unique index
    // Sparse means: only index documents where the field exists and is not null
    await petsCollection.createIndex(
      { microchipNumber: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'microchipNumber_1_sparse'
      }
    );
    console.log('✓ Created new sparse unique index on microchipNumber');
    
    // Also update any existing null values to be undefined (not stored)
    const result = await petsCollection.updateMany(
      { microchipNumber: null },
      { $unset: { microchipNumber: "" } }
    );
    console.log(`✓ Cleaned up ${result.modifiedCount} documents with null microchipNumber`);
    
    console.log('\n✅ Index fix complete!');
    console.log('📝 The microchipNumber index is now sparse, allowing multiple null/undefined values.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📋 Database connection closed');
  }
}

fixMicrochipIndex();
