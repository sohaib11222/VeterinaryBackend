/**
 * One-time fix: Remove microchipNumber from pets where it is empty, null, or a placeholder.
 * This allows multiple pets without a microchip (sparse unique index only allows one doc with null/"").
 * Run: node fix_microchip_empty_values.js
 */

const mongoose = require('mongoose');
const config = require('./src/config/env');
const Pet = require('./src/models/Pet');

const PLACEHOLDERS = ['', 'n/a', 'na', 'none', '-', 'null', 'no', 'x', '—', '–'];

async function run() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Find pets that have microchipNumber set to null, empty, or placeholder (so we can $unset)
    const pets = await Pet.find({
      microchipNumber: {
        $in: [null, '', ...PLACEHOLDERS]
      }
    }).lean();

    // Also match documents where microchipNumber is only whitespace (regex)
    const whitespacePets = await Pet.find({
      microchipNumber: { $regex: /^\s*$/, $type: 'string' }
    }).lean();

    const allIds = [...new Set([...pets.map(p => p._id.toString()), ...whitespacePets.map(p => p._id.toString())])];

    if (allIds.length === 0) {
      console.log('No pets with empty/placeholder microchip found. Nothing to fix.');
      await mongoose.connection.close();
      process.exit(0);
      return;
    }

    console.log(`Found ${allIds.length} pet(s) with empty/placeholder microchip. Clearing field...\n`);

    const result = await Pet.updateMany(
      { _id: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { $unset: { microchipNumber: 1 } }
    );

    console.log(`✓ Cleared microchipNumber on ${result.modifiedCount} pet(s).`);
    console.log('\nYou can now create multiple pets without a microchip (leave field blank).');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
