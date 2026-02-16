require('dotenv').config();
const mongoose = require('mongoose');
const Vaccine = require('../models/Vaccine');

const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/veterinary_db';

const SEED_VACCINES = [
  {
    name: 'Rabies',
    applicableSpecies: ['DOG', 'CAT'],
    dosesRequired: 1,
    defaultNextDueDays: 365,
  },
  {
    name: 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)',
    applicableSpecies: ['DOG'],
    dosesRequired: 3,
    boosterScheduleDays: [21, 21],
  },
  {
    name: 'Leptospirosis',
    applicableSpecies: ['DOG'],
    dosesRequired: 2,
    boosterScheduleDays: [21],
    defaultNextDueDays: 365,
  },
  {
    name: 'Bordetella (Kennel Cough)',
    applicableSpecies: ['DOG'],
    dosesRequired: 1,
    defaultNextDueDays: 365,
  },
  {
    name: 'Canine Influenza',
    applicableSpecies: ['DOG'],
    dosesRequired: 2,
    boosterScheduleDays: [21],
    defaultNextDueDays: 365,
  },
  {
    name: 'FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)',
    applicableSpecies: ['CAT'],
    dosesRequired: 3,
    boosterScheduleDays: [21, 21],
  },
  {
    name: 'FeLV (Feline Leukemia)',
    applicableSpecies: ['CAT'],
    dosesRequired: 2,
    boosterScheduleDays: [21],
    defaultNextDueDays: 365,
  },
  {
    name: 'Feline Bordetella',
    applicableSpecies: ['CAT'],
    dosesRequired: 1,
    defaultNextDueDays: 365,
  },
  {
    name: 'Lyme Disease',
    applicableSpecies: ['DOG'],
    dosesRequired: 2,
    boosterScheduleDays: [21],
    defaultNextDueDays: 365,
  },
];

async function seedVaccines() {
  try {
    console.log('🌱 Starting Vaccine Seeder...\n');

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let created = 0;
    let skipped = 0;

    for (const v of SEED_VACCINES) {
      const name = String(v.name || '').trim();
      if (!name) continue;

      const existing = await Vaccine.findOne({
        name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') },
      })
        .lean()
        .maxTimeMS(2000);

      if (existing) {
        skipped += 1;
        continue;
      }

      await Vaccine.create({
        name,
        applicableSpecies: Array.isArray(v.applicableSpecies) && v.applicableSpecies.length > 0 ? v.applicableSpecies : ['ALL'],
        minAgeWeeks: v.minAgeWeeks ?? null,
        dosesRequired: v.dosesRequired ?? null,
        boosterScheduleDays: Array.isArray(v.boosterScheduleDays) ? v.boosterScheduleDays : [],
        defaultNextDueDays: v.defaultNextDueDays ?? null,
        isActive: v.isActive !== undefined ? !!v.isActive : true,
      });

      created += 1;
    }

    const total = await Vaccine.countDocuments({}).maxTimeMS(2000);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VACCINES SEEDED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ Created:', created);
    console.log('⏭️  Skipped (already existed):', skipped);
    console.log('📦 Total vaccines in DB:', total);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding vaccines:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

seedVaccines();
